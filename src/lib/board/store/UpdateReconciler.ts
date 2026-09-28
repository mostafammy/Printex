/**
 * UpdateReconciler: pure function reconciling live BoardUpdate with current store state.
 * (specs/017-press-floor-board/data-model.md §3.3, plan.md S1, FR-024, FR-026)
 */

import type { BoardUpdate } from "../types";

export type ReconcileAction =
  | { readonly type: "CONFIRM_OPTIMISTIC"; readonly cardId: string }
  | { readonly type: "APPLY_FOREIGN"; readonly update: BoardUpdate }
  | { readonly type: "IGNORE" };

export function reconcileUpdate(
  update: BoardUpdate,
  pendingTokenCardId: string | null,
): ReconcileAction {
  if (pendingTokenCardId && pendingTokenCardId === update.workItemId) {
    return { type: "CONFIRM_OPTIMISTIC", cardId: update.workItemId };
  }

  return { type: "APPLY_FOREIGN", update };
}
