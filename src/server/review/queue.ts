// queue.ts — getReviewQueue (US1). contracts/review-rework.md.
//
// Read-only — no `db.$transaction`, no audit event (contract step 5).
// Ordering rule is FR-001/research.md §6 — the SAME urgent-first,
// oldest-first-within-bucket rule as 012's `getMyQueue`
// (src/server/designers/queue.ts), duplicated here rather than shared
// (plan.md "Structure Decision": modules composed over shared,
// prematurely-abstracted infrastructure).

import { db } from "~/server/db";
import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { PageRequest, PageResult } from "~/server/pagination";
import type { PageInput } from "~/server/pagination";

export interface ReviewQueueRow {
  workItemId: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  productTypeName: string | null;
  priority: "NORMAL" | "URGENT";
  enteredQueueAt: Date;
  /** count(Return WHERE workItemId = ...) — data-model.md derived value (research.md §1). */
  reworkCount: number;
  /** reworkCount > 0 */
  isRework: boolean;
}

/**
 * Scalar sort key for one WAITING_REVIEW row — the minimum the displayed
 * comparator needs: priority (on the related Order), derived entered-queue
 * timestamp (the most recent transition landing in WAITING_REVIEW, falling
 * back to createdAt), and nothing else (FR-029, research.md Decision
 * "Review queue paginates with offset skip/take over a lightweight
 * sort-key pass").
 */
interface ReviewSortKey {
  id: string;
  priority: "NORMAL" | "URGENT";
  enteredQueueAt: Date;
  sortKey: number;
}

/**
 * Key pass (092 T039 / FR-029): one scalar row per backlog item. The
 * transition fetch is bounded at the source to exactly the one transition
 * the code reads (`to = WAITING_REVIEW`, most recent — `take: 1`), never
 * the full transition history. `priority` lives on the related Order and
 * `enteredQueueAt` is derived from transition history, so the sort key
 * spans a relation + a derived value and can't be one Prisma `orderBy` —
 * keys are sorted in memory with the SAME urgent-first / oldest-first
 * comparator as 012's `getMyQueue`.
 */
async function fetchReviewSortKeys(): Promise<ReviewSortKey[]> {
  const workItems = await db.workItem.findMany({
    where: { state: "WAITING_REVIEW" },
    select: {
      id: true,
      createdAt: true,
      order: { select: { priority: true } },
      // Ordered desc with take: 1 so `transitions[0]` is always the most
      // recent transition landing in WAITING_REVIEW (data-model.md's
      // `enteredQueueAt`, matching 012's `getMyQueue` `assignedTransition`
      // pattern) — one transition per row, never the full history.
      transitions: {
        where: { to: "WAITING_REVIEW" },
        orderBy: { at: "desc" },
        take: 1,
        select: { at: true },
      },
    },
  });

  const keys = workItems.map((wi): ReviewSortKey => {
    const enteredQueueAt = wi.transitions[0]?.at ?? wi.createdAt;
    return {
      id: wi.id,
      priority: wi.order.priority,
      enteredQueueAt,
      sortKey: enteredQueueAt.getTime(),
    };
  });

  // FR-001/research.md §6: urgent first, then oldest enteredQueueAt within
  // each bucket — identical comparator to 012's getMyQueue (byte-for-byte
  // the same three-way decision this file always used).
  keys.sort((a, b) => {
    if (a.priority === "URGENT" && b.priority !== "URGENT") return -1;
    if (a.priority !== "URGENT" && b.priority === "URGENT") return 1;
    return a.sortKey - b.sortKey;
  });

  return keys;
}

/**
 * Row pass (092 T039 / FR-029): fetches the full payload (order + customer,
 * productType, rework groupBy) ONLY for the given keys' ids — one page's
 * worth from `getReviewQueuePage`, the full backlog from the frozen
 * `getReviewQueue`. Rows come back in `keys` order; `enteredQueueAt` and
 * `priority` are taken from the key pass so the displayed values are the
 * exact ones the sort used. A row that left WAITING_REVIEW between the two
 * passes (concurrent move) is simply absent from both.
 */
