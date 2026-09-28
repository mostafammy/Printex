/**
 * ScreenDropPolicy: Strategy for SCREEN-kind moves.
 * Returns the card via fly-back animation (no optimistic update) and navigates
 * to the target screen (e.g., /pricing?workItem=...) via the provided router.
 * The move itself happens automatically once the screen action completes (PRI-66).
 * (contracts/board-engine.md §Drop policies, plan.md S1, US3, research.md R3)
 */

import type { MotionPort } from "../ports";
import type { DropContext, DropPolicy } from "./DropPolicy";

export interface ScreenDropPolicyDeps {
  readonly motion: MotionPort;
  readonly navigate: (href: string) => void;
}

export class ScreenDropPolicy implements DropPolicy {
  readonly #motion: MotionPort;
  readonly #navigate: ScreenDropPolicyDeps["navigate"];

  constructor(deps: ScreenDropPolicyDeps) {
    this.#motion = deps.motion;
    this.#navigate = deps.navigate;
  }

  async onDrop(ctx: DropContext): Promise<void> {
    const { card, option } = ctx;

    if (!option.screenHref) {
      throw new Error(`ScreenDropPolicy: missing screenHref for edge "${option.edgeId}"`);
    }

    // Fly the card back first — no optimistic update for screen transitions
    await this.#motion.play("fly-back", { cardId: card.id });

    // Navigate to the screen where the move is completed
    this.#navigate(option.screenHref);
  }
}
