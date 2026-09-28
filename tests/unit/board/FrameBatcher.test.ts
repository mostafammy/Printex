import { describe, expect, it, vi } from "vitest";
import { FrameBatcher } from "~/lib/board/store/FrameBatcher";

describe("FrameBatcher (rAF coalescing)", () => {
  it("coalesces multiple requests within one frame to fire once", () => {
    let scheduledCallback: (() => void) | null = null;
    const fakeScheduler = (cb: () => void) => {
      scheduledCallback = cb;
      return 1;
    };

    const batcher = new FrameBatcher(fakeScheduler);
    const mockFlush = vi.fn();

    batcher.schedule(mockFlush);
    batcher.schedule(mockFlush);
    batcher.schedule(mockFlush);

    expect(mockFlush).not.toHaveBeenCalled();
    expect(scheduledCallback).not.toBeNull();

    // Trigger frame
    scheduledCallback!();
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });
});
