// sendBack.ts — sendBackToDesign (US5). contracts/production.md, research.md
// §2 (new IN_PRODUCTION -> REWORK_REQUIRED edge), §3 (createReturnInTx reuse).

import { z } from "zod";
import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { transitionWorkItem, closeOpenSegment, asUserId, asWorkItemId } from "~/server/core";
import type { Actor as CoreActor, DomainError } from "~/server/core";
import { notify } from "~/server/core/notifications/notify";
import { createReturnInTx } from "~/server/review";
// Registers 016's transition guards on every path that transitions (research §18).
import "~/server/changes";
import { DomainProductionError } from "./errors";
import { effectiveDepartmentId } from "./department";

function toCoreActor(actor: Actor): CoreActor {
  return { userId: asUserId(actor.userId), roles: actor.roles, departmentIds: actor.departmentIds };
}

class WorkItemTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemTransitionError";
    this.error = error;
  }
}

const sendBackInputSchema = z.object({
  reason: z.string().trim().min(1),
});

export interface SendBackToDesignInput {
  reason: string;
}

export async function sendBackToDesign(
  actor: Actor,
  workItemId: string,
  input: SendBackToDesignInput,
): Promise<{ returnId: string }> {
  // Validated BEFORE opening a transaction (mirrors 013's rejectDesign) — a
  // bad submission never even reaches the DB. Throws ZodError uncaught, same
  // convention as review.ts's rejectDesignInputSchema.parse().
  const parsed = sendBackInputSchema.parse(input);

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workItem = await tx.workItem.findUnique({
      where: { id: workItemId },
      include: { productType: { select: { defaultDepartmentId: true } } },
    });
    if (!workItem) {
      throw new DomainProductionError("WORK_ITEM_NOT_FOUND", `Work Item ${workItemId} does not exist.`);
    }
    const departmentId = effectiveDepartmentId(workItem);
    authorize(actor, "production.operate", { departmentId: departmentId ?? undefined });
    if (!departmentId) {
      throw new DomainProductionError("WORK_ITEM_NOT_FOUND", "Work Item has no effective department");
    }

    await closeOpenSegment(tx, { workItemId: asWorkItemId(workItemId), kind: "ACTIVE" });

    const transitionResult = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "REWORK_REQUIRED",
      actor: toCoreActor(actor),
      reason: parsed.reason,
      rejectionCategory: "PRODUCTION_ISSUE",
    });
    if (!transitionResult.ok) {
      throw new WorkItemTransitionError(transitionResult.error);
    }

    const { returnId } = await createReturnInTx(tx, actor, workItemId, {
      category: "PRODUCTION_ISSUE",
      originDepartmentId: departmentId,
      assignedToId: workItem.assigneeId ?? actor.userId,
      explanation: parsed.reason,
    });

    if (workItem.assigneeId) {
      await notify(tx, {
        type: "workitem.rejected",
        entity: { type: "WorkItem", id: workItemId },
        recipients: { userIds: [workItem.assigneeId] },
        payload: { returnId, category: "PRODUCTION_ISSUE" },
      });
    }

    await audit.record(tx, {
      action: "workitem.sent_back_to_design",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
      after: { returnId, reason: parsed.reason },
    });

    return { returnId };
  });
}
