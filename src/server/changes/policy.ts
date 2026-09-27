// policy.ts — Change control edit and redesign policies.
// contracts/change-control.md, data-model.md §Derived values.

import { assertNever, type WorkItemState } from "~/server/core";

export type SpecEditPolicy = "DIRECT" | "CHANGE_REQUEST" | "ADMIN_ONLY" | "LOCKED";
export type RedesignChoice = "REQUIRED" | "FORBIDDEN";

/**
 * Determines the specification edit policy for a given Work Item state.
 * FR-006: 9 DIRECT, 1 CHANGE_REQUEST, 4 ADMIN_ONLY, 1 LOCKED.
 */
export function specEditPolicy(state: WorkItemState): SpecEditPolicy {
  switch (state) {
    case "NEW":
    case "ASSIGNED":
    case "IN_DESIGN":
    case "DESIGN_COMPLETED":
    case "WAITING_REVIEW":
    case "REWORK_REQUIRED":
    case "APPROVED":
    case "WAITING_PRICING":
    case "READY_FOR_PRODUCTION":
      return "DIRECT";
    case "IN_PRODUCTION":
      return "CHANGE_REQUEST";
    case "PRODUCTION_COMPLETED":
    case "READY_FOR_COLLECTION":
    case "DELIVERED":
    case "COMPLETED":
      return "ADMIN_ONLY";
    case "CANCELLED":
      return "LOCKED";
    default:
      return assertNever(state);
  }
}

/**
 * Determines whether a redesign choice is REQUIRED or FORBIDDEN for direct spec edits.
 * REQUIRED iff state in {APPROVED, WAITING_PRICING, READY_FOR_PRODUCTION} and requiresDesign is true.
 */
export function redesignChoice(
  state: WorkItemState,
  requiresDesign: boolean,
): RedesignChoice {
  if (
    requiresDesign &&
    (state === "APPROVED" ||
      state === "WAITING_PRICING" ||
      state === "READY_FOR_PRODUCTION")
  ) {
    return "REQUIRED";
  }
  return "FORBIDDEN";
}

/**
 * For change request approvals: REDESIGN outcome is allowed iff requiresDesign and non-empty assigneeId.
 */
export function canRedesignOnApproval(input: {
  requiresDesign: boolean;
  assigneeId: string | null | undefined;
}): boolean {
  return (
    input.requiresDesign &&
    input.assigneeId != null &&
    input.assigneeId.trim() !== ""
  );
}
