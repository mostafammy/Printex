/**
 * Reception Edge Handlers.
 * (research.md R3, FR-015a, contracts/board-server.md §EdgeCatalog)
 */

import { z } from "zod";
import { assignDesigner } from "~/server/designers";
import { sendToProduction } from "~/server/orders";
import type { EdgeHandler } from "../edgeCatalog";

const assignDesignerSchema = z.object({
  designerId: z.string().trim().min(1, "يجب تحديد المصمم"),
  reason: z.string().trim().optional(),
});

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
  newToReadyForProduction,
  newToAssigned,
];
