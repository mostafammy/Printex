// queue.ts — getOperatorQueue (US1), routeToDepartment (FR-001, research.md §8).
// contracts/production.md.
//
// Ordering rule is research.md §6 — the SAME urgent-first, oldest-first-
// within-bucket rule 012's getMyQueue and 013's getReviewQueue already use,
// duplicated here rather than shared (plan.md "Structure Decision").

import { db } from "~/server/db";
import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { paginateQuery } from "~/server/pagination";
import type { PageInput, PageResult } from "~/server/pagination";
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
  const page = await getOperatorQueuePage(actor, { page: 1, pageSize: 100 });
  return [...page.rows];
}

function buildOperatorQueueWhere(actor: Actor) {
  const deptIds = [...actor.departmentIds];
  return {
    state: "READY_FOR_PRODUCTION" as const,
    OR: [
      { departmentId: { in: deptIds } },
      { departmentId: null, productType: { defaultDepartmentId: { in: deptIds } } },
    ],
  };
}

export async function getOperatorQueuePage(
  actor: Actor,
  input: PageInput = {},
): Promise<PageResult<ProductionQueueRow>> {
  authorize(actor, "production.operate");
  const where = buildOperatorQueueWhere(actor);

  return paginateQuery(input, async (skip, take) => {
    const items = await db.workItem.findMany({
      where,
      orderBy: [{ order: { priority: "desc" } }, { createdAt: "asc" }],
      skip,
      take,
      include: {
        order: { include: { customer: { select: { name: true } } } },
        productType: { select: { name: true, defaultDepartmentId: true } },
        transitions: { where: { to: "READY_FOR_PRODUCTION" }, orderBy: { at: "desc" }, take: 1 },
      },
    });

    return items.map((wi) => {
      const enteredAt = wi.transitions[0]?.at ?? wi.createdAt;
      return {
        workItemId: wi.id,
        orderId: wi.orderId,
        orderNumber: wi.order.number,
        customerName: wi.order.customer.name,
        productTypeName: wi.productType?.name ?? null,
        departmentId: effectiveDepartmentId(wi) ?? "",
        priority: wi.order.priority,
        enteredQueueAt: enteredAt,
        hasPendingFileRevision: wi.pendingFileRevisionAt !== null,
      };
    });
  });
}

export async function getOperatorQueueStats(actor: Actor): Promise<{
  totalCount: number;
  urgentCount: number;
  revisedCount: number;
}> {
  authorize(actor, "production.operate");
  const where = buildOperatorQueueWhere(actor);
  const [totalCount, urgentCount, revisedCount] = await Promise.all([
    db.workItem.count({ where }),
    db.workItem.count({ where: { ...where, order: { priority: "URGENT" } } }),
    db.workItem.count({ where: { ...where, pendingFileRevisionAt: { not: null } } }),
  ]);
  return { totalCount, urgentCount, revisedCount };
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
