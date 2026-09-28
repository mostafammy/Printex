/**
 * LiftChoreography: subtle pick-up elevation with scale 1.03 and slight tilt.
 * (research.md R5, contracts/board-engine.md §Motion tokens, plan.md S1)
 */

import type { Choreography } from "../ChoreographyRegistry";
import type { MotionContext } from "../../types";

export class LiftChoreography implements Choreography {
  run(el: HTMLElement, _ctx: MotionContext): Animation[] {
    const animation = el.animate(
      [
        {
          transform: "scale(1) rotate(0deg)",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        },
        {
          transform: "scale(1.03) rotate(-1deg)",
          boxShadow: "0 12px 28px -6px rgba(0, 0, 0, 0.18)",
        },
      ],
      {
        duration: 180,
        easing: "cubic-bezier(0.2, 0.9, 0.3, 1)",
        fill: "forwards",
      },
    );
    return [animation];
  }
}
