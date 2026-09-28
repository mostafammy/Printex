/**
 * Design Edge Handlers.
 * (research.md R3, contracts/board-server.md §EdgeCatalog)
 */

import { z } from "zod";
import { assignDesigner, markDesignComplete, startTimer } from "~/server/designers";
import type { EdgeHandler } from "../edgeCatalog";

const reassignDesignerSchema = z.object({
  designerId: z.string().trim().min(1, "يجب تحديد المصمم"),
  reason: z.string().trim().optional(),
});

export const assignedToInDesign: EdgeHandler = {
  edgeId: "ASSIGNED->IN_DESIGN",
  kind: "DIRECT",
  permission: "design.work",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "بدء التصميم",
  async execute(actor, card) {
    await startTimer(actor, card.id);
  },
};

export const inDesignToDesignCompleted: EdgeHandler = {
  edgeId: "IN_DESIGN->DESIGN_COMPLETED",
  kind: "DIRECT",
  permission: "design.work",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "إتمام التصميم",
  async execute(actor, card) {
    await markDesignComplete(actor, card.id);
  },
};

export const reworkRequiredToInDesign: EdgeHandler = {
  edgeId: "REWORK_REQUIRED->IN_DESIGN",
  kind: "DIRECT",
  permission: "design.work",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "استئناف التعديل",
  async execute(actor, card) {
    await startTimer(actor, card.id);
  },
};

export const reworkRequiredToAssigned: EdgeHandler = {
  edgeId: "REWORK_REQUIRED->ASSIGNED",
  kind: "SHEET",
  sheet: "assign-designer",
  permission: "workitem.assign_designer",
  inputSchema: reassignDesignerSchema,
  backward: true,
  destructive: false,
  groupable: false,
  labelAr: "إعادة تعيين مصمم",
  async execute(actor, card, input) {
    const data = reassignDesignerSchema.parse(input);
    await assignDesigner(actor, card.id, data.designerId, data.reason);
  },
};

export const designEdges: readonly EdgeHandler[] = [
  assignedToInDesign,
  inDesignToDesignCompleted,
  reworkRequiredToInDesign,
  reworkRequiredToAssigned,
];
