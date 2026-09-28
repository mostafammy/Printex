/**
 * ReducedMotionQuery: wraps prefers-reduced-motion media query with reactive subscription.
 * (contracts/ink-tokens.md §Reduced motion, research.md R5, plan.md S1)
 */

export class ReducedMotionQuery {
  private readonly mediaQueryList: MediaQueryList | null = null;
  private readonly listeners = new Set<(matches: boolean) => void>();
  private readonly handler: (event: MediaQueryListEvent) => void;

  constructor(customMql?: MediaQueryList | null) {
    if (customMql !== undefined) {
      this.mediaQueryList = customMql;
    } else if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      this.mediaQueryList = window.matchMedia("(prefers-reduced-motion: reduce)");
    }

    this.handler = (e: MediaQueryListEvent) => {
      for (const listener of this.listeners) {
        listener(e.matches);
      }
    };

    if (this.mediaQueryList) {
      if (typeof this.mediaQueryList.addEventListener === "function") {
        this.mediaQueryList.addEventListener("change", this.handler);
      } else if (typeof (this.mediaQueryList as unknown as { addListener?: (cb: unknown) => void }).addListener === "function") {
        (this.mediaQueryList as unknown as { addListener: (cb: unknown) => void }).addListener(this.handler);
      }
    }
  }

  get matches(): boolean {
    return this.mediaQueryList?.matches ?? false;
  }

  subscribe(listener: (matches: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
    if (this.mediaQueryList) {
      if (typeof this.mediaQueryList.removeEventListener === "function") {
        this.mediaQueryList.removeEventListener("change", this.handler);
      } else if (typeof (this.mediaQueryList as unknown as { removeListener?: (cb: unknown) => void }).removeListener === "function") {
        (this.mediaQueryList as unknown as { removeListener: (cb: unknown) => void }).removeListener(this.handler);
      }
    }
  }
}
