/**
 * StampChoreography: station ink bounce impact animation on move commit.
 * (research.md R5, contracts/board-engine.md §Motion tokens, plan.md S1)
 */

import type { Choreography } from "../ChoreographyRegistry";
import type { MotionContext } from "../../types";

export class StampChoreography implements Choreography {
  run(el: HTMLElement, ctx: MotionContext): Animation[] {
    const duration = ctx.tokens?.durationStamp ?? 220;
    const easing = ctx.tokens?.bounceEasing ?? "cubic-bezier(0.34, 1.56, 0.64, 1)";

    const animation = el.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.04)", filter: "brightness(1.08)" },
        { transform: "scale(0.98)", filter: "brightness(1)" },
        { transform: "scale(1)", filter: "brightness(1)" },
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
