/**
 * LandChoreography: entrance animation with fade and rise for newly arrived cards.
 * (specs/017-press-floor-board/spec.md FR-030, research.md R5, plan.md S1)
 */

import type { Choreography } from "../ChoreographyRegistry";
import type { MotionContext } from "../../types";

export class LandChoreography implements Choreography {
  run(el: HTMLElement, ctx: MotionContext): Animation[] {
    const duration = ctx.tokens?.durationTravel ?? 380;
    const easing = ctx.tokens?.springEasing ?? "cubic-bezier(0.34, 1.56, 0.64, 1)";

    const animation = el.animate(
      [
        { transform: "translateY(16px) scale(0.96)", opacity: "0" },
        { transform: "translateY(-3px) scale(1.02)", opacity: "1", offset: 0.65 },
        { transform: "translateY(0) scale(1)", opacity: "1" },
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
