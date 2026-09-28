/**
 * RollOutChoreography: exit wipe animation along the flow axis for completed work items.
 * (specs/017-press-floor-board/spec.md FR-030, research.md R5, plan.md S1)
 */

import type { Choreography } from "../ChoreographyRegistry";
import type { MotionContext } from "../../types";

export class RollOutChoreography implements Choreography {
  run(el: HTMLElement, ctx: MotionContext): Animation[] {
    const duration = ctx.tokens?.durationRollout ?? 480;
    const easing = ctx.tokens?.springEasing ?? "cubic-bezier(0.2, 0.8, 0.2, 1)";

    const animation = el.animate(
      [
        { transform: "translateX(0) scale(1)", opacity: "1" },
        { transform: "translateX(-40px) scale(0.95)", opacity: "0" },
      ],
      {
        duration,
        easing,
        fill: "forwards",
      },
    );

    return [animation];
  }
}
