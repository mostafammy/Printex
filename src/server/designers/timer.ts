// timer.ts — startTimer, pauseTimer, phaseDurations (US3).
// contracts/designer-assignment.md, research.md §2 (PhaseTiming/QUEUE-segment
// addendum — read carefully before touching this file).

import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  transitionWorkItem,
  openSegment,
  closeOpenSegment,
  calculatePhaseDurationMs,
  asUserId,
  asWorkItemId,
} from "~/server/core";
import type { Actor as CoreActor, DomainError, WorkItemState } from "~/server/core";
import { DomainDesignerError } from "./errors";

function toCoreActor(actor: Actor): CoreActor {
  return { userId: asUserId(actor.userId), roles: actor.roles, departmentIds: actor.departmentIds };
}

/**
 * Surfaces `transitionWorkItem`'s own `Result` error unchanged, mirroring
 * `src/server/orders/cancelOrder.ts`'s `WorkItemTransitionError` — this
 * should be unreachable in practice (the guards below only call
 * `transitionWorkItem` on an edge already known to be legal), but is kept so
 * a genuine concurrency conflict surfaces as a real error instead of being
 * silently swallowed.
 */
class WorkItemTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemTransitionError";
    this.error = error;
  }
}

const TIMEABLE_STATES: readonly string[] = ["ASSIGNED", "REWORK_REQUIRED", "IN_DESIGN"];

// ── startTimer ───────────────────────────────────────────────────────────

export async function startTimer(actor: Actor, workItemId: string): Promise<void> {
  authorize(actor, "design.work");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workItem = await tx.workItem.findUnique({ where: { id: workItemId } });
    if (!workItem) {
      throw new DomainDesignerError("WORK_ITEM_NOT_FOUND", `Work Item ${workItemId} does not exist.`);
    }
    if (workItem.assigneeId !== actor.userId) {
      throw new DomainDesignerError("NOT_ASSIGNEE", "Only the assigned designer may start this timer.");
    }
    if (!TIMEABLE_STATES.includes(workItem.state)) {
      throw new DomainDesignerError(
        "NOT_TIMEABLE",
        `Work Item state ${workItem.state} cannot be timed.`,
      );
    }

    // FR-012: one active timer per designer — close any OTHER Work Item's
    // open ACTIVE segment for this same designer before opening a new one.
    const otherOpenSegment = await tx.phaseTiming.findFirst({
      where: {
        userId: actor.userId,
        kind: "ACTIVE",
        endedAt: null,
        workItemId: { not: workItemId },
      },
    });
    if (otherOpenSegment) {
      await closeOpenSegment(tx, {
        workItemId: asWorkItemId(otherOpenSegment.workItemId),
        kind: "ACTIVE",
      });
    }

    // research.md §2 addendum: transitionWorkItem's own step 5 already
    // closes the outgoing phase's open QUEUE segment as part of every
    // transition — that closed segment IS the Work Item's queue time
    // (FR-014). Do NOT also manually close a QUEUE segment here.
    if (workItem.state !== "IN_DESIGN") {
      const result = await transitionWorkItem(tx, {
        workItemId: asWorkItemId(workItemId),
        to: "IN_DESIGN",
        actor: toCoreActor(actor),
      });
      if (!result.ok) {
        throw new WorkItemTransitionError(result.error);
      }
    }

    // "Resume" (FR-011) is this same function called again on an
    // already-IN_DESIGN Work Item whose ACTIVE segment is currently closed —
    // the `if` above is skipped (no redundant transition), and this call
    // opens a fresh ACTIVE segment. There is no separate `resumeTimer`.
    await openSegment(tx, {
      workItemId: asWorkItemId(workItemId),
      phase: "IN_DESIGN",
      kind: "ACTIVE",
      userId: asUserId(actor.userId),
    });

    await audit.record(tx, {
      action: "workitem.timer_started",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
    });
  });
}

// ── pauseTimer ───────────────────────────────────────────────────────────

/**
 * "Stop" (PRI-9's fourth timer verb) is this same function — `PhaseTiming`
 * only has "segment open" / "segment closed" states (research.md §2); there
 * is no third state a separate `stopTimer` would need. The UI MAY label the
 * same action "Stop" instead of "Pause" depending on context.
 */
export async function pauseTimer(actor: Actor, workItemId: string): Promise<void> {
  authorize(actor, "design.work");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workItem = await tx.workItem.findUnique({ where: { id: workItemId } });
    if (!workItem) {
      throw new DomainDesignerError("WORK_ITEM_NOT_FOUND", `Work Item ${workItemId} does not exist.`);
    }
    if (workItem.assigneeId !== actor.userId) {
      throw new DomainDesignerError("NOT_ASSIGNEE", "Only the assigned designer may pause this timer.");
    }

    // No-op if nothing is open, no state change (FR-010).
    await closeOpenSegment(tx, { workItemId: asWorkItemId(workItemId), kind: "ACTIVE" });

    await audit.record(tx, {
      action: "workitem.timer_paused",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
    });
  });
}

// ── phaseDurations ───────────────────────────────────────────────────────

export interface PhaseDurations {
  queueTimeMs: number;
  activeTimeMs: number;
  totalPhaseDurationMs: number | null;
}

/**
 * Phases whose QUEUE segments count as "waiting for a designer" time. A
 * QUEUE segment also auto-opens for every other phase (IN_DESIGN,
 * DESIGN_COMPLETED, ...) as a side effect of transitioning into it — those
 * are NOT queue-for-a-designer time and MUST be excluded (data-model.md's
 * `PhaseDurations` note).
 */
const QUEUE_COUNTED_PHASES: readonly string[] = ["ASSIGNED", "REWORK_REQUIRED"];

/** No `authorize()` beyond authenticated actor — read-only display helper. */
export async function phaseDurations(_actor: Actor, workItemId: string): Promise<PhaseDurations> {
  const segments = await db.phaseTiming.findMany({ where: { workItemId } });

  const queueSegments = segments.filter(
    (s) => s.kind === "QUEUE" && QUEUE_COUNTED_PHASES.includes(s.phase),
  );
  const activeSegments = segments.filter((s) => s.kind === "ACTIVE");

  const queueTimeMs = calculatePhaseDurationMs(queueSegments);
  const activeTimeMs = calculatePhaseDurationMs(activeSegments);

  const transitions = await db.workItemTransition.findMany({
    where: {
      workItemId,
      to: { in: ["DESIGN_COMPLETED", "ASSIGNED", "REWORK_REQUIRED"] as WorkItemState[] },
    },
    orderBy: { at: "asc" },
  });

  let totalPhaseDurationMs: number | null = null;
  const completedTransition = [...transitions].reverse().find((t) => t.to === "DESIGN_COMPLETED");
  if (completedTransition) {
    const startTransition = transitions
      .filter(
        (t) =>
          (t.to === "ASSIGNED" || t.to === "REWORK_REQUIRED") &&
          t.at.getTime() <= completedTransition.at.getTime(),
      )
      .at(-1);
    if (startTransition) {
      totalPhaseDurationMs = completedTransition.at.getTime() - startTransition.at.getTime();
    }
  }

  return { queueTimeMs, activeTimeMs, totalPhaseDurationMs };
}
