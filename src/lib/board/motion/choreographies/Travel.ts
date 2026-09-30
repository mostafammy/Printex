/**
 * TravelChoreography: FLIP translation with spring physics easing.
 * (research.md R5, contracts/board-engine.md §Motion tokens, plan.md S1)
 */

import type { Choreography } from "../ChoreographyRegistry";
import type { MotionContext } from "../../types";

export class TravelChoreography implements Choreography {
  run(el: HTMLElement, ctx: MotionContext): Animation[] {
    const fromRect = ctx.from;
    if (!fromRect) return [];

    const currentRect = el.getBoundingClientRect();
    const dx = fromRect.left - currentRect.left;
    const dy = fromRect.top - currentRect.top;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      return [];
    }

    const duration = ctx.tokens?.durationTravel ?? 380;
    const easing = ctx.tokens?.springEasing ?? "cubic-bezier(0.34, 1.56, 0.64, 1)";

    const animation = el.animate(
      [
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(1.03)` },
        { transform: "translate3d(0, 0, 0) scale(1)" },
      ],
      {
        duration,
        easing,
        fill: "none",
      },
    );

    return [animation];
  }
}
