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

  const orders = await db.order.findMany({
    where: { OR: or },
    include: {
      customer: { select: { name: true } },
      workItems: { select: { state: true } },
    },
    orderBy: { createdAt: "desc" },
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
