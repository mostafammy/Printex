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

export async function getReviewQueue(actor: Actor): Promise<ReviewQueueRow[]> {
  authorize(actor, "design.review");

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

  const rows = await Promise.all(
    workItems.map(async (wi) => {
      const enteredQueueTransition = wi.transitions.find((t) => t.to === "WAITING_REVIEW");
      const enteredQueueAt = enteredQueueTransition?.at ?? wi.createdAt;

      const reworkCount = await db.return.count({ where: { workItemId: wi.id } });

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
    }),
  );

  // FR-001/research.md §6: urgent first, then oldest enteredQueueAt within
  // each bucket — identical comparator to 012's getMyQueue.
  rows.sort((a, b) => {
    if (a.row.priority === "URGENT" && b.row.priority !== "URGENT") return -1;
    if (a.row.priority !== "URGENT" && b.row.priority === "URGENT") return 1;
    return a.sortKey - b.sortKey;
  });

  return rows.map(({ row }) => row);
}
