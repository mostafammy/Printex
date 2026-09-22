// RejectionCategory — data-model.md enum, and the rejection-category ->
// landing-state mapping (correction #2 from code review).
//
// A literal union mirroring the Prisma `RejectionCategory` enum, kept as a
// `core`-owned type (not a re-export of the generated Prisma enum) for the
// same reason `WorkItemState` is a hand-declared union (plan.md §5.4):
// exhaustive `switch` checking via `assertNever`.

export const REJECTION_CATEGORIES = [
  "DESIGN_ISSUE",
  "DIMENSION_ISSUE",
  "CUSTOMER_CHANGE",
  "PRICING_ISSUE",
  "ACCOUNTING_ISSUE",
  "PRODUCTION_ISSUE",
  "MISSING_INFORMATION",
  "OTHER",
] as const;

export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];

export type ReworkLandingState = "IN_DESIGN" | "ASSIGNED";

/**
 * Rejection-category -> landing-state mapping (correction #2).
 *
 * Judgment call, documented here rather than derived from any PRD text:
 * ALL eight `RejectionCategory` values default to `IN_DESIGN`. None of them
 * is treated as auto-implying "reassign to a different designer":
 *
 * - DESIGN_ISSUE, DIMENSION_ISSUE, CUSTOMER_CHANGE, PRICING_ISSUE,
 *   ACCOUNTING_ISSUE, PRODUCTION_ISSUE are all reasons a design needs
 *   *rework*, not reasons the current designer is the wrong person for the
 *   job — the same designer who produced the artwork is normally best
 *   placed to fix it.
 * - MISSING_INFORMATION and OTHER were the two genuinely ambiguous
 *   candidates (a case can be made either way), but on inspection neither
 *   one is actually about the *assignee* being wrong — missing information
 *   is resolved by getting the information to whoever is already assigned,
 *   and OTHER is a catch-all with no signal at all. Reassignment is an
 *   *operational* decision a human (Head Designer / department lead) makes
 *   deliberately, not something a rejection reason should silently trigger.
 *
 * Consequence: `transitionWorkItem`'s caller can still explicitly request
 * `to: "ASSIGNED"` as the *next* transition out of `REWORK_REQUIRED` when a
 * human decides reassignment is actually needed — `REWORK_REQUIRED`'s edges
 * to both `IN_DESIGN` and `ASSIGNED` remain in `ALLOWED_EDGES` regardless of
 * `rejectionCategory` (data-model.md's allowed-edges table). This map is
 * advisory metadata (e.g. for a UI default/suggestion), not an enforcement
 * mechanism inside `transitionWorkItem` itself — `transitionWorkItem` only
 * validates `(from, to)` against `ALLOWED_EDGES`; it does not restrict `to`
 * based on `rejectionCategory` on the *landing* transition into
 * `REWORK_REQUIRED` (which has no `to` choice — `to` is always
 * `REWORK_REQUIRED` on that edge), nor on the subsequent transition out of
 * it (the caller decides `to` there, informed by, but not constrained by,
 * this table).
 */
export const REWORK_LANDING_STATE_BY_CATEGORY: Readonly<
  Record<RejectionCategory, ReworkLandingState>
> = {
  DESIGN_ISSUE: "IN_DESIGN",
  DIMENSION_ISSUE: "IN_DESIGN",
  CUSTOMER_CHANGE: "IN_DESIGN",
  PRICING_ISSUE: "IN_DESIGN",
  ACCOUNTING_ISSUE: "IN_DESIGN",
  PRODUCTION_ISSUE: "IN_DESIGN",
  MISSING_INFORMATION: "IN_DESIGN",
  OTHER: "IN_DESIGN",
} as const;
