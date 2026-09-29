/**
 * Design-completed handoff edges (manual escape hatch for stranded cards).
 *
 * `DESIGN_COMPLETED` is normally transient: `markDesignComplete` chains
 * `IN_DESIGN -> DESIGN_COMPLETED -> WAITING_REVIEW/APPROVED` in one
 * transaction, so the board never offers the `SYSTEM` auto-edges behind it
 * (EdgeCatalog filters `SYSTEM`, moveWorkItem refuses it). A card that is
 * nevertheless resting in `DESIGN_COMPLETED` (legacy row, interrupted chain,
 * re-opened lane) therefore has zero `moves` — every column renders dimmed
 * and cross-phase drag is impossible.
 *
 * These two `DIRECT` edges give that card a manual handoff. The automatic
 * `markDesignComplete` chain (`IN_DESIGN -> DESIGN_COMPLETED ->
 * WAITING_REVIEW/APPROVED` in one transaction) calls `transitionWorkItem`
 * directly, so replacing the `SYSTEM` registrations changes nothing for it.
 * Ordering matters — `WAITING_REVIEW` is registered first so a
 * station-level drop onto the review column resolves to the next phase, not
 * to the review-skipping approve.
 *
 * - `DESIGN_COMPLETED -> WAITING_REVIEW` needs `design.work`: the designer
 *   handing finished work to review.
 * - `DESIGN_COMPLETED -> APPROVED` needs `design.review`: skipping review is
 *   a reviewer privilege. The global no-self-review guard (`to: APPROVED`)
 *   still runs inside `transitionWorkItem`; the `precheck` mirrors
 *   `review.ts` so the board hides the option up front with an Arabic hint
 *   instead of failing on drop.
 */

import { db } from "~/server/db";
import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  transitionWorkItem,
  asUserId,
  asWorkItemId,
} from "~/server/core";
import type { Actor as CoreActor, DomainError } from "~/server/core";
import type { EdgeHandler } from "../edgeCatalog";

function toCoreActor(actor: Actor): CoreActor {
  return {
    userId: asUserId(actor.userId),
    roles: actor.roles,
    departmentIds: actor.departmentIds,
  };
}

export class WorkItemHandoffTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemHandoffTransitionError";
    this.error = error;
  }
}

async function handoff(
  actor: Actor,
  cardId: string,
  to: "WAITING_REVIEW" | "APPROVED",
): Promise<void> {
  const coreActor = toCoreActor(actor);
  await db.$transaction(async (tx) => {
    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(cardId),
      to,
      actor: coreActor,
    });
    if (!result.ok) {
      throw new WorkItemHandoffTransitionError(result.error);
    }
  });
}

export const designCompletedToWaitingReviewManual: EdgeHandler = {
  edgeId: "DESIGN_COMPLETED->WAITING_REVIEW",
  kind: "DIRECT",
  permission: "design.work",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "إرسال للمراجعة",
  async execute(actor, card) {
    authorize(actor, "design.work");
    await handoff(actor, card.id, "WAITING_REVIEW");
  },
};

export const designCompletedToApprovedManual: EdgeHandler = {
  edgeId: "DESIGN_COMPLETED->APPROVED",
  kind: "DIRECT",
  permission: "design.review",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "اعتماد مباشر",
  precheck(actor, card) {
    if (card.assignee?.id === actor.userId) {
      return { ok: false, hintAr: "لا يمكنك اعتماد تصميمك بنفسك" };
    }
    return { ok: true };
  },
  async execute(actor, card) {
    authorize(actor, "design.review");
    await handoff(actor, card.id, "APPROVED");
  },
};

export const designHandoffEdges: readonly EdgeHandler[] = [
  designCompletedToWaitingReviewManual,
  designCompletedToApprovedManual,
];
