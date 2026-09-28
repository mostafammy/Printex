// Allowed-edges table — data-model.md (authoritative), plan.md §5.3, §5.5.
//
// CORRECTION applied per review: `REWORK_REQUIRED` is only ever a
// *destination*, reached from `WAITING_REVIEW`. It is NOT a forward edge
// from `ASSIGNED`; `ASSIGNED`'s only outgoing edges are `IN_DESIGN` and
// `CANCELLED`. `REWORK_REQUIRED`'s own outgoing edges (`IN_DESIGN` or
// `ASSIGNED`, depending on rejection category) are unaffected.
//
// 016-change-control research.md §7: `REWORK_REQUIRED` added as an allowed edge
// from `APPROVED`, `WAITING_PRICING`, and `READY_FOR_PRODUCTION` for customer-change
// send-back-to-design on items with an approved design.

import type { WorkItemState } from "./states";

export const ALLOWED_EDGES: Readonly<Record<WorkItemState, readonly WorkItemState[]>> = {
  NEW: ["ASSIGNED", "READY_FOR_PRODUCTION", "CANCELLED"],
  ASSIGNED: ["IN_DESIGN", "CANCELLED"],
  IN_DESIGN: ["DESIGN_COMPLETED", "CANCELLED"],
  DESIGN_COMPLETED: ["WAITING_REVIEW", "APPROVED", "CANCELLED"],
  WAITING_REVIEW: ["APPROVED", "REWORK_REQUIRED", "CANCELLED"],
  REWORK_REQUIRED: ["IN_DESIGN", "ASSIGNED", "CANCELLED"],
  APPROVED: ["WAITING_PRICING", "READY_FOR_PRODUCTION", "REWORK_REQUIRED", "CANCELLED"],
  WAITING_PRICING: ["READY_FOR_PRODUCTION", "REWORK_REQUIRED", "CANCELLED"],
  READY_FOR_PRODUCTION: ["IN_PRODUCTION", "REWORK_REQUIRED", "CANCELLED"],
  // 014-production research.md §2: REWORK_REQUIRED added for US5's
  // send-back-to-design from an in-production Work Item.
  IN_PRODUCTION: ["PRODUCTION_COMPLETED", "REWORK_REQUIRED", "CANCELLED"],
  PRODUCTION_COMPLETED: ["READY_FOR_COLLECTION", "CANCELLED"],
  READY_FOR_COLLECTION: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
} as const;
