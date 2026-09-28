/**
 * ChoreographyRegistry: open-closed registry for WAAPI board animations.
 * (contracts/board-engine.md §Registries, plan.md S1, S2-O)
 */

import type { ChoreographyKind, MotionContext } from "../types";

export interface Choreography {
  run(el: HTMLElement, ctx: MotionContext): Animation[];
}

export class ChoreographyRegistry {
  private readonly choreographies = new Map<ChoreographyKind, Choreography>();

  register(kind: ChoreographyKind, choreography: Choreography): void {
    this.choreographies.set(kind, choreography);
  }

  get(kind: ChoreographyKind): Choreography | undefined {
    return this.choreographies.get(kind);
  }

  has(kind: ChoreographyKind): boolean {
    return this.choreographies.has(kind);
  }
}
