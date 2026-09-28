// @vitest-environment jsdom
/**
 * Unit tests for WaapiMotionDirector.
 * (T063, contracts/board-engine.md §MotionPort, research.md R5)
 */

import { describe, expect, it, vi } from "vitest";
import { ChoreographyRegistry } from "~/lib/board/motion/ChoreographyRegistry";
import { FlipMeasurer } from "~/lib/board/motion/FlipMeasurer";
import { ReducedMotionQuery } from "~/lib/board/motion/ReducedMotionQuery";
import { WaapiMotionDirector } from "~/lib/board/motion/WaapiMotionDirector";

describe("WaapiMotionDirector (T063, contracts/board-engine.md §MotionPort)", () => {
  it("executes registered choreography on target card element", async () => {
    const mockAnimation = {
      finished: Promise.resolve(),
      cancel: vi.fn(),
    } as unknown as Animation;

    const mockRun = vi.fn().mockReturnValue([mockAnimation]);
    const registry = new ChoreographyRegistry();
    registry.register("stamp", { run: mockRun });

    const el = document.createElement("div");
    el.setAttribute("data-card-id", "card-123");
    document.body.appendChild(el);

    const measurer = new FlipMeasurer();
    const reducedMotion = new ReducedMotionQuery({ matches: false } as unknown as MediaQueryList);

    const director = new WaapiMotionDirector({
      registry,
      measurer,
      reducedMotion,
    });

    await director.play("stamp", { cardId: "card-123" });
    expect(mockRun).toHaveBeenCalledWith(el, expect.objectContaining({ cardId: "card-123" }));

    document.body.removeChild(el);
  });

  it("skips animation completely when reduced motion is preferred", async () => {
    const mockRun = vi.fn();
    const registry = new ChoreographyRegistry();
    registry.register("travel", { run: mockRun });

    const el = document.createElement("div");
    el.setAttribute("data-card-id", "card-reduced");
    document.body.appendChild(el);

    const reducedMotion = new ReducedMotionQuery({ matches: true } as unknown as MediaQueryList);
    const director = new WaapiMotionDirector({
      registry,
      reducedMotion,
    });

    await director.play("travel", { cardId: "card-reduced" });
    expect(mockRun).not.toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("cancels previous active animation on the same element when new one plays", async () => {
    let finishFirstAnim: () => void = () => undefined;
    const cancelFirstAnim = vi.fn();

    const firstAnimation = {
      finished: new Promise<void>((resolve) => {
        finishFirstAnim = resolve;
      }),
      cancel: cancelFirstAnim,
    } as unknown as Animation;

    const secondAnimation = {
      finished: Promise.resolve(),
      cancel: vi.fn(),
    } as unknown as Animation;

    const registry = new ChoreographyRegistry();
    registry.register("travel", { run: vi.fn().mockReturnValue([firstAnimation]) });
    registry.register("stamp", { run: vi.fn().mockReturnValue([secondAnimation]) });

    const el = document.createElement("div");
    el.setAttribute("data-card-id", "card-double");
    document.body.appendChild(el);

    const reducedMotion = new ReducedMotionQuery({ matches: false } as unknown as MediaQueryList);
    const director = new WaapiMotionDirector({ registry, reducedMotion });

    // Start first animation
    const firstPromise = director.play("travel", { cardId: "card-double" });

    // Start second animation immediately
    const secondPromise = director.play("stamp", { cardId: "card-double" });

    // The first animation must have been cancelled
    expect(cancelFirstAnim).toHaveBeenCalled();

    finishFirstAnim();
    await Promise.all([firstPromise, secondPromise]);

    document.body.removeChild(el);
  });
});
