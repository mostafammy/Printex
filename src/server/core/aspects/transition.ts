// transitionOrThrow — adapter from Result-returning transitionWorkItem to throwing semantics.
// contracts/aspects.md §3.3 (specs/016-change-control/contracts/aspects.md).
//
// Converts the caller's actor to a CoreActor via asUserId and invokes core's
// transitionWorkItem. On failure, throws TransitionFailure so interactive transactions
// automatically abort. On success, returns TransitionOutcome { from, to }.

import type { JsonValue } from "../json";
import type { WorkItemState } from "../workflow/states";
import type { RejectionCategory } from "../workflow/rejectionCategory";
import { asWorkItemId } from "../ids";
import { transitionWorkItem } from "../workflow/transition";
import { AspectMisuseError, TransitionFailure } from "./errors";
import type { Tx } from "./types";
import { toCoreActor } from "./actor";

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

function isPlainObject(v: unknown): v is Readonly<Record<string, JsonValue>> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
  );
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
  // Read current state with row lock to accurately construct outcome without READ COMMITTED race
  const locked = await tx.$queryRaw<{ state: WorkItemState }[]>`SELECT "state" FROM "WorkItem" WHERE "id" = ${input.workItemId} FOR UPDATE`;
  const from = locked[0]?.state;

  const coreActor = toCoreActor(input.actor);

  if (input.meta !== undefined && !isPlainObject(input.meta)) {
    throw new AspectMisuseError("transitionOrThrow meta must be a JSON object");
  }
  const meta = input.meta;

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

  if (from === undefined) {
    throw new AspectMisuseError(
      "transitionOrThrow: WorkItem state was unexpectedly missing after successful transition",
    );
  }

  return {
    from,
    to: input.to,
  };
}
