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
import { paginateInMemory } from "~/server/pagination";
import type { PageInput, PageResult } from "~/server/pagination";

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

// Shared by `getReviewQueue` and `getReviewQueuePage` — fetches the current
// WAITING_REVIEW backlog and sorts it per FR-001/research.md §6 (urgent
// first, then oldest `enteredQueueAt` within each bucket). `enteredQueueAt`
// is derived from a Work Item's transition history (data-model.md), not a
// stored column, and `priority` lives on the related Order — a sort key
// spanning both can't be expressed as a single Prisma `orderBy`, so the
// (backlog-bounded, not table-bounded) candidate set is sorted in memory.
async function fetchSortedReviewQueue(): Promise<ReviewQueueRow[]> {
  const workItems = await db.workItem.findMany({
    where: { state: "WAITING_REVIEW" },
    include: {
      order: { include: { customer: { select: { name: true } } } },
      productType: { select: { name: true } },
      // Ordered desc so `.find(...)` below always returns the most recent
      // transition landing in WAITING_REVIEW (data-model.md's
      // `enteredQueueAt`, matching 012's `getMyQueue` `assignedTransition`
      // pattern).
      transitions: { orderBy: { at: "desc" } },
    },
  });

  // Single grouped query instead of one `count` per Work Item (matches the
  // pattern in src/app/(shell)/orders/[orderId]/page.tsx) — avoids opening a
  // DB connection per row, which was exhausting the pooler's connection
  // limit under a large queue.
  const reworkCounts = await db.return.groupBy({
    by: ["workItemId"],
    where: { workItemId: { in: workItems.map((wi) => wi.id) } },
    _count: { _all: true },
  });
  const reworkCountByWorkItem = new Map(reworkCounts.map((r) => [r.workItemId, r._count._all]));

  const rows = workItems.map((wi) => {
    const enteredQueueTransition = wi.transitions.find((t) => t.to === "WAITING_REVIEW");
    const enteredQueueAt = enteredQueueTransition?.at ?? wi.createdAt;

    const reworkCount = reworkCountByWorkItem.get(wi.id) ?? 0;

    const row: ReviewQueueRow = {
      workItemId: wi.id,
      orderId: wi.orderId,
      orderNumber: wi.order.number,
      customerName: wi.order.customer.name,
      productTypeName: wi.productType?.name ?? null,
      priority: wi.order.priority,
      enteredQueueAt,
      reworkCount,
      isRework: reworkCount > 0,
    };

    return { row, sortKey: enteredQueueAt.getTime() };
  });

  // FR-001/research.md §6: urgent first, then oldest enteredQueueAt within
  // each bucket — identical comparator to 012's getMyQueue.
  rows.sort((a, b) => {
    if (a.row.priority === "URGENT" && b.row.priority !== "URGENT") return -1;
    if (a.row.priority !== "URGENT" && b.row.priority === "URGENT") return 1;
    return a.sortKey - b.sortKey;
  });

  return rows.map(({ row }) => row);
}

export async function getReviewQueue(actor: Actor): Promise<ReviewQueueRow[]> {
  authorize(actor, "design.review");
  return fetchSortedReviewQueue();
}

/**
 * Paginated sibling of `getReviewQueue` — contract-frozen (specs/013-review-
 * rework/contracts/review-rework.md fixes `getReviewQueue`'s plain-array
 * signature) so this is additive rather than a change to the existing
 * function. Same sorted backlog, sliced into pages instead of rendered
 * whole, so a large backlog doesn't mean a large single page render.
 */
export async function getReviewQueuePage(
  actor: Actor,
  input: PageInput = {},
): Promise<PageResult<ReviewQueueRow>> {
  authorize(actor, "design.review");
  return paginateInMemory(input, fetchSortedReviewQueue);
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
