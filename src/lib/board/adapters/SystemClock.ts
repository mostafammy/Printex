/**
 * Production adapter for Clock port using the system clock.
 * (specs/017-press-floor-board/contracts/board-engine.md §Ports, plan.md S2-D)
 */

import type { Clock } from "../ports";

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
