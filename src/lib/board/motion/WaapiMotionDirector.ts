/**
 * WaapiMotionDirector: concrete MotionPort adapter coordinating ChoreographyRegistry,
 * FlipMeasurer, and ReducedMotionQuery using the Web Animations API (WAAPI).
 * (contracts/board-engine.md §MotionPort, plan.md S1, S2-A)
 */

import type { MotionPort } from "../ports";
import type { ChoreographyKind, MotionContext, RectLike } from "../types";
import { ChoreographyRegistry } from "./ChoreographyRegistry";
import { FlipMeasurer } from "./FlipMeasurer";
import { ReducedMotionQuery } from "./ReducedMotionQuery";
import { registerDefaultChoreographies } from "./registerDefaultChoreographies";
import { readMotionTokens } from "./tokens";

export interface WaapiMotionDirectorDeps {
  readonly registry?: ChoreographyRegistry;
  readonly measurer?: FlipMeasurer;
  readonly reducedMotion?: ReducedMotionQuery;
}

export class WaapiMotionDirector implements MotionPort {
  readonly #registry: ChoreographyRegistry;
  readonly #measurer: FlipMeasurer;
  readonly #reducedMotion: ReducedMotionQuery;
  readonly #activeAnimations = new Map<HTMLElement, Animation[]>();

  constructor(deps?: WaapiMotionDirectorDeps) {
    this.#registry = deps?.registry ?? registerDefaultChoreographies(new ChoreographyRegistry());
    this.#measurer = deps?.measurer ?? new FlipMeasurer();
    this.#reducedMotion = deps?.reducedMotion ?? new ReducedMotionQuery();
  }

  measure(cardId: string): RectLike | null {
    return this.#measurer.measure(cardId);
  }

  async play(kind: ChoreographyKind, ctx: MotionContext): Promise<void> {
    if (this.#reducedMotion.matches || kind === "instant") {
      return;
    }

    const element = this.resolveElement(ctx);
    if (!element) return;

    this.cancelActiveAnimations(element);

    const choreography = this.#registry.get(kind);
    if (!choreography) return;

    const tokens = ctx.tokens ?? readMotionTokens(element);
    const animations = choreography.run(element, { ...ctx, tokens });
    if (animations.length === 0) return;

    this.#activeAnimations.set(element, animations);

    try {
      await Promise.all(animations.map((a) => a.finished.catch(() => undefined)));
    } finally {
      this.#activeAnimations.delete(element);
    }
  }

  private resolveElement(ctx: MotionContext): HTMLElement | null {
    if (typeof document === "undefined") return null;
    if (ctx.cardId) {
      return document.querySelector<HTMLElement>(`[data-card-id="${ctx.cardId}"]`);
    }
    return null;
  }

  private cancelActiveAnimations(element: HTMLElement): void {
    const existing = this.#activeAnimations.get(element);
    if (existing) {
      for (const anim of existing) {
        try {
          anim.cancel();
        } catch {
          // Ignore cancellation errors
        }
      }
      this.#activeAnimations.delete(element);
    }
  }
}
