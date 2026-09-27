// adminOverride.ts — Admin override of a Work Item's specification in any
// non-cancelled state. tasks.md T069, contracts/change-control.md
// §adminOverrideSpec, spec FR-027–028.
//
// In production the override is recorded as a change request inserted
// directly as APPROVED (isAdminOverride), and has exactly the effects of
// approveChangeRequest (shared through applyApprovalOutcomeInTx).

import { z } from "zod";
import { fail, notify, type AuditEntry } from "~/server/core";
import { defineCommand } from "./aspect";
import { applyApprovalOutcomeInTx } from "./approvalEffects";
import { sendBackForCustomerChangeInTx, type SendBackCtx } from "./effects";
import {
  canRedesignOnApproval,
  redesignChoice,
  specEditPolicy,
} from "./policy";
import { getProductionHold } from "./productionHold";
import { specPatchSchema } from "./specFields";
import {
  applySpecChangeInTx,
  ensureCurrentSpecVersionInTx,
  type AppliedSpecChange,
} from "./versions";
import {
  lockWorkItemInTx,
  toSendBackWorkItem,
  type LockedWorkItem,
} from "./workItemLock";

const emptyToUndefined = z
  .string()
  .trim()
  .transform((s) => (s === "" ? undefined : s))
  .optional();

export const adminOverrideSpecInputSchema = z.object({
  workItemId: z.string().min(1),
  expectedVersion: z.coerce.number().int().min(1),
  patch: specPatchSchema,
  reason: z.string().trim().min(1),
  outcome: z.enum(["CONTINUE_PRODUCTION", "REDESIGN"]).optional(),
  designChoice: z.enum(["REDESIGN", "KEEP_DESIGN"]).optional(),
  originDepartmentId: emptyToUndefined,
});

export type AdminOverrideSpecInput = z.infer<
  typeof adminOverrideSpecInputSchema
>;

export type AdminOverrideSpecResult = {
  version: number;
  changeRequestId: string | null;
};

function fieldSubsets(applied: AppliedSpecChange) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const c of applied.changes) {
    before[c.field] = c.before;
    after[c.field] = c.after;
  }
  return { before, after };
}

function outcomeRequired(): never {
  return fail({
    code: "VALIDATION",
    issues: [
      {
        path: "outcome",
        message: "An outcome is required while the Work Item is in production.",
      },
    ],
  });
}

function outcomeNotApplicable(): never {
  return fail({
    code: "VALIDATION",
    issues: [
      {
        path: "outcome",
        message:
          "An outcome applies only while the Work Item is in production.",
      },
    ],
  });
}

