// lateCancellation.ts — Cancelling a Work Item after production started.
// tasks.md T065, contracts/change-control.md §cancelAfterProductionStarted,
// contracts/events-and-ports.md §2–§3, spec FR-024–026.
//
// The only path past the LATE_CANCELLATION_REQUIRED guard: the loss is
// recorded (reason + explicit cost) before the state changes, and handed to
// 052 through the DirectCostPort in the same transaction.

import { z } from "zod";
import { fail, notify, type AuditEntry } from "~/server/core";
import { defineCommand } from "./aspect";
import { LATE_CANCEL_STATES } from "./guards";
import { getDirectCostPort } from "./ports";
import { lockWorkItemInTx } from "./workItemLock";

/** Exact decimal, >= 0, at most 2 dp, fits Decimal(12, 2). Never a float. */
const costSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Cost must be a non-negative amount with at most 2 decimals");

const optionalNoteSchema = z
  .string()
  .trim()
  .transform((s) => (s === "" ? undefined : s))
  .optional();

export const cancelAfterProductionStartedInputSchema = z.object({
  workItemId: z.string().min(1),
  reason: z.string().trim().min(1),
  costIncurred: costSchema,
  producedQuantitySoFar: z.number().int().min(0).optional(),
  costNote: optionalNoteSchema,
});

export type CancelAfterProductionStartedInput = z.input<typeof cancelAfterProductionStartedInputSchema>;

const lateCancelStates: ReadonlySet<string> = new Set(LATE_CANCEL_STATES);

export const cancelAfterProductionStarted = defineCommand({
  action: "workitem.late_cancelled",
  input: cancelAfterProductionStartedInputSchema,
  permission: "order.cancel",
  run: async (ctx) => {
    const { workItemId, reason, costIncurred, producedQuantitySoFar, costNote } = ctx.input;

    // Lock order: ChangeRequest rows first, then the Work Item.
    const pending = await ctx.tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ChangeRequest"
      WHERE "workItemId" = ${workItemId} AND status = 'PENDING'
      FOR UPDATE
    `;
    const item = await lockWorkItemInTx(ctx.tx, workItemId);
    if (!lateCancelStates.has(item.state)) {
      return fail({ code: "LATE_CANCEL_NOT_APPLICABLE" });
    }

    // 1. Close the open request(s): the item they would change is going away.
    const now = new Date();
    const pendingIds = pending.map((r) => r.id);
    if (pendingIds.length > 0) {
      await ctx.tx.changeRequest.updateMany({
        where: { id: { in: pendingIds }, status: "PENDING" },
        data: {
          status: "CLOSED_BY_CANCELLATION",
          decidedById: ctx.actor.userId,
          decidedAt: now,
          decisionNote: reason,
        },
      });
    }

    // 2. The cost record exists before the state changes and before 052 sees it.
    const record = await ctx.tx.lateCancellation.create({
      data: {
        workItemId,
        stateAtCancellation: item.state,
        reason,
        costIncurred,
        producedQuantitySoFar: producedQuantitySoFar ?? null,
        costNote: costNote ?? null,
        createdById: ctx.actor.userId,
      },
      select: { id: true, costIncurred: true, currency: true, createdAt: true },
    });
    const amount = record.costIncurred.toFixed(2);

    // 3. The marker is the only way past the LATE_CANCELLATION_REQUIRED guard.
    //    transitionWorkItem closes the open ACTIVE/QUEUE segments (FR-025).
    await ctx.transition({
      workItemId,
      to: "CANCELLED",
      reason,
      meta: { changeControl: "LATE_CANCELLATION", lateCancellationId: record.id },
    });

    // 4. Hand the loss to 052. A throw rolls the whole cancellation back.
    await getDirectCostPort().recordLateCancellationCost(ctx.tx, {
      lateCancellationId: record.id,
      workItemId,
      orderId: item.orderId,
      amount,
      currency: record.currency,
      reason,
      recordedById: ctx.actor.userId,
      recordedAt: record.createdAt,
    });

    // 5. Tell the order's creator and the department.
    const order = await ctx.tx.order.findUniqueOrThrow({
      where: { id: item.orderId },
      select: { createdById: true },
    });
    await notify(ctx.tx, {
      type: "work_item.late_cancelled",
      entity: { type: "WorkItem", id: workItemId },
      recipients: {
        userIds: [order.createdById],
        departmentIds: item.effectiveDepartmentId ? [item.effectiveDepartmentId] : [],
      },
      payload: {
        workItemId,
        orderId: item.orderId,
        lateCancellationId: record.id,
        stateAtCancellation: item.state,
        amount,
        currency: record.currency,
        reason,
      },
    });

    const closedAudits: AuditEntry[] = pendingIds.map((id) => ({
      action: "change_request.closed_by_cancellation",
      entityType: "ChangeRequest",
      entityId: id,
      before: { status: "PENDING" },
      after: { status: "CLOSED_BY_CANCELLATION", lateCancellationId: record.id },
      reason,
    }));

    return {
      value: { lateCancellationId: record.id },
      audit: [
        {
          action: "workitem.late_cancelled",
          entityType: "WorkItem",
          entityId: workItemId,
          before: { state: item.state },
          after: {
            state: "CANCELLED",
            lateCancellationId: record.id,
            costIncurred: amount,
            currency: record.currency,
            producedQuantitySoFar: producedQuantitySoFar ?? null,
            costNote: costNote ?? null,
          },
          reason,
        },
        ...closedAudits,
      ],
    };
  },
});
