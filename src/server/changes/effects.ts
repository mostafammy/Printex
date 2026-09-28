// effects.ts — Side effects for change control (send-back for customer change).
// tasks.md T036, research.md §8 (specs/016-change-control/research.md).

import type { Actor } from "~/server/auth";
import {
  fail,
  notify,
  transitionOrThrow,
  type TxScope,
  type JsonValue,
  type TransitionOrThrowInput,
  type TransitionOutcome,
} from "~/server/core";
import { createReturnInTx } from "~/server/review";
import { effectiveDepartmentId } from "./recipients";

export interface SendBackCtx extends TxScope {
  readonly actor: Actor;
  readonly transition?: (i: Omit<TransitionOrThrowInput, "actor">) => Promise<TransitionOutcome>;
}

/** The Work Item fields the send-back needs. */
export type SendBackWorkItem = {
  readonly id: string;
  readonly orderId: string;
  readonly requiresDesign: boolean;
  readonly assigneeId: string | null;
  readonly departmentId: string | null;
  readonly productType: { readonly defaultDepartmentId: string | null } | null;
};

const sendBackWorkItemSelect = {
  id: true,
  orderId: true,
  requiresDesign: true,
  assigneeId: true,
  departmentId: true,
  productType: { select: { defaultDepartmentId: true } },
} as const;

export interface SendBackForCustomerChangeInput {
  readonly workItemId: string;
  /** The already-loaded Work Item, when the caller has it; saves a round trip. */
  readonly preloaded?: SendBackWorkItem;
  readonly reason?: string | null;
  readonly originDepartmentId?: string | null;
  readonly meta?: Readonly<Record<string, JsonValue>>;
}

/**
 * Sends a Work Item back to design for customer change inside an existing transaction:
 * 1. ctx.transition to REWORK_REQUIRED with rejectionCategory: CUSTOMER_CHANGE
 * 2. createReturnInTx from ~/server/review
 * 3. notify with work_item.customer_change_returned
 * 4. returns { returnId }
 */
export async function sendBackForCustomerChangeInTx(
  ctx: SendBackCtx,
  input: SendBackForCustomerChangeInput,
): Promise<{ returnId: string }> {
  const item =
    input.preloaded ??
    (await ctx.tx.workItem.findUnique({
      where: { id: input.workItemId },
      select: sendBackWorkItemSelect,
    }));

  if (!item) {
    return fail({
      code: "NOT_FOUND",
      entity: "WorkItem",
      id: input.workItemId,
    });
  }

  // Redesign requires requiresDesign && assigneeId !== null, else REDESIGN_NOT_ALLOWED
  if (!item.requiresDesign || !item.assigneeId) {
    return fail({ code: "REDESIGN_NOT_ALLOWED" });
  }

  // originDepartmentId is the Work Item's effective department, or supplied originDepartmentId
  const originDept = input.originDepartmentId ?? effectiveDepartmentId(item);
  if (!originDept) {
    return fail({ code: "ORIGIN_DEPARTMENT_REQUIRED" });
  }

  const reasonText = input.reason?.trim() ? input.reason.trim() : "Customer change";

  // 1. ctx.transition to REWORK_REQUIRED with CUSTOMER_CHANGE
  if (ctx.transition) {
    await ctx.transition({
      workItemId: input.workItemId,
      to: "REWORK_REQUIRED",
      reason: reasonText,
      rejectionCategory: "CUSTOMER_CHANGE",
      meta: input.meta,
    });
  } else {
    await transitionOrThrow(ctx.tx, {
      workItemId: input.workItemId,
      to: "REWORK_REQUIRED",
      actor: ctx.actor,
      reason: reasonText,
      rejectionCategory: "CUSTOMER_CHANGE",
      meta: input.meta,
    });
  }

  // 2. createReturnInTx from ~/server/review
  const { returnId } = await createReturnInTx(
    ctx.tx,
    ctx.actor,
    input.workItemId,
    {
      category: "CUSTOMER_CHANGE",
      originDepartmentId: originDept,
      assignedToId: item.assigneeId,
      explanation: reasonText,
    },
  );

  // 3. notify with work_item.customer_change_returned
  await notify(ctx.tx, {
    type: "work_item.customer_change_returned",
    entity: { type: "WorkItem", id: input.workItemId },
    recipients: { userIds: [item.assigneeId] },
    payload: {
      workItemId: input.workItemId,
      orderId: item.orderId,
      returnId,
      reason: reasonText,
    },
  });

  // 4. return { returnId }
  return { returnId };
}
