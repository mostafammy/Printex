/**
 * InstantChoreography: 0ms duration no-op animation when prefers-reduced-motion is active.
 * (contracts/board-engine.md §Choreography, FR-031, plan.md S1)
 */

import type { Choreography } from "../ChoreographyRegistry";
import type { MotionContext } from "../../types";

export class InstantChoreography implements Choreography {
  run(el: HTMLElement, _ctx: MotionContext): Animation[] {
    const animation = el.animate(
      [
        { opacity: 0.8 },
        { opacity: 1 },
      ],
      {
        duration: 0,
        fill: "none",
      },
    );
    return [animation];
  }
}
