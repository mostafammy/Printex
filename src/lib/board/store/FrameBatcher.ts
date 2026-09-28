/**
 * FrameBatcher coalescing store notifications within an animation frame.
 * (specs/017-press-floor-board/plan.md S1, S5, research.md R8)
 */

export type FrameScheduler = (callback: () => void) => number | NodeJS.Timeout | void | undefined;

export class FrameBatcher {
  readonly #scheduler: FrameScheduler;
  #pending = false;
  #flushCallback: (() => void) | null = null;

  constructor(scheduler?: FrameScheduler) {
    this.#scheduler =
      scheduler ??
      ((cb: () => void) => {
        if (typeof requestAnimationFrame === "function") {
          return requestAnimationFrame(cb);
        }
        return setTimeout(cb, 16);
      });
  }

  schedule(flushCallback: () => void): void {
    this.#flushCallback = flushCallback;
    if (this.#pending) return;

    this.#pending = true;
    this.#scheduler(() => {
      this.flush();
    });
  }

  flush(): void {
    if (!this.#pending) return;
    this.#pending = false;
    const cb = this.#flushCallback;
    this.#flushCallback = null;
    cb?.();
  }
}
