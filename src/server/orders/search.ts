// search.ts — searchOrders (US5), listReceptionQueue (US3), getOrderDetail
// (US4). contracts/order-entry.md.
//
// All three require only an authenticated `actor` — no specific `Permission`
// gate (see contracts/order-entry.md's `searchOrders` rationale: FR-010/US4
// frame order lookup as broader than any single role's own capability set,
// and 001 froze the `Permission` vocabulary with no `order.view` key). By
// the time a caller has an `Actor` here, `getActor()` has already thrown
// `UnauthenticatedError` for an unauthenticated request — nothing further
// to check.

import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import type { Actor } from "~/server/auth";
import { deriveOrderStatus } from "~/server/core";
import type { OrderStatusBucket, WorkItemState } from "~/server/core";
import { paginateQuery } from "~/server/pagination";
import type { PageInput, PageResult } from "~/server/pagination";
import { isOrderComplete } from "./completeness";

export interface OrderSearchResult {
  orderId: string;
  orderNumber: number;
  customerName: string;
  channel: string;
  priority: string;
  status: OrderStatusBucket;
  createdAt: Date;
}

export interface OrderQueueRow extends OrderSearchResult {
  isComplete: boolean;
  delayed: boolean;
}

export interface TimelineEntry {
  workItemId: string;
  from: WorkItemState | null;
  to: WorkItemState;
  actorId: string;
  at: Date;
  reason?: string;
}

type OrderWithWorkItemStates = {
  id: string;
  number: number;
  channel: string;
  priority: string;
  createdAt: Date;
  customer: { name: string };
  workItems: { state: WorkItemState }[];
};

function toSearchResult(order: OrderWithWorkItemStates): OrderSearchResult {
  return {
    orderId: order.id,
    orderNumber: order.number,
    customerName: order.customer.name,
    channel: order.channel,
    priority: order.priority,
    status: deriveOrderStatus(order.workItems),
    createdAt: order.createdAt,
  };
}

/**
 * `Customer.phone` is owned by 010-customers and does not exist in this
 * schema yet. Rather than hard-failing the whole search query, this checks
 * the live Prisma DMMF at runtime and only adds the phone clause once 010
 * has landed (research.md §5) — silently dropped otherwise.
 */
function customerHasPhoneField(): boolean {
  return (
    Prisma.dmmf.datamodel.models
      .find((m) => m.name === "Customer")
      ?.fields.some((f) => f.name === "phone") ?? false
  );
}

// ── searchOrders (US5) ──────────────────────────────────────────────────────

const MAX_SEARCH_RESULTS = 200;

