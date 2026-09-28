/**
 * WorkItemsSource: searches in-memory cards from the board store.
 * (specs/017-press-floor-board/plan.md S1, S5, research.md R11)
 */

import type { WorkItemState } from "~/server/board";
import type { BoardCard } from "../../types";
import type { BoardStore } from "../../store/BoardStore";
import type { CommandItem, CommandSource } from "../CommandBarRegistry";

const BOARD_LANES: readonly WorkItemState[] = [
  "NEW",
  "ASSIGNED",
  "IN_DESIGN",
  "DESIGN_COMPLETED",
  "WAITING_REVIEW",
  "APPROVED",
  "REWORK_REQUIRED",
  "WAITING_PRICING",
  "READY_FOR_PRODUCTION",
  "IN_PRODUCTION",
  "PRODUCTION_COMPLETED",
  "READY_FOR_COLLECTION",
  "DELIVERED",
];

export class WorkItemsSource implements CommandSource {
  readonly id = "work-items";
  readonly labelAr = "بطاقات العمل";
  readonly #store: BoardStore;

  constructor(store: BoardStore) {
    this.#store = store;
  }

  #matchesQuery(card: BoardCard, q: string): boolean {
    return (
      card.title.toLowerCase().includes(q) ||
      card.customerName.toLowerCase().includes(q) ||
      String(card.orderNumber).includes(q)
    );
  }

  #collectLaneMatches(
    state: WorkItemState,
    q: string,
    results: CommandItem[],
  ): void {
    const ids = this.#store.getLane(state);
    for (const id of ids) {
      if (results.length >= 10) return;
      const card = this.#store.getCard(id);
      if (card && this.#matchesQuery(card, q)) {
        results.push({
          id: `card-${card.id}`,
          title: `${card.title} (#${card.orderNumber})`,
          subtitle: `${card.customerName} — ${card.state}`,
          href: `/orders/${card.orderId}/items/${card.id}`,
          category: "بطاقة عمل",
          icon: "Layers",
        });
      }
    }
  }

  async search(query: string): Promise<readonly CommandItem[]> {
    const q = query.trim().toLowerCase();
    if (!q || this.#store.getMeta().totalVisible === 0) return [];

    const matches: CommandItem[] = [];
    for (const state of BOARD_LANES) {
      this.#collectLaneMatches(state, q, matches);
      if (matches.length >= 10) break;
    }

    return matches;
  }
}
