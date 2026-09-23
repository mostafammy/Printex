// completion.ts — completeProduction (US4). contracts/production.md,
// data-model.md's Validation rules.

import { z } from "zod";
import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { transitionWorkItem, closeOpenSegment, asUserId, asWorkItemId } from "~/server/core";
import type { Actor as CoreActor, DomainError } from "~/server/core";
import { DomainProductionError } from "./errors";
import { effectiveDepartmentId } from "./department";

function toCoreActor(actor: Actor): CoreActor {
  return { userId: asUserId(actor.userId), roles: actor.roles, departmentIds: actor.departmentIds };
}

/** Mirrors 012/013/014-timer's own WorkItemTransitionError. */
class WorkItemTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemTransitionError";
    this.error = error;
  }
}

export const completeProductionInputSchema = z.object({
  producedQuantity: z.number().int().positive(),
  notes: z.string().optional(),
});

export interface CompleteProductionInput {
  producedQuantity: number;
  notes?: string;
}

/**
 * FR-006/FR-007/FR-012: requires a positive `producedQuantity`, and — for a
 * Work Item routed to an `isExternalProduction` department — a
 * `VendorProductionRecord` with a non-null `receivedAt` (US6 gate). Closes
 * any open `ACTIVE` timer segment, transitions to `PRODUCTION_COMPLETED`,
 * and stamps the completing operator + timestamp.
 */
export async function completeProduction(
  actor: Actor,
  workItemId: string,
  input: CompleteProductionInput,
): Promise<void> {
  // Validate before opening a transaction (data-model.md: "a bad submission
  // never reaches the DB").
  const parsed = completeProductionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainProductionError(
      "MISSING_PRODUCED_QUANTITY",
      "A positive produced quantity is required to complete production.",
    );
  }

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workItem = await tx.workItem.findUnique({
      where: { id: workItemId },
      include: { productType: { select: { defaultDepartmentId: true } }, department: true },
    });
    if (!workItem) {
      throw new DomainProductionError("WORK_ITEM_NOT_FOUND", `Work Item ${workItemId} does not exist.`);
    }
    authorize(actor, "production.operate", {
      departmentId: effectiveDepartmentId(workItem) ?? undefined,
    });

    if (workItem.department?.isExternalProduction) {
      const receivedRecord = await tx.vendorProductionRecord.findFirst({
        where: { workItemId, receivedAt: { not: null } },
      });
      if (!receivedRecord) {
        throw new DomainProductionError(
          "VENDOR_RECEIPT_REQUIRED",
          "Completion is blocked until the vendor receipt step is recorded.",
        );
      }
    }

    await closeOpenSegment(tx, { workItemId: asWorkItemId(workItemId), kind: "ACTIVE" });

    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "PRODUCTION_COMPLETED",
      actor: toCoreActor(actor),
    });
    if (!result.ok) {
      throw new WorkItemTransitionError(result.error);
    }

    await tx.workItem.update({
      where: { id: workItemId },
      data: { producedQuantity: parsed.data.producedQuantity, productionNotes: parsed.data.notes },
    });

    await audit.record(tx, {
      action: "workitem.production_completed",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
      after: { producedQuantity: parsed.data.producedQuantity, notes: parsed.data.notes },
    });
  });
}
