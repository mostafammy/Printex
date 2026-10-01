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
 * - `APPROVED -> READY_FOR_PRODUCTION` accepts EITHER:
 *     - `workitem.send_to_production` (RECEPTION) — for pre-priced / fixed-price items
 *     - `workitem.approve_production` (ACCOUNTING) — the accountant sign-off that
 *       releases work to the printer without a separate pricing step
 *   Both land on the same ALLOWED_EDGES transition. Keeping them as a single
 *   edge with dual-permission precheck avoids duplicate edgeIds (the catalog
 *   throws on those) while still enforcing that someone with at least one of
 *   the two permissions must be present.
 *
 * (`APPROVED -> REWORK_REQUIRED` is covered by the admin-override
 * send-back edge in `./adminSendBack`, so it is deliberately absent here —
 * the catalog throws on duplicate edgeIds.)
 */

import { db } from "~/server/db";
import type { Actor } from "~/server/auth";
import {
  transitionWorkItem,
  asUserId,
  asWorkItemId,
} from "~/server/core";
import type { Actor as CoreActor, DomainError } from "~/server/core";
import type { EdgeHandler } from "../edgeCatalog";
import { ForbiddenError } from "~/server/auth/authorize";

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

/**
 * True if the actor holds at least one of the two release permissions:
 *   - workitem.send_to_production  → RECEPTION path (pre-priced / fixed-price)
 *   - workitem.approve_production  → ACCOUNTING path (accountant sign-off)
 */
function canRelease(actor: Actor): boolean {
  return (
    actor.permissions.has("workitem.send_to_production") ||
    actor.permissions.has("workitem.approve_production") ||
    actor.permissions.has("admin.override") ||
    actor.roles.includes("ADMIN_OWNER")
  );
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
  permission: undefined,
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "توجيه للمحاسب والتسعير",
  precheck(actor) {
    const allowed =
      actor.permissions.has("pricing.use_fixed") ||
      actor.permissions.has("design.review") ||
      actor.permissions.has("admin.override") ||
      actor.roles.includes("ADMIN_OWNER") ||
      actor.roles.includes("HEAD_DESIGNER") ||
      actor.roles.includes("ACCOUNTING");
    if (!allowed) {
      return { ok: false, hintAr: "غير مصرح لك بنقل هذا العنصر للتسعير" };
    }
    return { ok: true };
  },
  async execute(actor, card) {
    await handoff(actor, card.id, "WAITING_PRICING");
  },
};

/**
 * Dual-permission release edge: both RECEPTION (workitem.send_to_production)
 * and ACCOUNTING (workitem.approve_production) can move an APPROVED card
 * to READY_FOR_PRODUCTION. The `permission` field is left undefined so the
 * catalog's single-permission filter is bypassed — access is enforced in
 * `precheck` and again in `execute`.
 */
export const approvedToReadyForProduction: EdgeHandler = {
  edgeId: "APPROVED->READY_FOR_PRODUCTION",
  kind: "DIRECT",
  permission: undefined,
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "إرسال للإنتاج",
  precheck(actor) {
    if (!canRelease(actor)) {
      return { ok: false, hintAr: "يجب أن تملك صلاحية إرسال للإنتاج أو موافقة المحاسب" };
    }
    return { ok: true };
  },
  async execute(actor, card) {
    if (!canRelease(actor)) {
      throw new ForbiddenError("workitem.send_to_production");
    }
    await handoff(actor, card.id, "READY_FOR_PRODUCTION");
  },
};

export const approvedHandoffEdges: readonly EdgeHandler[] = [
  approvedToWaitingPricing,
  approvedToReadyForProduction,
];