export async function searchOrders(
  _actor: Actor,
  query: { orderNumber?: number; phone?: string; customerName?: string },
): Promise<OrderSearchResult[]> {
  const or: Prisma.OrderWhereInput[] = [];

  if (query.orderNumber !== undefined) {
    or.push({ number: query.orderNumber });
  }
  if (query.customerName) {
    or.push({ customer: { name: { contains: query.customerName, mode: "insensitive" } } });
  }
  if (query.phone && customerHasPhoneField()) {
    // 010's Customer.phone field isn't in the generated Prisma types yet —
    // the runtime guard above keeps this branch dead until it lands.
    or.push({
      customer: { phone: { contains: query.phone } },
    } as unknown as Prisma.OrderWhereInput);
  }

  if (or.length === 0) return [];

  // contracts/order-entry.md fixes this function's signature as a plain
  // `OrderSearchResult[]` with no pagination fields, so this stays a single
  // query with no cursor — but a `customerName` contains-search has no
  // natural upper bound on match count at production scale, unlike the
  // `orderNumber` branch (at most one row). `MAX_SEARCH_RESULTS` is a safety
  // cap, not a page size: it protects against one broad text query pulling
  // thousands of orders (with each one's Work Items) into memory, not a
  // paged browsing UI.
  const orders = await db.order.findMany({
    where: { OR: or },
    include: {
      customer: { select: { name: true } },
      workItems: { select: { state: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_SEARCH_RESULTS,
  });

  return orders.map(toSearchResult);
}

// ── listReceptionQueue (US3) ────────────────────────────────────────────────

export async function listReceptionQueue(
  _actor: Actor,
  opts?: { getDelayedWorkItemIds?: () => Promise<ReadonlySet<string>> },
): Promise<OrderQueueRow[]> {
  const orders = await db.order.findMany({
    include: {
      customer: { select: { name: true } },
      workItems: {
        select: {
          id: true,
          state: true,
          productTypeId: true,
          quantity: true,
          widthValue: true,
          heightValue: true,
          dimensionUnit: true,
          departmentId: true,
        },
      },
    },
  });

  const delayedIds = opts?.getDelayedWorkItemIds ? await opts.getDelayedWorkItemIds() : null;

  const rows = orders.map((order) => ({
    ...toSearchResult(order),
    isComplete: isOrderComplete({ workItems: order.workItems }),
    delayed: delayedIds ? order.workItems.some((wi) => delayedIds.has(wi.id)) : false,
    _priority: order.priority,
    _createdAt: order.createdAt,
  }));

  // FR-008: urgent first, then oldest-first within each bucket.
  rows.sort((a, b) => {
    if (a._priority === "URGENT" && b._priority !== "URGENT") return -1;
    if (a._priority !== "URGENT" && b._priority === "URGENT") return 1;
    return a._createdAt.getTime() - b._createdAt.getTime();
  });

  return rows.map(({ _priority, _createdAt, ...row }) => row);
}

// ── listReceptionQueuePage — paginated variant of listReceptionQueue ───────
//
// `listReceptionQueue` above is contract-frozen (specs/011-orders-reception/
// contracts/order-entry.md: "no filter... every order with at least one
// non-DELIVERED Work Item is 'new/unassigned' territory") and fetches every
// matching order in one query, sorting in memory. That was fine at the
// dataset size the contract was written against; at production scale (the
// live Vercel deployment's DB has thousands of orders) it means every
// /reception page load pulls the entire Order table. This variant keeps the
// exact same urgent-first/oldest-first ordering (FR-008) but pushes it down
// to the database via `orderBy` + `skip`/`take`, so only one page's worth of
// orders (and their Work Items) is ever fetched. `OrderPriority`'s enum
// declaration order is NORMAL, URGENT (core.prisma) — Postgres native enums
// compare by declaration order, so `orderBy: { priority: "desc" }` reliably
// sorts URGENT first without a second in-memory pass.
export async function listReceptionQueuePage(
  _actor: Actor,
  input: PageInput & { getDelayedWorkItemIds?: () => Promise<ReadonlySet<string>> } = {},
): Promise<PageResult<OrderQueueRow>> {
  const delayedIds = input.getDelayedWorkItemIds ? await input.getDelayedWorkItemIds() : null;

  const page = await paginateQuery(input, (skip, take) =>
    db.order.findMany({
      include: {
        customer: { select: { name: true } },
        workItems: {
          select: {
            id: true,
            state: true,
            productTypeId: true,
            quantity: true,
            widthValue: true,
            heightValue: true,
            dimensionUnit: true,
            departmentId: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      skip,
      take,
    }),
  );

  return page.map((order) => ({
    ...toSearchResult(order),
    isComplete: isOrderComplete({ workItems: order.workItems }),
    delayed: delayedIds ? order.workItems.some((wi) => delayedIds.has(wi.id)) : false,
  }));
}

// ── getReceptionQueueStats — header counters, decoupled from the page fetch ─
//
// The reception page's three header counters (urgent / incomplete /
// in-production) describe the WHOLE queue, not just the current page, so
// they can't be derived from `listReceptionQueuePage`'s single page of rows.
// All three are answered as pure DB `count()` aggregates — no order rows or
// Work Item state arrays are ever pulled into Node. `inProductionCount`
// previously did `db.order.findMany({ select: { workItems: {...} } })` with
// no `where`/`take` and ran `deriveOrderStatus` on every row in-process —
// i.e. a full unbounded fetch on every single page load, exactly the
// problem pagination was supposed to remove. Fixed by translating just the
// IN_PRODUCTION branch's condition into a `where` clause (same move this
// file already makes for `incompleteWhere` below, which reimplements
// `isOrderComplete`'s predicate rather than calling it) — not a duplicate
// of the whole 6-bucket decision tree.
//
// Proof the translation is exact: `deriveOrderStatus` returns IN_PRODUCTION
// only when some Work Item is IN_PRODUCTION and none is DELIVERED/COMPLETED.
// Every earlier bucket (CANCELLED, COMPLETED, DELIVERED, NOT_STARTED)
// requires either "all cancelled", "all non-cancelled COMPLETED", "all
// non-cancelled ∈ {DELIVERED, COMPLETED}", or "all ∈ {NEW, ASSIGNED}" — each
// of which is already false the moment one Work Item is IN_PRODUCTION, so
// "some IN_PRODUCTION AND none DELIVERED/COMPLETED" alone is sufficient and
// bucket precedence never has to be reproduced here.
export async function getReceptionQueueStats(_actor: Actor): Promise<{
  totalCount: number;
  urgentCount: number;
  incompleteCount: number;
  inProductionCount: number;
}> {
  const incompleteWhere: Prisma.OrderWhereInput = {
    workItems: {
      some: {
        OR: [
          { productTypeId: null },
          { quantity: null },
          { widthValue: null },
          { heightValue: null },
          { dimensionUnit: null },
          { departmentId: null },
        ],
      },
    },
  };

  const inProductionWhere: Prisma.OrderWhereInput = {
    AND: [
      { workItems: { some: { state: "IN_PRODUCTION" } } },
      { workItems: { none: { state: { in: ["DELIVERED", "COMPLETED"] } } } },
    ],
  };

  const [totalCount, urgentCount, incompleteCount, inProductionCount] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { priority: "URGENT" } }),
    db.order.count({ where: incompleteWhere }),
    db.order.count({ where: inProductionWhere }),
  ]);

  return { totalCount, urgentCount, incompleteCount, inProductionCount };
}

// ── getOrderDetail (US4) ────────────────────────────────────────────────────

export async function getOrderDetail(
  _actor: Actor,
  orderId: string,
): Promise<{
  order: OrderSearchResult;
  workItems: Array<{
    id: string;
    state: WorkItemState;
    description: string | null;
    quantity: number | null;
    widthValue: unknown;
    heightValue: unknown;
    dimensionUnit: string | null;
    departmentId: string | null;
    productTypeId: string | null;
  }>;
  timeline: TimelineEntry[];
  isComplete: boolean;
}> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      customer: { select: { name: true } },
      workItems: {
        include: { transitions: { orderBy: { at: "asc" } } },
      },
    },
  });

  const timeline: TimelineEntry[] = order.workItems
    .flatMap((wi) =>
      wi.transitions.map((t) => ({
        workItemId: wi.id,
        from: t.from,
        to: t.to,
        actorId: t.actorId,
        at: t.at,
        reason: t.reason ?? undefined,
      })),
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    order: toSearchResult(order),
    workItems: order.workItems.map((wi) => ({
      id: wi.id,
      state: wi.state,
      description: wi.description,
      quantity: wi.quantity,
      widthValue: wi.widthValue,
      heightValue: wi.heightValue,
      dimensionUnit: wi.dimensionUnit,
      departmentId: wi.departmentId,
      productTypeId: wi.productTypeId,
    })),
    timeline,
    isComplete: isOrderComplete({ workItems: order.workItems }),
  };
}
