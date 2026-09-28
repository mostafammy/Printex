"use client";

/**
 * useFocusRestoration hook: returns keyboard focus to the moved card after commit
 * or to its original position after refusal/cancel.
 * (specs/017-press-floor-board/contracts/board-engine.md §Accessibility contract, FR-020, plan.md S1)
 */

import { useEffect } from "react";
import type { BoardController } from "~/lib/board/BoardController";
import type { FeedbackCenter } from "~/lib/board/feedback/FeedbackCenter";

export function useFocusRestoration(controller: BoardController | null): void {
  useEffect(() => {
    if (!controller?.feedback) return;
    const center = controller.feedback as FeedbackCenter;
    if (typeof center.subscribe !== "function") return;

    return center.subscribe((event) => {
      const targetId = event.type === "MOVE_COMMITTED"
        ? event.card.id
        : event.type === "MOVE_REFUSED"
          ? event.cardId
          : null;

      if (targetId) {
        requestAnimationFrame(() => {
          document.getElementById(`card-${targetId}`)?.focus();
        });
      }
    });
  }, [controller]);
}
