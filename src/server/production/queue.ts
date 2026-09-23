// queue.ts — getOperatorQueue (US1), routeToDepartment (FR-001, research.md §8).
// contracts/production.md.
//
// Ordering rule is research.md §6 — the SAME urgent-first, oldest-first-
// within-bucket rule 012's getMyQueue and 013's getReviewQueue already use,
// duplicated here rather than shared (plan.md "Structure Decision").

import { db } from "~/server/db";
import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { DomainProductionError } from "./errors";
import { effectiveDepartmentId } from "./department";

export interface ProductionQueueRow {
  workItemId: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  productTypeName: string | null;
  departmentId: string;
  priority: "NORMAL" | "URGENT";
  enteredQueueAt: Date;
  hasPendingFileRevision: boolean;
}

export async function getOperatorQueue(actor: Actor): Promise<ProductionQueueRow[]> {
  authorize(actor, "production.operate");

  const workItems = await db.workItem.findMany({
    where: { state: "READY_FOR_PRODUCTION" },
    include: {
      order: { include: { customer: { select: { name: true } } } },
      productType: { select: { name: true, defaultDepartmentId: true } },
      transitions: { orderBy: { at: "desc" } },
    },
  });

  const scoped = workItems
    .map((wi) => ({ wi, departmentId: effectiveDepartmentId(wi) }))
    .filter(
      (entry): entry is typeof entry & { departmentId: string } =>
        entry.departmentId !== null && actor.departmentIds.includes(entry.departmentId),
    );

  const rows = scoped.map(({ wi, departmentId }) => {
    const enteredQueueTransition = wi.transitions.find((t) => t.to === "READY_FOR_PRODUCTION");
    const enteredQueueAt = enteredQueueTransition?.at ?? wi.createdAt;

    const row: ProductionQueueRow = {
      workItemId: wi.id,
      orderId: wi.orderId,
      orderNumber: wi.order.number,
      customerName: wi.order.customer.name,
      productTypeName: wi.productType?.name ?? null,
      departmentId,
      priority: wi.order.priority,
      enteredQueueAt,
      hasPendingFileRevision: wi.pendingFileRevisionAt !== null,
    };

    return { row, sortKey: enteredQueueAt.getTime() };
  });

  // research.md §6: urgent first, then oldest enteredQueueAt within each
  // bucket — identical comparator to 012/013's queues.
  rows.sort((a, b) => {
    if (a.row.priority === "URGENT" && b.row.priority !== "URGENT") return -1;
    if (a.row.priority !== "URGENT" && b.row.priority === "URGENT") return 1;
    return a.sortKey - b.sortKey;
  });

  return rows.map(({ row }) => row);
}

/**
 * FR-001: Head Designer/Reception override the department a Work Item routes
 * to, any time before production starts. Reuses `workitem.assign_designer`
 * (seeded to RECEPTION by default, optable-in for HEAD_DESIGNER — the same
 * two roles FR-001 names) rather than a new Permission key.
 */
export async function routeToDepartment(
  actor: Actor,
  workItemId: string,
  departmentId: string,
): Promise<void> {
  authorize(actor, "workitem.assign_designer");

  const workItem = await db.workItem.findUnique({ where: { id: workItemId } });
  if (!workItem) {
    throw new DomainProductionError("WORK_ITEM_NOT_FOUND", "Work Item not found");
  }
  if (workItem.state === "IN_PRODUCTION" || workItem.state === "PRODUCTION_COMPLETED") {
    throw new DomainProductionError(
      "PRODUCTION_ALREADY_STARTED",
      "Department cannot be changed once production has started",
    );
  }

  await db.workItem.update({ where: { id: workItemId }, data: { departmentId } });
}
