/**
 * Cancellation Edge Handlers.
 * (research.md R3, FR-015, contracts/board-server.md §EdgeCatalog)
 */

import { z } from "zod";
import type { WorkItemState } from "~/server/core";
import { cancelWorkItem } from "~/server/orders";
import type { EdgeHandler } from "../edgeCatalog";

const cancelSchema = z.object({
  reason: z.string().trim().min(1, "يجب إدخال سبب الإلغاء"),
});

const CANCELLABLE_STATES: readonly WorkItemState[] = [
  "NEW",
  "ASSIGNED",
  "IN_DESIGN",
  "DESIGN_COMPLETED",
  "WAITING_REVIEW",
  "REWORK_REQUIRED",
  "APPROVED",
  "WAITING_PRICING",
  "READY_FOR_PRODUCTION",
  "IN_PRODUCTION",
  "PRODUCTION_COMPLETED",
  "READY_FOR_COLLECTION",
];

function createCancelHandler(fromState: WorkItemState): EdgeHandler {
  return {
    edgeId: `${fromState}->CANCELLED`,
    kind: "SHEET",
    sheet: "cancel",
    permission: "order.cancel",
    inputSchema: cancelSchema,
    backward: false,
    destructive: true,
    groupable: true,
    labelAr: "إلغاء أمر العمل",
    async execute(actor, card, input) {
      const data = cancelSchema.parse(input);
      await cancelWorkItem(actor, card.id, data.reason);
    },
  };
}

export const cancelEdges: readonly EdgeHandler[] = CANCELLABLE_STATES.map(createCancelHandler);
