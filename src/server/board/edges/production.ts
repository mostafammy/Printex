/**
 * Production Edge Handlers.
 * (research.md R3, contracts/board-server.md §EdgeCatalog)
 */

import { z } from "zod";
import {
  DomainProductionError,
  completeProduction,
  routeToDepartment,
  sendBackToDesign,
  startProduction,
} from "~/server/production";
import type { EdgeHandler } from "../edgeCatalog";

const startProductionSchema = z
  .object({
    departmentId: z.string().trim().min(1).optional(),
  })
  .optional();

const completeProductionSchema = z.object({
  producedQuantity: z.number().int().positive("الكمية يجب أن تكون أكبر من صفر"),
  notes: z.string().trim().optional(),
});

const sendBackSchema = z.object({
  reason: z.string().trim().min(1, "يجب إدخال سبب الإعادة"),
});

export const readyForProductionToInProduction: EdgeHandler = {
  edgeId: "READY_FOR_PRODUCTION->IN_PRODUCTION",
  kind: "SHEET",
  sheet: "route-department",
  permission: "production.operate",
  departmentScoped: true,
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "بدء الإنتاج",
  inputSchema: startProductionSchema,
  needsInput(card) {
    return card.departmentId === null;
  },
  async execute(actor, card, input) {
    if (!card.departmentId) {
      const data = startProductionSchema.parse(input);
      if (!data?.departmentId) {
        throw new DomainProductionError(
          "WORK_ITEM_NOT_FOUND",
          "Work Item has no effective department",
        );
      }
      await routeToDepartment(actor, card.id, data.departmentId);
    }
    await startProduction(actor, card.id);
  },
};

export const inProductionToProductionCompleted: EdgeHandler = {
  edgeId: "IN_PRODUCTION->PRODUCTION_COMPLETED",
  kind: "SHEET",
  sheet: "complete-production",
  permission: "production.operate",
  departmentScoped: true,
  inputSchema: completeProductionSchema,
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "إتمام الإنتاج",
  async execute(actor, card, input) {
    const data = completeProductionSchema.parse(input);
    await completeProduction(actor, card.id, {
      producedQuantity: data.producedQuantity,
      notes: data.notes,
    });
  },
};

export const inProductionToReworkRequired: EdgeHandler = {
  edgeId: "IN_PRODUCTION->REWORK_REQUIRED",
  kind: "SHEET",
  sheet: "send-back",
  permission: "production.operate",
  departmentScoped: true,
  inputSchema: sendBackSchema,
  backward: true,
  destructive: false,
  groupable: false,
  labelAr: "إعادة للتصميم",
  async execute(actor, card, input) {
    const data = sendBackSchema.parse(input);
    await sendBackToDesign(actor, card.id, { reason: data.reason });
  },
};

export const productionEdges: readonly EdgeHandler[] = [
  readyForProductionToInProduction,
  inProductionToProductionCompleted,
  inProductionToReworkRequired,
];
