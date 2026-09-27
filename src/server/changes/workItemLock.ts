// workItemLock.ts — The Work Item row lock every change-control writer takes
// first (contracts/change-control.md §applySpecChangeInTx step 1). One
// statement both locks the row and loads what the commands decide on.

import type { Prisma } from "../../../generated/prisma";
import { fail, type WorkItemState } from "~/server/core";

export type LockedWorkItem = {
  readonly id: string;
  readonly orderId: string;
  readonly state: WorkItemState;
  readonly requiresDesign: boolean;
  readonly assigneeId: string | null;
  readonly departmentId: string | null;
  /** `departmentId ?? productType.defaultDepartmentId` (research §8). */
  readonly effectiveDepartmentId: string | null;
};

/** SELECT … FOR UPDATE on the Work Item. Refuses with NOT_FOUND. */
export async function lockWorkItemInTx(
  tx: Prisma.TransactionClient,
  workItemId: string,
): Promise<LockedWorkItem> {
  const [row] = await tx.$queryRaw<LockedWorkItem[]>`
    SELECT w.id, w."orderId", w.state, w."requiresDesign", w."assigneeId", w."departmentId",
           COALESCE(w."departmentId", pt."defaultDepartmentId") AS "effectiveDepartmentId"
    FROM "WorkItem" w
    LEFT JOIN "ProductType" pt ON pt.id = w."productTypeId"
    WHERE w.id = ${workItemId}
    FOR UPDATE OF w
  `;
  if (!row) {
    return fail({ code: "NOT_FOUND", entity: "WorkItem", id: workItemId });
  }
  return row;
}

/**
 * The shape `sendBackForCustomerChangeInTx` accepts as `preloaded`. The
 * effective department is already resolved, so it is carried as
 * `departmentId` with no product-type fallback.
 */
export function toSendBackWorkItem(item: LockedWorkItem) {
  return {
    id: item.id,
    orderId: item.orderId,
    requiresDesign: item.requiresDesign,
    assigneeId: item.assigneeId,
    departmentId: item.effectiveDepartmentId,
    productType: null,
  };
}
