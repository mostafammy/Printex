/**
 * Approved handoff edges (manual moves out of the review-approved state).
 *
 * An APPROVED card used to rest with zero offered moves: its only
 * registrations were SYSTEM auto-edges (never offered, always refused on
 * forced drop), so every column rendered dimmed and approved work could
 * not be dragged to Pricing or Production. These DIRECT/SHEET edges give
 * it the manual path, mirroring `./designHandoff`.
 *
 * - `APPROVED -> WAITING_PRICING` needs `pricing.use_fixed`: routing work
 *   into the pricing queue (same permission as the old screen edge).
 * - `APPROVED -> READY_FOR_PRODUCTION` needs `workitem.send_to_production`:
 *   releasing priced work straight to the floor.
 *
 * (`APPROVED -> REWORK_REQUIRED` is covered by the admin-override
 * send-back edge in `./adminSendBack`, so it is deliberately absent here —
 * the catalog throws on duplicate edgeIds.)
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

export class WorkItemApprovedHandoffError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemApprovedHandoffError";
    this.error = error;
  }
}

async function handoff(
  actor: Actor,
  cardId: string,
  to: "WAITING_PRICING" | "READY_FOR_PRODUCTION",
): Promise<void> {
  const coreActor = toCoreActor(actor);
  await db.$transaction(async (tx) => {
    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(cardId),
      to,
      actor: coreActor,
    });
    if (!result.ok) {
      throw new WorkItemApprovedHandoffError(result.error);
    }
  });
}

export const approvedToWaitingPricing: EdgeHandler = {
  edgeId: "APPROVED->WAITING_PRICING",
  kind: "DIRECT",
  permission: "pricing.use_fixed",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "توجيه للتسعير",
  async execute(actor, card) {
    authorize(actor, "pricing.use_fixed");
    await handoff(actor, card.id, "WAITING_PRICING");
  },
};

export const approvedToReadyForProduction: EdgeHandler = {
  edgeId: "APPROVED->READY_FOR_PRODUCTION",
  kind: "DIRECT",
  permission: "workitem.send_to_production",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "إرسال للإنتاج",
  async execute(actor, card) {
    authorize(actor, "workitem.send_to_production");
    await handoff(actor, card.id, "READY_FOR_PRODUCTION");
  },
};

export const approvedHandoffEdges: readonly EdgeHandler[] = [
  approvedToWaitingPricing,
  approvedToReadyForProduction,
];
