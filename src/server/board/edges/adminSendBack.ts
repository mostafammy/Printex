/**
 * Admin send-back-to-design edges (drag back across phases).
 *
 * `APPROVED`, `WAITING_PRICING`, and `READY_FOR_PRODUCTION` are core-legal
 * sources of `REWORK_REQUIRED` (core `ALLOWED_EDGES` — the customer-change
 * send-back allowance), but the board registers no handler for those
 * transitions. An `APPROVED` card therefore offers only cancellation: every
 * earlier phase renders dimmed and the Admin cannot drag the item back.
 *
 * These three `SHEET` edges close that gap, gated on `admin.override` (held
 * only by `ADMIN_OWNER` in seed) rather than a station permission — sending
 * an approved/priced/production-ready item back to design is an override
 * decision, not routine station work. The drop opens the existing
 * `send-back` reason sheet (no new UI), and execute mirrors
 * `production/sendBack.ts`: a `Return` row + assignee notification + audit
 * record share one transaction with the state transition.
 *
 * Category is `OTHER`, not `PRODUCTION_ISSUE`: the item may never have
 * reached production, and the sheet collects only a reason. `Return`
 * requires a real department FK, and no `general` department exists in seed
 * — so the origin resolves from the card, then the actor, then any seeded
 * department as a last resort instead of a magic string.
 */

import { z } from "zod";
import type { Prisma } from "../../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  transitionWorkItem,
  asUserId,
  asWorkItemId,
} from "~/server/core";
import type { Actor as CoreActor, DomainError } from "~/server/core";
import { notify } from "~/server/core/notifications/notify";
import { createReturnInTx } from "~/server/review";
// Registers 016's transition guards on every path that transitions.
import "~/server/changes";
import type { BoardCard } from "~/lib/board/types";
import type { EdgeHandler } from "../edgeCatalog";

function toCoreActor(actor: Actor): CoreActor {
  return {
    userId: asUserId(actor.userId),
    roles: actor.roles,
    departmentIds: actor.departmentIds,
  };
}

export class WorkItemAdminSendBackTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemAdminSendBackTransitionError";
    this.error = error;
  }
}

const adminSendBackSchema = z.object({
  reason: z.string().trim().min(1, "يجب إدخال سبب الإعادة"),
});

async function resolveOriginDepartmentId(
  tx: Prisma.TransactionClient,
  card: BoardCard,
  actor: Actor,
): Promise<string> {
  if (card.departmentId) return card.departmentId;
  if (actor.departmentIds[0]) return actor.departmentIds[0];
  const anyDepartment = await tx.department.findFirst({ select: { id: true } });
  if (!anyDepartment) {
    throw new WorkItemAdminSendBackTransitionError({
      code: "VALIDATION",
      message: "No department exists to attribute this send-back to.",
    });
  }
  return anyDepartment.id;
}

interface AdminSendBackTx {
  readonly tx: Prisma.TransactionClient;
  readonly actor: Actor;
  readonly card: BoardCard;
  readonly reason: string;
}

async function adminSendBackInTx(ctx: AdminSendBackTx): Promise<void> {
  const { tx, actor, card, reason } = ctx;
  const result = await transitionWorkItem(tx, {
    workItemId: asWorkItemId(card.id),
    to: "REWORK_REQUIRED",
    actor: toCoreActor(actor),
    reason,
    rejectionCategory: "OTHER",
  });
  if (!result.ok) {
    throw new WorkItemAdminSendBackTransitionError(result.error);
  }

  const originDepartmentId = await resolveOriginDepartmentId(tx, card, actor);
  const assignedToId = card.assignee?.id ?? actor.userId;

  const { returnId } = await createReturnInTx(tx, actor, card.id, {
    category: "OTHER",
    originDepartmentId,
    assignedToId,
    explanation: reason,
  });

  if (card.assignee) {
    await notify(tx, {
      type: "workitem.rejected",
      entity: { type: "WorkItem", id: card.id },
      recipients: { userIds: [card.assignee.id] },
      payload: { returnId, category: "OTHER" },
    });
  }

  await audit.record(tx, {
    action: "workitem.sent_back_to_design",
    entityType: "WorkItem",
    entityId: card.id,
    actorId: actor.userId,
    after: { returnId, reason, adminOverride: true },
  });
}

async function adminSendBackToDesign(
  actor: Actor,
  card: BoardCard,
  input: unknown,
): Promise<void> {
  authorize(actor, "admin.override");
  const data = adminSendBackSchema.parse(input);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await adminSendBackInTx({ tx, actor, card, reason: data.reason });
  });
}

function createAdminSendBackHandler(
  from: "APPROVED" | "WAITING_PRICING" | "READY_FOR_PRODUCTION",
): EdgeHandler {
  return {
    edgeId: `${from}->REWORK_REQUIRED`,
    kind: "SHEET",
    sheet: "send-back",
    permission: "admin.override",
    inputSchema: adminSendBackSchema,
    backward: true,
    destructive: false,
    groupable: false,
    labelAr: "إعادة للتصميم",
    async execute(actor, card, input) {
      await adminSendBackToDesign(actor, card, input);
    },
  };
}

export const approvedToReworkRequiredAdmin: EdgeHandler =
  createAdminSendBackHandler("APPROVED");
export const waitingPricingToReworkRequiredAdmin: EdgeHandler =
  createAdminSendBackHandler("WAITING_PRICING");
export const readyForProductionToReworkRequiredAdmin: EdgeHandler =
  createAdminSendBackHandler("READY_FOR_PRODUCTION");

export const adminSendBackEdges: readonly EdgeHandler[] = [
  approvedToReworkRequiredAdmin,
  waitingPricingToReworkRequiredAdmin,
  readyForProductionToReworkRequiredAdmin,
];
