// queue.ts — getMyQueue (US3). contracts/designer-assignment.md.
//
// No `authorize()` beyond an authenticated actor — mirrors 011's
// `listReceptionQueue`/`getOrderDetail` rationale (every role can have a
// queue; rows are scoped by `assigneeId = actor.userId` below, not by
// permission).

import { db } from "~/server/db";
import type { Actor } from "~/server/auth";
import type { RejectionCategory } from "~/server/core";

const MY_QUEUE_STATES = ["ASSIGNED", "IN_DESIGN", "REWORK_REQUIRED"] as const;
export type MyQueueRowState = (typeof MY_QUEUE_STATES)[number];

export interface MyQueueRow {
  workItemId: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  productTypeName: string | null;
  description: string | null;
  dueDate: Date | null;
  priority: "NORMAL" | "URGENT";
  state: MyQueueRowState;
  /** `state === "REWORK_REQUIRED"` (data-model.md `MyQueueRow.isRework`). */
  isRework: boolean;
  /** From the most recent `WorkItemTransition` landing in `REWORK_REQUIRED`. */
  rejectionDetails: { category: RejectionCategory; explanation: string | null } | null;
  /** An open (`endedAt: null`) `ACTIVE` `PhaseTiming` segment exists for this Work Item. */
  hasOpenTimer: boolean;
}

export async function getMyQueue(actor: Actor): Promise<MyQueueRow[]> {
  const workItems = await db.workItem.findMany({
    where: { assigneeId: actor.userId, state: { in: [...MY_QUEUE_STATES] } },
    include: {
      order: { include: { customer: { select: { name: true } } } },
      productType: { select: { name: true } },
      // Ordered desc so `.find(...)` below always returns the most recent
      // matching row (data-model.md's `MyQueueRow.rejectionDetails`/`assignedAt`).
      transitions: { orderBy: { at: "desc" } },
      phaseTimings: { where: { kind: "ACTIVE", endedAt: null } },
    },
  });

  const withSortKey = workItems.map((wi) => {
    const isRework = wi.state === "REWORK_REQUIRED";

    const assignedTransition = wi.transitions.find(
      (t) => t.to === "ASSIGNED" || t.to === "REWORK_REQUIRED",
    );
    const rejectionTransition = isRework
      ? wi.transitions.find((t) => t.to === "REWORK_REQUIRED")
      : undefined;

    const row: MyQueueRow = {
      workItemId: wi.id,
      orderId: wi.orderId,
      orderNumber: wi.order.number,
      customerName: wi.order.customer.name,
      productTypeName: wi.productType?.name ?? null,
      description: wi.description,
      dueDate: wi.dueDate ?? wi.order.dueDate ?? null,
      priority: wi.order.priority,
      state: wi.state as MyQueueRowState,
      isRework,
      rejectionDetails:
        rejectionTransition?.rejectionCategory
          ? {
              category: rejectionTransition.rejectionCategory,
              explanation: rejectionTransition.reason ?? null,
            }
          : null,
      hasOpenTimer: wi.phaseTimings.length > 0,
    };

    return { row, assignedAt: (assignedTransition?.at ?? wi.createdAt).getTime() };
  });

  // FR-008: urgent first, then oldest assignedAt within each bucket.
  withSortKey.sort((a, b) => {
    if (a.row.priority === "URGENT" && b.row.priority !== "URGENT") return -1;
    if (a.row.priority !== "URGENT" && b.row.priority === "URGENT") return 1;
    return a.assignedAt - b.assignedAt;
  });

  return withSortKey.map(({ row }) => row);
}