async function fetchReviewRows(keys: readonly ReviewSortKey[]): Promise<ReviewQueueRow[]> {
  if (keys.length === 0) return [];
  const ids = keys.map((k) => k.id);

  const [workItems, reworkCounts] = await Promise.all([
    db.workItem.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        orderId: true,
        order: { select: { number: true, customer: { select: { name: true } } } },
        productType: { select: { name: true } },
      },
    }),
    // Single grouped query instead of one `count` per Work Item (matches the
    // pattern in src/app/(shell)/orders/[orderId]/page.tsx) — avoids opening a
    // DB connection per row, which was exhausting the pooler's connection
    // limit under a large queue.
    db.return.groupBy({
      by: ["workItemId"],
      where: { workItemId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const byId = new Map(workItems.map((wi) => [wi.id, wi]));
  const reworkCountByWorkItem = new Map(reworkCounts.map((r) => [r.workItemId, r._count._all]));

  const rows: ReviewQueueRow[] = [];
  for (const key of keys) {
    const wi = byId.get(key.id);
    if (!wi) continue;
    const reworkCount = reworkCountByWorkItem.get(key.id) ?? 0;
    rows.push({
      workItemId: wi.id,
      orderId: wi.orderId,
      orderNumber: wi.order.number,
      customerName: wi.order.customer.name,
      productTypeName: wi.productType?.name ?? null,
      priority: key.priority,
      enteredQueueAt: key.enteredQueueAt,
      reworkCount,
      isRework: reworkCount > 0,
    });
  }
  return rows;
}

/**
 * Frozen 013 contract export (specs/013-review-rework/contracts/review-
 * rework.md fixes its plain-array signature). Keeps FULL-BACKLOG semantics:
 * key pass over the whole WAITING_REVIEW backlog, then the row payload for
 * every key — no paging, no cap. Only the transition fetch shape changed
 * (092 T039): one transition per row instead of the full history. No
 * production render path calls it — `review/page.tsx` uses
 * `getReviewQueuePage` exclusively; `tests/contract/review` exercises it.
 */
export async function getReviewQueue(actor: Actor): Promise<ReviewQueueRow[]> {
  authorize(actor, "design.review");
  return fetchReviewRows(await fetchReviewSortKeys());
}

/**
 * Paginated sibling of `getReviewQueue` — contract-frozen (specs/013-review-
 * rework/contracts/review-rework.md fixes `getReviewQueue`'s plain-array
 * signature) so this is additive rather than a change to the existing
 * function.
 *
 * 092 T039 / FR-029: server-side pagination, no fetch-everything-payload.
 * 1) key pass over the full backlog (scalar ids/priority/timestamps — cheap,
 *    no row payload); 2) slice `[skip, skip + take)` with the house
 *    `PageRequest` (offset `?page=` semantics, clamping, hasMore math
 *    unchanged); 3) full row payload for that slice's ids ONLY. Every backlog
 *    row stays reachable across pages (no fixed `take` ceiling — the key
 *    list is unbounded), and `getReviewQueueStats` describes the same full
 *    backlog these pages walk.
 */
export async function getReviewQueuePage(
  actor: Actor,
  input: PageInput = {},
): Promise<PageResult<ReviewQueueRow>> {
  authorize(actor, "design.review");
  const request = PageRequest.of(input);
  const keys = await fetchReviewSortKeys();
  const slice = keys.slice(request.skip, request.skip + request.take);
  const rows = await fetchReviewRows(slice);
  return PageResult.fromOverfetch(rows, request);
}

/**
 * Header counters for the review page, decoupled from the page fetch for
 * the same reason as reception's `getReceptionQueueStats`: they describe
 * the whole backlog, not just the current page, and are cheap DB `count()`
 * aggregates rather than a full row fetch.
 */
export async function getReviewQueueStats(actor: Actor): Promise<{
  totalCount: number;
  urgentCount: number;
  reworkCount: number;
}> {
  authorize(actor, "design.review");

  const [totalCount, urgentCount, reworkCount] = await Promise.all([
    db.workItem.count({ where: { state: "WAITING_REVIEW" } }),
    db.workItem.count({ where: { state: "WAITING_REVIEW", order: { priority: "URGENT" } } }),
    db.workItem.count({ where: { state: "WAITING_REVIEW", returns: { some: {} } } }),
  ]);

  return { totalCount, urgentCount, reworkCount };
}
