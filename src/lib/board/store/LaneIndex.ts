/**
 * Sub-lane card index maintaining sorted card arrays per WorkItemState.
 * Binary-search insertion per FR-005 (urgent first, oldest enteredStationAt first).
 * (specs/017-press-floor-board/plan.md S1, S5, contracts/board-engine.md §BoardStore)
 */

import type { WorkItemState } from "~/server/board";
import type { BoardCard } from "../types";

function compareCards(a: BoardCard, b: BoardCard): number {
  if (a.priority !== b.priority) {
    return a.priority === "URGENT" ? -1 : 1;
  }
  const timeA = new Date(a.enteredStationAt).getTime();
  const timeB = new Date(b.enteredStationAt).getTime();
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return a.id.localeCompare(b.id);
}

const EMPTY_LANE: readonly string[] = Object.freeze([]);

export class LaneIndex {
  readonly #lanes = new Map<WorkItemState, string[]>();

  getLane(state: WorkItemState): readonly string[] {
    return this.#lanes.get(state) ?? EMPTY_LANE;
  }

  insert(
    state: WorkItemState,
    cardId: string,
    cards: ReadonlyMap<string, BoardCard>,
  ): void {
    const card = cards.get(cardId);
    if (!card) return;

    let lane = this.#lanes.get(state);
    if (!lane) {
      lane = [];
      this.#lanes.set(state, lane);
    }

    const idx = this.#findInsertIndex(lane, card, cards);
    lane.splice(idx, 0, cardId);
  }

  remove(state: WorkItemState, cardId: string): void {
    const lane = this.#lanes.get(state);
    if (!lane) return;
    const index = lane.indexOf(cardId);
    if (index !== -1) {
      lane.splice(index, 1);
    }
  }

  clear(): void {
    this.#lanes.clear();
  }

  #findInsertIndex(
    lane: readonly string[],
    card: BoardCard,
    cards: ReadonlyMap<string, BoardCard>,
  ): number {
    let low = 0;
    let high = lane.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      const midCard = cards.get(lane[mid]!);
      if (!midCard || compareCards(card, midCard) <= 0) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    return low;
  }
}
