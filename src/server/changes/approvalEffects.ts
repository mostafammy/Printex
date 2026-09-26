// approvalEffects.ts — What follows an approved in-production change, shared
// by approveChangeRequest (T048) and adminOverrideSpec (T069, FR-028) so the
// two paths cannot drift. contracts/change-control.md §approveChangeRequest step 4.

import { notify, type JsonValue } from "~/server/core";
import { sendBackForCustomerChangeInTx, type SendBackCtx } from "./effects";
import { toSendBackWorkItem, type LockedWorkItem } from "./workItemLock";

export type ApprovalOutcome = "CONTINUE_PRODUCTION" | "REDESIGN";

export interface ApprovalEffectsInput {
  readonly workItem: LockedWorkItem;
  readonly changeRequestId: string;
  readonly outcome: ApprovalOutcome;
  readonly version: number;
  readonly reason: string;
}

/**
 * CONTINUE_PRODUCTION: the floor is told about the revised instruction; the
 * hold becomes REVISION_UNACKNOWLEDGED until an operator acknowledges it.
 * REDESIGN: the Work Item goes back to design for a customer change. The
 * approval marker lets the transition past the CHANGE_HOLD guard.
 */
export async function applyApprovalOutcomeInTx(
  ctx: SendBackCtx,
  input: ApprovalEffectsInput,
): Promise<{ returnId: string | null }> {
  const { workItem, changeRequestId } = input;

  if (input.outcome === "REDESIGN") {
    const meta: Record<string, JsonValue> = {
      changeControl: "CHANGE_REQUEST_APPROVAL",
      changeRequestId,
    };
    const { returnId } = await sendBackForCustomerChangeInTx(ctx, {
      workItemId: workItem.id,
      preloaded: toSendBackWorkItem(workItem),
      reason: input.reason,
      meta,
    });
    await ctx.tx.changeRequest.update({ where: { id: changeRequestId }, data: { returnId } });
    return { returnId };
  }

  await notify(ctx.tx, {
    type: "work_item.revised_instruction",
    entity: { type: "WorkItem", id: workItem.id },
    recipients: {
      departmentIds: workItem.effectiveDepartmentId ? [workItem.effectiveDepartmentId] : [],
    },
    payload: {
      workItemId: workItem.id,
      orderId: workItem.orderId,
      changeRequestId,
      version: input.version,
    },
  });
  return { returnId: null };
}
