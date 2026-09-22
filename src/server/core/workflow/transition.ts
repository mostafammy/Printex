// The sole state mutator — contracts/workflow.md `transitionWorkItem`,
// plan.md §5.2, §5.3, §5.5.
//
// This is the only code path allowed to write `WorkItem.state` (spec
// FR-005). Everything below runs inside the caller-supplied `tx`
// (Prisma.TransactionClient) — the caller controls the outer transaction
// boundary (e.g. 011 wraps Order creation + first transition in one `tx`).
//
// ATOMICITY / "never throw" — a deliberate, documented exception:
// -----------------------------------------------------------------------
// Every other `core` function returns `Result<T, DomainError>` and never
// rejects its promise (plan.md §5.3). `transitionWorkItem` follows that
// rule for every failure that is detected *before* any write happens
// (Work Item not found, edge not in `ALLOWED_EDGES`, a guard failing,
// missing `reason`/`rejectionCategory`) — those are returned as a resolved
// `err(...)` Result, and nothing has been written, so there is nothing to
// roll back either way.
//
// Once the optimistic-concurrency `updateMany` succeeds, this function
// deliberately stops catching errors. contracts/workflow.md's own words are
// "steps 4 either all commit or all roll back together, because they share
// `tx`... If `audit.record` throws, the `WorkItem.state` write rolls back
// too." That guarantee is only true if a failure in one of those later
// writes (phase timing, the `WorkItemTransition` insert, `notify()`)
// propagates as a *rejected promise* out of the function the caller passed
// to `db.$transaction(...)` — that is the only thing that makes Prisma
// abort the transaction. If this function instead caught every Prisma
// error here and always resolved with an `err(...)` Result, the outer
// `$transaction` callback would return normally, Prisma would COMMIT the
// transaction, and the `WorkItem.state` update from step 4 would survive
// even though the audit/notification write failed — silently breaking
// constitution III and the rollback guarantee this phase's review
// explicitly asked to prove with a test (tests/integration/
// transition-rollback.test.ts).
//
// So: `transitionWorkItem`'s returned promise CAN reject (not just resolve
// to `{ ok: false }`) for infrastructure-level failures that occur once
// mutation has started. No `throw` statement appears in this file (the
// ESLint "no throw in core" rule is a syntactic check on `core`'s own code
// and is satisfied), but an `await`ed Prisma call is deliberately left
// uncaught past that point so its rejection propagates naturally. Callers
// that invoke this inside their own `db.$transaction(async (tx) => ...)`
// get the correct behavior "for free" from Prisma's own transaction
// semantics; callers should be aware the returned promise is not
// unconditionally rejection-free once a `tx` is in a Work Item transition.

import type { Prisma } from "../../../../generated/prisma";
import type { DomainError } from "../errors";
import type { JsonValue } from "../json";
import type { Result } from "../result";
import { err, ok } from "../result";
import type { Actor } from "../actor";
import type { WorkItemId } from "../ids";
import { asOrderId, asUserId, asWorkItemId } from "../ids";
import { ALLOWED_EDGES } from "./edges";
import type { WorkItemState } from "./states";
import type { RejectionCategory } from "./rejectionCategory";
import { runGuards } from "./guards";
import type { WorkItemSnapshot } from "./snapshot";
import { closeOpenSegment, openSegment } from "./timing";
import { notify } from "../notifications/notify";

export interface TransitionInput {
  readonly workItemId: WorkItemId;
  readonly to: WorkItemState;
  readonly actor: Actor;
  /** Required (validated) when `to` is `REWORK_REQUIRED` or `CANCELLED`. */
  readonly reason?: string;
  /** Required (validated) when `to === "REWORK_REQUIRED"`. */
  readonly rejectionCategory?: RejectionCategory;
  // Correction #3: JsonValue, not `Record<string, unknown>` — this is a
  // Prisma `Json` field (`WorkItemTransition.meta`) at the boundary.
  readonly meta?: Readonly<Record<string, JsonValue>>;
}

