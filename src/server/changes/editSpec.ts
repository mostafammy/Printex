// editSpec.ts — Direct specification editing command.
// tasks.md T037, contracts/change-control.md §editSpec.

import { z } from "zod";
import { assertNever, fail, notify, type AuditEntry } from "~/server/core";
import { defineCommand } from "./aspect";
import { specPatchSchema } from "./specFields";
import { specEditPolicy, redesignChoice } from "./policy";
import { applySpecChangeInTx } from "./versions";
import { sendBackForCustomerChangeInTx } from "./effects";
import { effectiveDepartmentId, usersWithPermission } from "./recipients";

export const editSpecInputSchema = z.object({
  workItemId: z.string().min(1),
  expectedVersion: z.coerce.number().int().min(1),
  patch: specPatchSchema,
  reason: z
    .string()
    .trim()
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
  designChoice: z.enum(["REDESIGN", "KEEP_DESIGN"]).optional(),
  originDepartmentId: z
    .string()
    .trim()
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
});

export type EditSpecInput = z.infer<typeof editSpecInputSchema>;

export type EditSpecResult = {
  version: number;
  redesigned: boolean;
};

/**
 * editSpec — Direct specification editing command, gated by specEditPolicy.
 * Order:
 *  1. Static permission (order.edit)
 *  2. Policy check BEFORE any write (US2-3, FR-010)
 *  3. Redesign choice (REDESIGN_CHOICE_REQUIRED / REDESIGN_NOT_ALLOWED / ORIGIN_DEPARTMENT_REQUIRED)
 *  4. applySpecChangeInTx (origin DIRECT_EDIT, ifUnchanged: "fail")
 *  5. Redesign effect (sendBackForCustomerChangeInTx) OR customer_modification notify
 *  6. WAITING_REVIEW reviewer notify (design.review holders)
 */
export const editSpec = defineCommand({
  action: "spec.edited",
  input: editSpecInputSchema,
  permission: "order.edit",
  run: async (ctx) => {
    // 1. Load WorkItem
    const item = await ctx.tx.workItem.findUnique({
      where: { id: ctx.input.workItemId },
      select: {
        id: true,
        orderId: true,
        state: true,
        requiresDesign: true,
        assigneeId: true,
        departmentId: true,
        productType: { select: { defaultDepartmentId: true } },
      },
    });

    if (!item) {
      return fail({
        code: "NOT_FOUND",
        entity: "WorkItem",
        id: ctx.input.workItemId,
      });
    }

    // 2. Policy check BEFORE any write (US2-3, FR-010)
    const policy = specEditPolicy(item.state);
    switch (policy) {
      case "DIRECT":
        break;
      case "CHANGE_REQUEST":
        return fail({ code: "CHANGE_REQUEST_REQUIRED" });
      case "ADMIN_ONLY":
        return fail({ code: "ADMIN_OVERRIDE_REQUIRED" });
      case "LOCKED":
        return fail({ code: "WORK_ITEM_LOCKED" });
      default:
        return assertNever(policy);
    }

    // 3. Redesign choice check
    const choice = redesignChoice(item.state, item.requiresDesign);
    if (choice === "REQUIRED") {
      if (!ctx.input.designChoice) {
        return fail({ code: "REDESIGN_CHOICE_REQUIRED" });
      }
    } else if (choice === "FORBIDDEN") {
      if (ctx.input.designChoice === "REDESIGN") {
        return fail({ code: "REDESIGN_NOT_ALLOWED" });
      }
    }

    const isRedesign = ctx.input.designChoice === "REDESIGN";

    if (isRedesign) {
      if (!item.requiresDesign || !item.assigneeId) {
        return fail({ code: "REDESIGN_NOT_ALLOWED" });
      }
      const effDept = effectiveDepartmentId(item);
      const originDept = ctx.input.originDepartmentId ?? effDept;
      if (!originDept) {
        return fail({ code: "ORIGIN_DEPARTMENT_REQUIRED" });
      }
    }

    // 4. applySpecChangeInTx (origin DIRECT_EDIT)
    const applied = await applySpecChangeInTx(ctx, {
      workItemId: ctx.input.workItemId,
      actorId: ctx.actor.userId,
      origin: "DIRECT_EDIT",
      patch: ctx.input.patch,
      expected: { version: ctx.input.expectedVersion },
      reason: ctx.input.reason ?? null,
      ifUnchanged: "fail",
    });

    if (!applied) {
      return fail({ code: "NO_CHANGES" });
    }

    // 5. Redesign effect or customer_modification notify
    if (isRedesign) {
      await sendBackForCustomerChangeInTx(ctx, {
        workItemId: ctx.input.workItemId,
        preloaded: item,
        reason: ctx.input.reason,
        originDepartmentId: ctx.input.originDepartmentId,
      });
    } else {
      if (item.assigneeId) {
        await notify(ctx.tx, {
          type: "work_item.customer_modification",
          entity: { type: "WorkItem", id: ctx.input.workItemId },
          recipients: { userIds: [item.assigneeId] },
          payload: {
            workItemId: ctx.input.workItemId,
            orderId: item.orderId,
            version: applied.current.version,
            reason: ctx.input.reason ?? null,
            changedFields: applied.changes.map((c) => c.field),
          },
        });
      }
    }

    // 6. WAITING_REVIEW reviewer notify (FR-008)
    if (!isRedesign && item.state === "WAITING_REVIEW") {
      const reviewerIds = await usersWithPermission(ctx.tx, "design.review");
      if (reviewerIds.length > 0) {
        await notify(ctx.tx, {
          type: "work_item.customer_modification",
          entity: { type: "WorkItem", id: ctx.input.workItemId },
          recipients: { userIds: reviewerIds },
          payload: {
            workItemId: ctx.input.workItemId,
            orderId: item.orderId,
            version: applied.current.version,
            reason: ctx.input.reason ?? null,
            changedFields: applied.changes.map((c) => c.field),
          },
        });
      }
    }

    // 7. Audit: spec.edited with changed-field subset (+ workitem.returned_for_customer_change on redesign)
    const beforeAudit: Record<string, unknown> = {};
    const afterAudit: Record<string, unknown> = {};
    for (const c of applied.changes) {
      beforeAudit[c.field] = c.before;
      afterAudit[c.field] = c.after;
    }

    const auditEntries: AuditEntry[] = [
      {
        action: "spec.edited",
        entityType: "WorkItem",
        entityId: ctx.input.workItemId,
        before: beforeAudit,
        after: afterAudit,
        reason: ctx.input.reason ?? undefined,
      },
    ];

    if (isRedesign) {
      auditEntries.push({
        action: "workitem.returned_for_customer_change",
        entityType: "WorkItem",
        entityId: ctx.input.workItemId,
        reason: ctx.input.reason ?? undefined,
      });
    }

    return {
      value: {
        version: applied.current.version,
        redesigned: isRedesign,
      },
      audit: auditEntries as unknown as readonly [AuditEntry, ...AuditEntry[]],
    };
  },
});
