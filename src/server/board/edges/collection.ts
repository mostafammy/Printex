/**
 * Collection & Delivery Edge Handlers.
 *
 * After production completes the card sits in PRODUCTION_COMPLETED.
 * From there two paths exist:
 *
 *   A) Fast path (simple jobs): PRODUCTION_COMPLETED → COMPLETED directly.
 *      Uses collection.receive permission. Useful when there is no separate
 *      collection / delivery step (e.g., internal job, customer picks up at
 *      the counter and no further tracking is needed).
 *
 *   B) Full path (tracked delivery): PRODUCTION_COMPLETED → READY_FOR_COLLECTION
 *      → DELIVERED → COMPLETED. Gives the PRINT_RECEPTION_DELIVERY role a
 *      visible stage to check/pack items before handing them to the customer.
 *
 * Both paths land on COMPLETED which is the terminal "finished" state shown
 * off-board (stations.ts OFF_BOARD_STATES).
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

export class WorkItemCollectionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemCollectionError";
    this.error = error;
  }
}

async function simpleTransition(
  actor: Actor,
  cardId: string,
  to: "READY_FOR_COLLECTION" | "DELIVERED" | "COMPLETED",
): Promise<void> {
  const coreActor = toCoreActor(actor);
  await db.$transaction(async (tx) => {
    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(cardId),
      to,
      actor: coreActor,
    });
    if (!result.ok) {
      throw new WorkItemCollectionError(result.error);
    }
  });
}

function hasCollectionPermission(actor: Actor): boolean {
  return (
    actor.permissions.has("collection.receive") ||
    actor.permissions.has("admin.override") ||
    actor.roles.includes("ADMIN_OWNER")
  );
}

function hasDeliveryPermission(actor: Actor): boolean {
  return (
    actor.permissions.has("delivery.record") ||
    actor.permissions.has("admin.override") ||
    actor.roles.includes("ADMIN_OWNER")
  );
}

// ── Path A: fast completion ──────────────────────────────────────────────────

/**
 * PRODUCTION_COMPLETED → COMPLETED (fast path).
 * Skips collection and delivery — for simple jobs collected on the spot.
 */
export const productionCompletedToCompleted: EdgeHandler = {
  edgeId: "PRODUCTION_COMPLETED->COMPLETED",
  kind: "DIRECT",
  permission: "collection.receive",
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "تسليم واكتمال",
  async execute(actor, card) {
    if (!hasCollectionPermission(actor)) {
      throw new ForbiddenError("collection.receive");
    }
    await simpleTransition(actor, card.id, "COMPLETED");
  },
};

// ── Path B: full tracked flow ────────────────────────────────────────────────

export const productionCompletedToReadyForCollection: EdgeHandler = {
  edgeId: "PRODUCTION_COMPLETED->READY_FOR_COLLECTION",
  kind: "DIRECT",
  permission: "collection.receive",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "استلام وتدقيق",
  async execute(actor, card) {
    if (!hasCollectionPermission(actor)) {
      throw new ForbiddenError("collection.receive");
    }
    await simpleTransition(actor, card.id, "READY_FOR_COLLECTION");
  },
};

export const readyForCollectionToDelivered: EdgeHandler = {
  edgeId: "READY_FOR_COLLECTION->DELIVERED",
  kind: "DIRECT",
  permission: "delivery.record",
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "تسليم للعميل",
  precheck(_actor, card) {
    if (card.pricing === "PENDING") {
      return { ok: false, hintAr: "يجب حسم التسعير أولاً" };
    }
    return { ok: true };
  },
  async execute(actor, card) {
    if (!hasDeliveryPermission(actor)) {
      throw new ForbiddenError("delivery.record");
    }
    await simpleTransition(actor, card.id, "DELIVERED");
  },
};

export const deliveredToCompleted: EdgeHandler = {
  edgeId: "DELIVERED->COMPLETED",
  kind: "DIRECT",
  permission: "delivery.record",
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "تأكيد الاكتمال",
  async execute(actor, card) {
    if (!hasDeliveryPermission(actor)) {
      throw new ForbiddenError("delivery.record");
    }
    await simpleTransition(actor, card.id, "COMPLETED");
  },
};

export const readyForCollectionToCompleted: EdgeHandler = {
  edgeId: "READY_FOR_COLLECTION->COMPLETED",
  kind: "DIRECT",
  permission: "collection.receive",
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "تأكيد الاكتمال (بدون تسليم)",
  async execute(actor, card) {
    if (!hasCollectionPermission(actor)) {
      throw new ForbiddenError("collection.receive");
    }
    await simpleTransition(actor, card.id, "COMPLETED");
  },
};

export const collectionEdges: readonly EdgeHandler[] = [
  productionCompletedToCompleted,
  productionCompletedToReadyForCollection,
  readyForCollectionToDelivered,
  readyForCollectionToCompleted,
  deliveredToCompleted,
];