function toSnapshot(row: {
  id: string;
  orderId: string;
  productTypeId: string | null;
  departmentId: string | null;
  state: string;
  requiresDesign: boolean;
  requiresReview: boolean;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkItemSnapshot {
  return {
    id: asWorkItemId(row.id),
    orderId: asOrderId(row.orderId),
    productTypeId: row.productTypeId,
    departmentId: row.departmentId,
    state: row.state as WorkItemState,
    requiresDesign: row.requiresDesign,
    requiresReview: row.requiresReview,
    assigneeId: row.assigneeId === null ? null : asUserId(row.assigneeId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const REASON_REQUIRED_TARGETS: readonly WorkItemState[] = ["REWORK_REQUIRED", "CANCELLED"];

export async function transitionWorkItem(
  tx: Prisma.TransactionClient,
  input: TransitionInput,
): Promise<Result<WorkItemSnapshot, DomainError>> {
  // --- Step 0: input validation, no I/O, no mutation. --------------------
  if (REASON_REQUIRED_TARGETS.includes(input.to) && !input.reason?.trim()) {
    return err({
      code: "VALIDATION",
      message: `A reason is required when transitioning to ${input.to}.`,
      details: { to: input.to },
    });
  }
  if (input.to === "REWORK_REQUIRED" && !input.rejectionCategory) {
    return err({
      code: "VALIDATION",
      message: "rejectionCategory is required when transitioning to REWORK_REQUIRED.",
    });
  }

  // --- Step 1: load current state. Nothing mutating yet, so unexpected
  // read failures are still safe to catch and convert. -------------------
  let current: Awaited<ReturnType<typeof tx.workItem.findUnique>>;
  try {
    current = await tx.workItem.findUnique({ where: { id: input.workItemId } });
  } catch (caught) {
    return err({
      code: "VALIDATION",
      message: `Failed to load Work Item ${input.workItemId}: ${
        caught instanceof Error ? caught.message : String(caught)
      }`,
    });
  }
  if (!current) {
    return err({
      code: "VALIDATION",
      message: `Work Item ${input.workItemId} does not exist.`,
      details: { workItemId: input.workItemId },
    });
  }

  const from: WorkItemState = current.state;

  // --- Step 2: allowed-edges lookup. -------------------------------------
  const allowedTargets = ALLOWED_EDGES[from];
  if (!allowedTargets.includes(input.to)) {
    return err({
      code: "INVALID_TRANSITION",
      message: `Transition ${from} -> ${input.to} is not allowed.`,
      details: { from, to: input.to },
    });
  }

  // --- Step 3: run every guard registered against this (from, to) edge. --
  const guardResult = await runGuards(from, input.to, {
    workItem: toSnapshot(current),
    actor: input.actor,
    reason: input.reason,
    meta: input.meta,
  });
  if (!guardResult.ok) {
    return err({
      code: "GUARD_FAILED",
      message: guardResult.error.message,
      details: { guardCode: guardResult.error.code },
    });
  }

  // --- Point of no return: from here, mutations begin. Errors are left
  // uncaught deliberately (see file-level comment) so the caller's shared
  // `tx` rolls back on any failure. ---------------------------------------

  // Step 4: optimistic-concurrency state update
  // (`updateMany` + `count === 1`, plan.md §5.5).
  const updateResult = await tx.workItem.updateMany({
    where: { id: input.workItemId, state: from },
    data: { state: input.to },
  });
  if (updateResult.count !== 1) {
    // Someone else transitioned this Work Item between our read (step 1)
    // and this write — a concurrency conflict, not a genuinely-invalid
    // edge. Nothing was written by this call (`updateMany` matched zero
    // rows), so it is still safe to return a resolved `err(...)` here
    // rather than reject. The frozen `ErrorCode` union (contracts/errors.md)
    // has exactly five codes and no dedicated "conflict"/"CONCURRENCY"
    // code; `INVALID_TRANSITION` is reused deliberately — the transition
    // this call believed it was making, from the `state` it read, is no
    // longer valid by the time it tried to apply it. A dedicated conflict
    // code would read better to a UI, but contracts/errors.md is frozen for
    // this feature and out of scope to extend here.
    return err({
      code: "INVALID_TRANSITION",
      message: "Work Item state changed concurrently; transition aborted.",
      details: { workItemId: input.workItemId, expectedFrom: from, to: input.to },
    });
  }

  // Step 5: phase-timing segments, inside the SAME tx (correction #1).
  // Close whatever was open for the outgoing phase (both timelines — a
  // Work Item may have been actively worked and/or queued) and open a
  // fresh QUEUE segment for the destination phase (the default landing
  // mode for any state; an ACTIVE segment starts later when someone picks
  // the item up — that hook belongs to a future feature, not this one).
  await closeOpenSegment(tx, { workItemId: input.workItemId, kind: "ACTIVE" });
  await closeOpenSegment(tx, { workItemId: input.workItemId, kind: "QUEUE" });
  await openSegment(tx, {
    workItemId: input.workItemId,
    phase: input.to,
    kind: "QUEUE",
  });

  // Step 6: WorkItemTransition insert — the append-only audit trail
  // (constitution III, correction #2 for rejectionCategory, correction #3
  // for JsonValue).
  //
  // NOTE on "audit event": contracts/workflow.md step 4 says to invoke
  // 001-identity-access-audit's `audit.record` here. That feature (and its
  // `AuditEvent` table) does not exist yet in this codebase — data-model.md
  // and prisma/schema/core.prisma define no such model for 002 to call
  // into. Until 001 ships, this `WorkItemTransition` row itself satisfies
  // constitution III's audit requirement: it is immutable (no update/delete
  // path exists anywhere), written in the same `tx` as the state change,
  // and carries actor/reason/category/meta. When 001 lands a real
  // `AuditEvent` table and `audit.record` call, it slots in as one more
  // `tx` write right after this one, with no other change to this
  // function's shape.
  await tx.workItemTransition.create({
    data: {
      workItemId: input.workItemId,
      from,
      to: input.to,
      actorId: input.actor.userId,
      reason: input.reason,
      rejectionCategory: input.rejectionCategory,
      meta: input.meta ?? undefined,
    },
  });

  // Step 7: outbox notification, same tx (contracts/notifications.md).
  await notify(tx, {
    type: "work_item.state_changed",
    entity: { type: "WorkItem", id: input.workItemId },
    recipients: {},
    payload: {
      from,
      to: input.to,
      actorId: input.actor.userId,
      reason: input.reason ?? null,
      rejectionCategory: input.rejectionCategory ?? null,
    },
  });

  const updated = await tx.workItem.findUniqueOrThrow({ where: { id: input.workItemId } });
  return ok(toSnapshot(updated));
}
