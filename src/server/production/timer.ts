// timer.ts — startProduction, pauseProduction, resumeProduction (US3),
// acknowledgeFileRevision (US7). contracts/production.md.
//
// Mirrors 012's src/server/designers/timer.ts shape: transitionWorkItem's
// own step 5 already closes the outgoing phase's open QUEUE segment as part
// of every transition — do NOT also manually close a QUEUE segment here.

import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  transitionWorkItem,
  openSegment,
  closeOpenSegment,
  asUserId,
  asWorkItemId,
} from "~/server/core";
import type { Actor as CoreActor, DomainError } from "~/server/core";
import { getProductionHold } from "~/server/changes";
import { DomainProductionError } from "./errors";
import { effectiveDepartmentId } from "./department";

function toCoreActor(actor: Actor): CoreActor {
  return { userId: asUserId(actor.userId), roles: actor.roles, departmentIds: actor.departmentIds };
}

/** Mirrors 012/013's own WorkItemTransitionError — surfaces transitionWorkItem's Result unchanged. */
class WorkItemTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemTransitionError";
    this.error = error;
  }
}

async function authorizeForWorkItem(
  tx: Prisma.TransactionClient,
  actor: Actor,
  workItemId: string,
): Promise<{ id: string; state: string; pendingFileRevisionAt: Date | null }> {
  const workItem = await tx.workItem.findUnique({
    where: { id: workItemId },
    include: { productType: { select: { defaultDepartmentId: true } } },
  });
  if (!workItem) {
    throw new DomainProductionError("WORK_ITEM_NOT_FOUND", `Work Item ${workItemId} does not exist.`);
  }
  authorize(actor, "production.operate", {
    departmentId: effectiveDepartmentId(workItem) ?? undefined,
  });
  return workItem;
}

// ── startProduction ─────────────────────────────────────────────────────

export async function startProduction(actor: Actor, workItemId: string): Promise<void> {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workItem = await authorizeForWorkItem(tx, actor, workItemId);
    if (workItem.state !== "READY_FOR_PRODUCTION") {
      throw new DomainProductionError(
        "NOT_READY_FOR_PRODUCTION",
        `Work Item state ${workItem.state} is not READY_FOR_PRODUCTION.`,
      );
    }

    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "IN_PRODUCTION",
      actor: toCoreActor(actor),
    });
    if (!result.ok) {
      throw new WorkItemTransitionError(result.error);
    }

    await openSegment(tx, {
      workItemId: asWorkItemId(workItemId),
      phase: "IN_PRODUCTION",
      kind: "ACTIVE",
      userId: asUserId(actor.userId),
    });

    await audit.record(tx, {
      action: "workitem.production_started",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
    });
  });
}

// ── pauseProduction ──────────────────────────────────────────────────────

export async function pauseProduction(actor: Actor, workItemId: string): Promise<void> {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await authorizeForWorkItem(tx, actor, workItemId);

    // No-op if nothing is open, no state change.
    await closeOpenSegment(tx, { workItemId: asWorkItemId(workItemId), kind: "ACTIVE" });

    await audit.record(tx, {
      action: "workitem.production_paused",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
    });
  });
}

// ── resumeProduction ─────────────────────────────────────────────────────

export async function resumeProduction(actor: Actor, workItemId: string): Promise<void> {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workItem = await authorizeForWorkItem(tx, actor, workItemId);

    // research.md §4, US7, FR-013: a plain field check, not a guard — resuming
    // a paused timer is not itself a state transition.
    if (workItem.pendingFileRevisionAt !== null) {
      throw new DomainProductionError(
        "PENDING_FILE_REVISION",
        "A newer approved file must be acknowledged before production can resume.",
      );
    }

    // 016 FR-012/FR-014: same kind of plain check — a pending change request
    // or an unacknowledged revised instruction keeps the timer stopped.
    if ((await getProductionHold(tx, workItemId)) !== null) {
      throw new DomainProductionError(
        "CHANGE_HOLD",
        "A specification change is pending or unacknowledged; production cannot resume.",
      );
    }

    await openSegment(tx, {
      workItemId: asWorkItemId(workItemId),
      phase: "IN_PRODUCTION",
      kind: "ACTIVE",
      userId: asUserId(actor.userId),
    });

    await audit.record(tx, {
      action: "workitem.production_resumed",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
    });
  });
}

// ── acknowledgeFileRevision (US7) ────────────────────────────────────────

export async function acknowledgeFileRevision(actor: Actor, workItemId: string): Promise<void> {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await authorizeForWorkItem(tx, actor, workItemId);

    await tx.workItem.update({
      where: { id: workItemId },
      data: { pendingFileRevisionAt: null },
    });

    await audit.record(tx, {
      action: "workitem.file_revision_acknowledged",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
    });
  });
}
