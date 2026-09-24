// transitionOrThrow — adapter from Result-returning transitionWorkItem to throwing semantics.
// contracts/aspects.md §3.3 (specs/016-change-control/contracts/aspects.md).
//
// Converts the caller's actor to a CoreActor via asUserId and invokes core's
// transitionWorkItem. On failure, throws TransitionFailure so interactive transactions
// automatically abort. On success, returns TransitionOutcome { from, to }.

import type { JsonValue } from "../json";
import type { WorkItemState } from "../workflow/states";
import type { RejectionCategory } from "../workflow/rejectionCategory";
import type { Actor as CoreActor } from "../actor";
import { asUserId, asWorkItemId } from "../ids";
import { transitionWorkItem } from "../workflow/transition";
import { TransitionFailure } from "./errors";
import type { Tx } from "./types";

export interface TransitionOrThrowInput {
  readonly workItemId: string;
  readonly to: WorkItemState;
  readonly actor: { readonly userId: string };
  readonly reason?: string;
  readonly rejectionCategory?: RejectionCategory;
  readonly meta?: JsonValue;
}

export interface TransitionOutcome {
  readonly from: WorkItemState;
  readonly to: WorkItemState;
}

/**
 * Transitions a WorkItem state inside the provided transaction client.
 *
 * Throws `TransitionFailure` on any domain failure (invalid edge, failing guard, etc.)
 * so that Prisma's transaction callback rejects and rolls back.
 */
export async function transitionOrThrow(
  tx: Tx,
  input: TransitionOrThrowInput,
): Promise<TransitionOutcome> {
  // Read current state to accurately construct the return outcome.
  let from: WorkItemState | undefined;
  try {
    const current = await tx.workItem.findUnique({
      where: { id: input.workItemId },
      select: { state: true },
    });
    if (current) {
      from = current.state;
    }
  } catch {
    // If findUnique fails here, transitionWorkItem below will run its own check
    // and produce the appropriate DomainError.
  }

  const coreActor: CoreActor = {
    userId: asUserId(input.actor.userId),
    roles:
      "roles" in input.actor && Array.isArray((input.actor as { roles?: unknown }).roles)
        ? (input.actor as { roles: readonly string[] }).roles
        : [],
    departmentIds:
      "departmentIds" in input.actor &&
      Array.isArray((input.actor as { departmentIds?: unknown }).departmentIds)
        ? (input.actor as { departmentIds: readonly string[] }).departmentIds
        : [],
  };

  const meta =
    input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)
      ? (input.meta as Readonly<Record<string, JsonValue>>)
      : undefined;

  const result = await transitionWorkItem(tx, {
    workItemId: asWorkItemId(input.workItemId),
    to: input.to,
    actor: coreActor,
    reason: input.reason,
    rejectionCategory: input.rejectionCategory,
    meta,
  });

  if (!result.ok) {
    throw new TransitionFailure(input.workItemId, result.error);
  }

  return {
    from: from ?? input.to,
    to: input.to,
  };
}
