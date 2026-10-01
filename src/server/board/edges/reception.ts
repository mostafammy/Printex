/**
 * Reception Edge Handlers.
 * (research.md R3, FR-015a, contracts/board-server.md §EdgeCatalog)
 */

import { z } from "zod";
import { assignDesigner } from "~/server/designers";
import { sendToProduction } from "~/server/orders";
import { db } from "~/server/db";
import { transitionWorkItem, asUserId, asWorkItemId } from "~/server/core";
import type { Actor as CoreActor } from "~/server/core";
import { WorkItemTransitionError } from "~/server/orders/cancelOrder";
import type { Actor } from "~/server/auth";
import type { EdgeHandler } from "../edgeCatalog";

function toCoreActor(actor: Actor): CoreActor {
  return {
    userId: asUserId(actor.userId),
    roles: actor.roles,
    departmentIds: actor.departmentIds,
  };
}

const assignDesignerSchema = z.object({
  designerId: z.string().trim().min(1, "يجب تحديد المصمم"),
  reason: z.string().trim().optional(),
});

export const newToWaitingPricing: EdgeHandler = {
  edgeId: "NEW->WAITING_PRICING",
  kind: "DIRECT",
  permission: undefined,
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "إرسال للمحاسبة والتسعير",
  precheck(actor) {
    const allowed =
      actor.permissions.has("workitem.send_to_production") ||
      actor.permissions.has("workitem.assign_designer") ||
      actor.permissions.has("pricing.use_fixed") ||
      actor.permissions.has("admin.override") ||
      actor.roles.includes("ADMIN_OWNER") ||
      actor.roles.includes("RECEPTION") ||
      actor.roles.includes("ACCOUNTING");
    if (!allowed) {
      return { ok: false, hintAr: "غير مصرح لك بنقل هذا العنصر للمحاسبة والتسعير" };
    }
    return { ok: true };
  },
  async execute(actor, card) {
    const coreActor = toCoreActor(actor);
    await db.$transaction(async (tx) => {
      const result = await transitionWorkItem(tx, {
        workItemId: asWorkItemId(card.id),
        to: "WAITING_PRICING",
        actor: coreActor,
        reason: "إرسال للمحاسبة والتسعير",
      });
      if (!result.ok) {
        throw new WorkItemTransitionError(result.error);
      }
    });
  },
};

export const newToReadyForProduction: EdgeHandler = {
  edgeId: "NEW->READY_FOR_PRODUCTION",
  kind: "DIRECT",
  permission: "workitem.send_to_production",
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "إرسال للإنتاج",
  async execute(actor, card) {
    await sendToProduction(actor, card.id);
  },
};

export const newToAssigned: EdgeHandler = {
  edgeId: "NEW->ASSIGNED",
  kind: "SHEET",
  sheet: "assign-designer",
  permission: "workitem.assign_designer",
  inputSchema: assignDesignerSchema,
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "تعيين مصمم",
  async execute(actor, card, input) {
    const data = assignDesignerSchema.parse(input);
    await assignDesigner(actor, card.id, data.designerId, data.reason);
  },
};

export const receptionEdges: readonly EdgeHandler[] = [
  newToWaitingPricing,
  newToReadyForProduction,
  newToAssigned,
];
