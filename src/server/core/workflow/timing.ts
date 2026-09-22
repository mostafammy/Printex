// Phase-timing segment management — data-model.md `PhaseTiming` ("Timestamped
// segments, not a stopwatch", constitution III, FR-009), tasks.md T028.
//
// A phase's total queue/active duration = `sum(endedAt - startedAt)` over its
// closed segments, plus `now() - startedAt` for an open segment
// (`endedAt = null`) when displayed. Nothing here holds in-memory timer
// state — every calculation is a pure re-derivation from persisted
// timestamps, so a server restart mid-segment loses nothing (SC-004).

import type { Prisma } from "../../../../generated/prisma";
import type { UserId, WorkItemId } from "../ids";
import type { WorkItemState } from "./states";

export type PhaseTimingKind = "QUEUE" | "ACTIVE";

export interface PhaseTimingSegment {
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

/**
 * Pure duration calculation (ms): sum of closed segments'
 * `endedAt - startedAt`, plus an open segment's elapsed-so-far
 * (`now - startedAt`) if one is present. Re-computable from nothing but the
 * persisted timestamps — no in-memory accumulator, so "restarting" the
 * server and recomputing from the same rows gives the same answer (SC-004).
 */
export function calculatePhaseDurationMs(
  segments: readonly PhaseTimingSegment[],
  now: Date = new Date(),
): number {
  return segments.reduce((total, segment) => {
    const end = segment.endedAt ?? now;
    return total + (end.getTime() - segment.startedAt.getTime());
  }, 0);
}

/**
 * Closes the currently-open `PhaseTiming` segment for a Work Item (if any),
 * scoped to `kind` (QUEUE segments and ACTIVE segments are independent
 * timelines — e.g. a Work Item can be queued for a department while nobody
 * is actively working it). No-op if no segment is open. Must be called
 * inside the same `tx` as the state transition that ends the phase
 * (correction #1 — phase-timing atomicity).
 */
export async function closeOpenSegment(
  tx: Prisma.TransactionClient,
  params: {
    readonly workItemId: WorkItemId;
    readonly kind: PhaseTimingKind;
    readonly at?: Date;
  },
): Promise<void> {
  const open = await tx.phaseTiming.findFirst({
    where: { workItemId: params.workItemId, kind: params.kind, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (!open) {
    return;
  }

  await tx.phaseTiming.update({
    where: { id: open.id },
    data: { endedAt: params.at ?? new Date() },
  });
}

/**
 * Opens a new `PhaseTiming` segment for a Work Item entering `phase`. Must
 * be called inside the same `tx` as the state transition that starts the
 * phase (correction #1).
 */
export async function openSegment(
  tx: Prisma.TransactionClient,
  params: {
    readonly workItemId: WorkItemId;
    readonly phase: WorkItemState;
    readonly kind: PhaseTimingKind;
    readonly userId?: UserId | null;
    readonly at?: Date;
  },
): Promise<void> {
  await tx.phaseTiming.create({
    data: {
      workItemId: params.workItemId,
      phase: params.phase,
      kind: params.kind,
      userId: params.userId ?? null,
      startedAt: params.at ?? new Date(),
    },
  });
}
