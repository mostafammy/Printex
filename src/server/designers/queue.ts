// queue.ts — getMyQueue (US3). contracts/designer-assignment.md.
//
// No `authorize()` beyond an authenticated actor — mirrors 011's
// `listReceptionQueue`/`getOrderDetail` rationale (every role can have a
// queue; rows are scoped by `assigneeId = actor.userId` below, not by
// permission).

import { db } from "~/server/db";
import type { Actor } from "~/server/auth";
import type { RejectionCategory } from "~/server/core";
import { paginateQuery } from "~/server/pagination";
import type { PageInput, PageResult } from "~/server/pagination";

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

export async function getMyQueuePage(
  actor: Actor,
  input: PageInput = {},
): Promise<PageResult<MyQueueRow>> {
  const where = { assigneeId: actor.userId, state: { in: [...MY_QUEUE_STATES] } };

  return paginateQuery(input, async (skip, take) => {
    const workItems = await db.workItem.findMany({
      where,
      orderBy: [{ order: { priority: "desc" } }, { createdAt: "asc" }],
      skip,
      take,
      include: {
        order: { include: { customer: { select: { name: true } } } },
        productType: { select: { name: true } },
        transitions: { orderBy: { at: "desc" } },
        phaseTimings: { where: { kind: "ACTIVE", endedAt: null } },
      },
    });

    return workItems.map((wi) => {
      const isRework = wi.state === "REWORK_REQUIRED";
      const rejection = isRework
        ? wi.transitions.find((t) => t.to === "REWORK_REQUIRED")
        : undefined;

      return {
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
        rejectionDetails: rejection?.rejectionCategory
          ? { category: rejection.rejectionCategory, explanation: rejection.reason ?? null }
          : null,
        hasOpenTimer: wi.phaseTimings.length > 0,
      };
    });
  });
}

export async function getMyQueue(actor: Actor): Promise<MyQueueRow[]> {
  const page = await getMyQueuePage(actor, { page: 1, pageSize: 100 });
  return [...page.rows];
}

export async function getMyQueueStats(actor: Actor): Promise<{
  totalCount: number;
  urgentCount: number;
  reworkCount: number;
}> {
  const [totalCount, urgentCount, reworkCount] = await Promise.all([
    db.workItem.count({
      where: { assigneeId: actor.userId, state: { in: [...MY_QUEUE_STATES] } },
    }),
    db.workItem.count({
      where: {
        assigneeId: actor.userId,
        state: { in: [...MY_QUEUE_STATES] },
        order: { priority: "URGENT" },
      },
    }),
    db.workItem.count({
      where: {
        assigneeId: actor.userId,
        state: "REWORK_REQUIRED",
      },
    }),
  ]);

  return { totalCount, urgentCount, reworkCount };
}
