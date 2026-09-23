// completeness.ts — pure, no-I/O logic (specs/011-orders-reception/data-model.md).
//
// Mirrors 002's deriveOrderStatus pattern: derived at read time, never
// persisted as a stored flag.

import type { WorkItemState } from "~/server/core";
import type { WorkItemDimensionUnit } from "../../../generated/prisma";

/**
 * FR-002 / Clarifications session 2026-09-23: an order is "complete" only
 * when every one of its Work Items has product type, quantity, width,
 * height, dimension unit, AND department set.
 */
export function isOrderComplete(order: {
  workItems: ReadonlyArray<{
    productTypeId: string | null;
    quantity: number | null;
    widthValue: unknown;
    heightValue: unknown;
    dimensionUnit: WorkItemDimensionUnit | null;
    departmentId: string | null;
  }>;
}): boolean {
  return order.workItems.every(
    (wi) =>
      wi.productTypeId !== null &&
      wi.quantity !== null &&
      wi.widthValue !== null &&
      wi.heightValue !== null &&
      wi.dimensionUnit !== null &&
      wi.departmentId !== null,
  );
}

/**
 * FR-011b: an order is "finished" (refuse `addWorkItem`) only when EVERY
 * Work Item has reached DELIVERED, COMPLETED, or CANCELLED. A single
 * still-open item is enough to allow appending.
 */
export function isOrderFinished(workItems: ReadonlyArray<{ state: WorkItemState }>): boolean {
  return workItems.every(
    (wi) => wi.state === "DELIVERED" || wi.state === "COMPLETED" || wi.state === "CANCELLED",
  );
}

/**
 * FR-012/FR-012a: `editWorkItem` refuses once a Work Item has left this set
 * — `NEW` and `ASSIGNED` are the only states preceding `IN_DESIGN` in 002's
 * allowed-edges table.
 */
export const PRE_DESIGN_EDITABLE_STATES: ReadonlySet<WorkItemState> = new Set(["NEW", "ASSIGNED"]);