export const adminOverrideSpec = defineCommand({
  action: "spec.admin_override",
  input: adminOverrideSpecInputSchema,
  permission: "admin.override",
  run: async (ctx) => {
    const {
      workItemId,
      expectedVersion,
      patch,
      reason,
      outcome,
      designChoice,
    } = ctx.input;

    // 1. Lock and refuse before any write.
    const item = await lockWorkItemInTx(ctx.tx, workItemId);
    if (item.state === "CANCELLED") {
      return fail({ code: "WORK_ITEM_LOCKED" });
    }
    const hold = await getProductionHold(ctx.tx, workItemId);
    if (hold?.kind === "CHANGE_PENDING") {
      return fail({ code: "CHANGE_REQUEST_PENDING" });
    }
    if (hold?.kind === "REVISION_UNACKNOWLEDGED") {
      return fail({ code: "REVISION_UNACKNOWLEDGED" });
    }

    const inProduction = item.state === "IN_PRODUCTION";
    if (inProduction && !outcome) {
      return outcomeRequired();
    }
    if (!inProduction && outcome) {
      return outcomeNotApplicable();
    }

    const audit: AuditEntry[] = [];
    let applied: AppliedSpecChange;
    let changeRequestId: string | null = null;

    if (inProduction && outcome) {
      // 2. In production: an APPROVED override request, then the approval effects.
      if (outcome === "REDESIGN" && !canRedesignOnApproval(item)) {
        return fail({ code: "REDESIGN_NOT_ALLOWED" });
      }
      // A stale expectedVersion is refused by applySpecChangeInTx below and rolls this back.
      const current = await ensureCurrentSpecVersionInTx(ctx, workItemId);
      const now = new Date();
      const cr = await ctx.tx.changeRequest.create({
        data: {
          workItemId,
          status: "APPROVED",
          isAdminOverride: true,
          baseSpecVersionId: current.id,
          proposedPatch: patch,
          requestReason: reason,
          requestedById: ctx.actor.userId,
          decidedById: ctx.actor.userId,
          decidedAt: now,
          outcome,
        },
        select: { id: true },
      });
      changeRequestId = cr.id;

      applied = await applyOverride(ctx, item, {
        patch,
        expectedVersion,
        reason,
        changeRequestId,
      });
      await ctx.tx.changeRequest.update({
        where: { id: cr.id },
        data: { resultingSpecVersionId: applied.current.id },
      });

      const { returnId } = await applyApprovalOutcomeInTx(ctx, {
        workItem: item,
        changeRequestId: cr.id,
        outcome,
        version: applied.current.version,
        reason,
      });
      audit.push({
        action: "change_request.approved",
        entityType: "ChangeRequest",
        entityId: cr.id,
        after: {
          status: "APPROVED",
          outcome,
          isAdminOverride: true,
          resultingVersion: applied.current.version,
          returnId,
        },
        reason,
      });
    } else {
      // 3/4. Before production: editSpec's designChoice rule. After production
      // (redesignChoice is FORBIDDEN there): a new version, no state change.
      const choice = redesignChoice(item.state, item.requiresDesign);
      if (choice === "REQUIRED" && !designChoice) {
        return fail({ code: "REDESIGN_CHOICE_REQUIRED" });
      }
      const isRedesign = designChoice === "REDESIGN";
      if (
        isRedesign &&
        (choice === "FORBIDDEN" || !canRedesignOnApproval(item))
      ) {
        return fail({ code: "REDESIGN_NOT_ALLOWED" });
      }
      if (
        isRedesign &&
        !(ctx.input.originDepartmentId ?? item.effectiveDepartmentId)
      ) {
        return fail({ code: "ORIGIN_DEPARTMENT_REQUIRED" });
      }

      applied = await applyOverride(ctx, item, {
        patch,
        expectedVersion,
        reason,
        changeRequestId: null,
      });

      if (isRedesign) {
        await sendBackForCustomerChangeInTx(ctx, {
          workItemId,
          preloaded: toSendBackWorkItem(item),
          reason,
          originDepartmentId: ctx.input.originDepartmentId,
        });
        audit.push({
          action: "workitem.returned_for_customer_change",
          entityType: "WorkItem",
          entityId: workItemId,
          reason,
        });
      } else if (item.assigneeId && specEditPolicy(item.state) === "DIRECT") {
        // Before production the designer is told, as with editSpec.
        await notify(ctx.tx, {
          type: "work_item.customer_modification",
          entity: { type: "WorkItem", id: workItemId },
          recipients: { userIds: [item.assigneeId] },
          payload: {
            workItemId,
            orderId: item.orderId,
            version: applied.current.version,
            reason,
            changedFields: applied.changes.map((c) => c.field),
          },
        });
      }
    }

    const { before, after } = fieldSubsets(applied);
    const value: AdminOverrideSpecResult = {
      version: applied.current.version,
      changeRequestId,
    };
    return {
      value,
      audit: [
        {
          action: "spec.admin_override",
          entityType: "WorkItem",
          entityId: workItemId,
          before,
          after,
          reason,
        },
        ...audit,
      ],
    };
  },
});

/** The version write both paths share: origin ADMIN_OVERRIDE, reusing the row lock. */
async function applyOverride(
  ctx: SendBackCtx,
  item: LockedWorkItem,
  input: {
    readonly patch: AdminOverrideSpecInput["patch"];
    readonly expectedVersion: number;
    readonly reason: string;
    readonly changeRequestId: string | null;
  },
): Promise<AppliedSpecChange> {
  const applied = await applySpecChangeInTx(ctx, {
    workItemId: item.id,
    actorId: ctx.actor.userId,
    origin: "ADMIN_OVERRIDE",
    patch: input.patch,
    expected: { version: input.expectedVersion },
    reason: input.reason,
    changeRequestId: input.changeRequestId,
    ifUnchanged: "fail",
    lockedWorkItem: item,
  });
  if (!applied) {
    return fail({ code: "NO_CHANGES" });
  }
  return applied;
}
