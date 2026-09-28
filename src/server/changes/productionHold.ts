// productionHold.ts — The production hold derived from change requests, and
// its acknowledgment. tasks.md T045, contracts/change-control.md
// §getProductionHold / §acknowledgeSpecRevision, spec FR-012, FR-014.

import { z } from "zod";
import type { Prisma } from "../../../generated/prisma";
import { fail, type AuditEntry } from "~/server/core";
import { defineCommand } from "./aspect";
import { effectiveDepartmentId } from "./recipients";

export type ProductionHold =
  | { readonly kind: "CHANGE_PENDING"; readonly changeRequestId: string }
  | { readonly kind: "REVISION_UNACKNOWLEDGED"; readonly changeRequestId: string };

/** Rows that put a Work Item on hold: a pending request, or an approved revision the floor has not confirmed. */
const holdingRequestsWhere = (workItemId: string): Prisma.ChangeRequestWhereInput => ({
  workItemId,
  OR: [
    { status: "PENDING" },
    { status: "APPROVED", outcome: "CONTINUE_PRODUCTION", productionAcknowledgedAt: null },
  ],
});

/**
 * The Work Item's current production hold, or null. One query.
 * A pending request wins over an unacknowledged revision: it is the newer
 * instruction and must be decided first.
 *
 * Accepts `db` or a `tx` — guards read committed data through `db`.
 */
export async function getProductionHold(
  client: Prisma.TransactionClient,
  workItemId: string,
): Promise<ProductionHold | null> {
  const rows = await client.changeRequest.findMany({
    where: holdingRequestsWhere(workItemId),
    select: { id: true, status: true, decidedAt: true },
    orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }],
  });

  const pending = rows.find((r) => r.status === "PENDING");
  if (pending) {
    return { kind: "CHANGE_PENDING", changeRequestId: pending.id };
  }
  const latestRevision = rows[0];
  if (latestRevision) {
    return { kind: "REVISION_UNACKNOWLEDGED", changeRequestId: latestRevision.id };
  }
  return null;
}

export const acknowledgeSpecRevisionInputSchema = z.object({
  workItemId: z.string().min(1),
});

/**
 * The operator confirms the revised instruction. Clears every unacknowledged
 * CONTINUE_PRODUCTION approval at once (the current instruction supersedes
 * them all). Does not restart the timer — the operator resumes with 014.
 */
export const acknowledgeSpecRevision = defineCommand({
  action: "change_request.acknowledged",
  input: acknowledgeSpecRevisionInputSchema,
  permission: "production.operate",
  authorize: async (ctx) => {
    const item = await ctx.tx.workItem.findUnique({
      where: { id: ctx.input.workItemId },
      select: { departmentId: true, productType: { select: { defaultDepartmentId: true } } },
    });
    if (!item) {
      return fail({ code: "NOT_FOUND", entity: "WorkItem", id: ctx.input.workItemId });
    }
    ctx.check("production.operate", { departmentId: effectiveDepartmentId(item) ?? undefined });
  },
  run: async (ctx) => {
    const { workItemId } = ctx.input;

    const hold = await getProductionHold(ctx.tx, workItemId);
    if (hold?.kind !== "REVISION_UNACKNOWLEDGED") {
      return fail({ code: "NOTHING_TO_ACKNOWLEDGE" });
    }

    const unacknowledged = await ctx.tx.changeRequest.findMany({
      where: {
        workItemId,
        status: "APPROVED",
        outcome: "CONTINUE_PRODUCTION",
        productionAcknowledgedAt: null,
      },
      select: { id: true },
    });

    const now = new Date();
    await ctx.tx.changeRequest.updateMany({
      where: {
        id: { in: unacknowledged.map((r) => r.id) },
        productionAcknowledgedAt: null,
      },
      data: { productionAcknowledgedAt: now, productionAcknowledgedById: ctx.actor.userId },
    });

    const audit = unacknowledged.map(
      (r): AuditEntry => ({
        action: "change_request.acknowledged",
        entityType: "ChangeRequest",
        entityId: r.id,
        after: { productionAcknowledgedAt: now.toISOString() },
      }),
    );
    const [first, ...rest] = audit;
    if (!first) {
      return fail({ code: "NOTHING_TO_ACKNOWLEDGE" });
    }

    return { value: null, audit: [first, ...rest] };
  },
});
