// stage.ts — the derived pipeline stage (093's "milestone").
//
// The business asks for four named stages: RECEPTION → DESIGNER → ACCOUNTANT
// → PRINTER. The canonical model already has a richer, more precise vocabulary
// — `WorkItemState` — and constitution I forbids inventing a second status
// system. So the four stages are a pure, total FUNCTION over the state that
// already exists, and nothing stores them.
//
// The payoff is that a queue, a card badge and an authorisation check can all
// ask "is this item in the accountant stage?" and get the same answer, without
// anyone adding a column that could drift out of sync with `state`.

import { WORK_ITEM_STATES, type WorkItemState } from "~/server/core";

/**
 * The four business stages, in order. `PipelineStage` values are stable
 * strings so they can be used as URL segments, notification discriminators and
 * test fixtures without depending on the finer-grained state names.
 */
export type PipelineStage = "RECEPTION" | "DESIGNER" | "ACCOUNTANT" | "PRINTER";

/** The stage's position, for "next action" affordances and progress bars. */
export const PIPELINE_ORDER: readonly PipelineStage[] = [
  "RECEPTION",
  "DESIGNER",
  "ACCOUNTANT",
  "PRINTER",
] as const;

/**
 * States that belong to each stage.
 *
 * - RECEPTION  `NEW` — entered, not yet assigned.
 * - DESIGNER   everything from assignment through design completion. This is
 *              the roll class's whole designer stage: because ROLL items carry
 *              `requiresReview = false`, `markDesignComplete` lands them on
 *              `APPROVED` rather than `WAITING_REVIEW`.
 * - ACCOUNTANT `APPROVED` (reviewed/received, price to confirm) and
 *              `WAITING_PRICING` (explicitly parked in the pricing queue) —
 *              either way, an accountant's decision is what moves it on.
 * - PRINTER    released and beyond: production, collection, delivery, done.
 *
 * `REWORK_REQUIRED` sits in DESIGNER because a return sends the item back to
 * the designer who has to fix it; putting it anywhere else would tell a
 * designer their queue is empty while they still own the work.
 * `CANCELLED` has no stage — it is terminal and belongs to none of the queues.
 */
const STAGE_BY_STATE: Readonly<Record<WorkItemState, PipelineStage | null>> = {
  NEW: "RECEPTION",
  ASSIGNED: "DESIGNER",
  IN_DESIGN: "DESIGNER",
  DESIGN_COMPLETED: "DESIGNER",
  WAITING_REVIEW: "DESIGNER",
  REWORK_REQUIRED: "DESIGNER",
  APPROVED: "ACCOUNTANT",
  WAITING_PRICING: "ACCOUNTANT",
  READY_FOR_PRODUCTION: "PRINTER",
  IN_PRODUCTION: "PRINTER",
  PRODUCTION_COMPLETED: "PRINTER",
  READY_FOR_COLLECTION: "PRINTER",
  DELIVERED: "PRINTER",
  COMPLETED: "PRINTER",
  CANCELLED: null,
};

// Compile-time proof that the table covers every state: adding a state to
// `WORK_ITEM_STATES` without placing it here is a type error, not a runtime
// surprise.
type _AllStatesCovered = Exclude<WorkItemState, keyof typeof STAGE_BY_STATE> extends never
  ? true
  : never;
const _allStatesCovered: _AllStatesCovered = true;
void _allStatesCovered;
void WORK_ITEM_STATES;

/** The stage a state belongs to, or `null` when it belongs to none. */
export function stageOf(state: WorkItemState): PipelineStage | null {
  return STAGE_BY_STATE[state];
}

/** Every state in one stage — the predicate behind a role's queue. */
export function statesInStage(stage: PipelineStage): readonly WorkItemState[] {
  return Object.entries(STAGE_BY_STATE)
    .filter(([, value]) => value === stage)
    .map(([state]) => state as WorkItemState);
}

export function isInStage(state: WorkItemState, stage: PipelineStage): boolean {
  return STAGE_BY_STATE[state] === stage;
}

/** Zero-based position, or `null` for CANCELLED. Drives "stage 3 of 4". */
export function stageIndex(stage: PipelineStage | null): number | null {
  if (stage === null) return null;
  return PIPELINE_ORDER.indexOf(stage);
}
