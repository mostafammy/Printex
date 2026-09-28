/**
 * Arabic localized formatters for floor board feedback events.
 * (specs/017-press-floor-board/data-model.md §4, FR-014, plan.md S1)
 */

import type { WorkItemState } from "~/server/board";
import type { BoardCard } from "../types";

export function formatMoveCommitted(card: BoardCard): string {
  return `تم نقل "${card.title}" (${card.customerName}) بنجاح`;
}

export function formatMovedByOther(actorName: string, _toState: WorkItemState): string {
  return `نقلها ${actorName}`;
}

export function formatMoveRefused(messageAr: string): string {
  return messageAr;
}
