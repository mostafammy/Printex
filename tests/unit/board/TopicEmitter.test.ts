import { describe, expect, it, vi } from "vitest";
import { TopicEmitter } from "~/lib/board/store/TopicEmitter";

describe("TopicEmitter (fine-grained observer topics)", () => {
  it("notifies topic listeners when emitted", () => {
    const emitter = new TopicEmitter();
    const laneListener = vi.fn();
    const cardListener = vi.fn();

    const unsubLane = emitter.subscribe("lane:NEW", laneListener);
    emitter.subscribe("card:c1", cardListener);

    emitter.emit("lane:NEW");
    expect(laneListener).toHaveBeenCalledTimes(1);
    expect(cardListener).not.toHaveBeenCalled();

    emitter.emit("card:c1");
    expect(cardListener).toHaveBeenCalledTimes(1);

    unsubLane();
    emitter.emit("lane:NEW");
    expect(laneListener).toHaveBeenCalledTimes(1);
  });

  it("handles multiple listeners on the same topic cleanly", () => {
    const emitter = new TopicEmitter();
    const l1 = vi.fn();
    const l2 = vi.fn();

    const u1 = emitter.subscribe("meta", l1);
    emitter.subscribe("meta", l2);

    emitter.emit("meta");
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);

    u1();
    emitter.emit("meta");
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(2);
  });
});
