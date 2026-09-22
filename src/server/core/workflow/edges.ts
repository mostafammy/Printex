// Allowed-edges table — data-model.md (authoritative), plan.md §5.3, §5.5.
//
// CORRECTION applied per review: `REWORK_REQUIRED` is only ever a
// *destination*, reached from `WAITING_REVIEW`. It is NOT a forward edge
// from `ASSIGNED`; `ASSIGNED`'s only outgoing edges are `IN_DESIGN` and
// `CANCELLED`. `REWORK_REQUIRED`'s own outgoing edges (`IN_DESIGN` or
// `ASSIGNED`, depending on rejection category) are unaffected.

import type { WorkItemState } from "./states";

export const ALLOWED_EDGES: Readonly<Record<WorkItemState, readonly WorkItemState[]>> = {
  NEW: ["ASSIGNED", "READY_FOR_PRODUCTION", "CANCELLED"],
  ASSIGNED: ["IN_DESIGN", "CANCELLED"],
  IN_DESIGN: ["DESIGN_COMPLETED", "CANCELLED"],
  DESIGN_COMPLETED: ["WAITING_REVIEW", "APPROVED", "CANCELLED"],
  WAITING_REVIEW: ["APPROVED", "REWORK_REQUIRED", "CANCELLED"],
  REWORK_REQUIRED: ["IN_DESIGN", "ASSIGNED", "CANCELLED"],
  APPROVED: ["WAITING_PRICING", "READY_FOR_PRODUCTION", "CANCELLED"],
  WAITING_PRICING: ["READY_FOR_PRODUCTION", "CANCELLED"],
  READY_FOR_PRODUCTION: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["PRODUCTION_COMPLETED", "CANCELLED"],
  PRODUCTION_COMPLETED: ["READY_FOR_COLLECTION", "CANCELLED"],
  READY_FOR_COLLECTION: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
} as const;
