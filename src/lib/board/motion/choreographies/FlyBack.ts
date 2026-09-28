/**
 * FlyBackChoreography: FLIP return translation with horizontal shake on move refusal/cancel.
 * (research.md R5, contracts/board-engine.md §Motion tokens, plan.md S1)
 */

import type { Choreography } from "../ChoreographyRegistry";
import type { MotionContext } from "../../types";

export class FlyBackChoreography implements Choreography {
  run(el: HTMLElement, ctx: MotionContext): Animation[] {
    const fromRect = ctx.from;
    const currentRect = el.getBoundingClientRect();
    const dx = fromRect ? fromRect.left - currentRect.left : 0;
    const dy = fromRect ? fromRect.top - currentRect.top : 0;

    const duration = ctx.tokens?.durationFlyback ?? 420;

    const animation = el.animate(
      [
        { transform: `translate3d(${dx}px, ${dy}px, 0)` },
        { transform: `translate3d(${dx * 0.6}px, ${dy * 0.6}px, 0) translateX(-6px)` },
        { transform: `translate3d(${dx * 0.3}px, ${dy * 0.3}px, 0) translateX(6px)` },
        { transform: `translate3d(${dx * 0.1}px, ${dy * 0.1}px, 0) translateX(-3px)` },
        { transform: "translate3d(0, 0, 0)" },
      ],
      {
        duration,
        easing: "cubic-bezier(0.2, 0.9, 0.3, 1)",
        fill: "none",
      },
    );

    return [animation];
  }
}
