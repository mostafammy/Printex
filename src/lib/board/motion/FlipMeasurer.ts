/**
 * FlipMeasurer: reads and snapshots DOMRects for FLIP animations without layout thrashing.
 * (research.md R5, plan.md S1, S5)
 */

import type { RectLike } from "../types";

export class FlipMeasurer {
  private readonly root: Document | Element | null;

  constructor(root?: Document | Element | null) {
    this.root = root ?? (typeof document !== "undefined" ? document : null);
  }

  measure(cardId: string): RectLike | null {
    if (!this.root) return null;
    const element = this.root.querySelector(`[data-card-id="${cardId}"]`);
    if (!element) return null;
    return this.measureElement(element);
  }

  measureElement(element: Element): RectLike {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    };
  }
}
