/**
 * ReworkArcChoreography: backward motion arc with signal-red pulse over 520ms.
 * (research.md R5, FR-018, FR-027a, plan.md S1)
 */

import type { Choreography } from "../ChoreographyRegistry";
import type { MotionContext } from "../../types";

export class ReworkArcChoreography implements Choreography {
  run(el: HTMLElement, ctx: MotionContext): Animation[] {
    const fromRect = ctx.from;
    const currentRect = el.getBoundingClientRect();

    const dx = fromRect ? fromRect.left - currentRect.left : 0;
    const dy = fromRect ? fromRect.top - currentRect.top : 0;

    const duration = ctx.tokens?.durationArc ?? 520;
    const easing = ctx.tokens?.bounceEasing ?? "cubic-bezier(0.34, 1.56, 0.64, 1)";

    const animation = el.animate(
      [
        {
          transform: `translate3d(${dx}px, ${dy - 20}px, 0) scale(1.02)`,
          borderColor: "rgba(239, 68, 68, 0.9)",
          boxShadow: "0 10px 25px -5px rgba(239, 68, 68, 0.3)",
        },
        {
          transform: `translate3d(${dx * 0.5}px, ${dy - 40}px, 0) scale(1.04)`,
          borderColor: "rgba(239, 68, 68, 1)",
          boxShadow: "0 15px 30px -5px rgba(239, 68, 68, 0.4)",
          offset: 0.5,
        },
        {
          transform: "translate3d(0, 0, 0) scale(1)",
          borderColor: "inherit",
          boxShadow: "none",
        },
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
