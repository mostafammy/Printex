/**
 * Unit tests for FlipMeasurer, ReducedMotionQuery, and Motion tokens.
 * (T062, plan.md S5, research.md R5)
 */

import { describe, expect, it, vi } from "vitest";
import { FlipMeasurer } from "~/lib/board/motion/FlipMeasurer";
import { ReducedMotionQuery } from "~/lib/board/motion/ReducedMotionQuery";
import { DEFAULT_MOTION_TOKENS, readMotionTokens } from "~/lib/board/motion/tokens";

describe("motion-utils (T062, FlipMeasurer, ReducedMotionQuery, tokens)", () => {
  it("FlipMeasurer reads DOMRect from element and returns clean RectLike", () => {
    const mockElement = {
      getBoundingClientRect: () => ({
        top: 100,
        left: 50,
        width: 200,
        height: 120,
        bottom: 220,
        right: 250,
      }),
    } as unknown as Element;

    const measurer = new FlipMeasurer();
    const rect = measurer.measureElement(mockElement);

    expect(rect).toMatchObject({
      top: 100,
      left: 50,
      width: 200,
      height: 120,
      bottom: 220,
      right: 250,
    });
  });

  it("ReducedMotionQuery reports false by default and notifies subscribers on change", () => {
    type MqlChangeHandler = (e: { matches: boolean }) => void;
    let changeHandler: MqlChangeHandler | null = null;
    const mockMql = {
      matches: false,
      addEventListener: vi.fn((event: string, handler: MqlChangeHandler) => {
        if (event === "change") changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;

    const query = new ReducedMotionQuery(mockMql);
    expect(query.matches).toBe(false);

    const listener = vi.fn();
    const unsub = query.subscribe(listener);

    // Simulate OS toggle
    if (changeHandler !== null) {
      (changeHandler as MqlChangeHandler)({ matches: true });
    }
    expect(listener).toHaveBeenCalledWith(true);

    unsub();
    query.dispose();
    expect(mockMql.removeEventListener).toHaveBeenCalled();
  });

  it("readMotionTokens returns safe default tokens when variables are unset", () => {
    const tokens = readMotionTokens(null);
    expect(tokens.durationTravel).toBe(DEFAULT_MOTION_TOKENS.durationTravel);
    expect(tokens.springEasing).toBe(DEFAULT_MOTION_TOKENS.springEasing);
    expect(tokens.durationStamp).toBe(DEFAULT_MOTION_TOKENS.durationStamp);
  });
});
