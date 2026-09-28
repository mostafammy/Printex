// @vitest-environment jsdom
/**
 * Unit tests for LiveChannel state machine.
 * (specs/017-press-floor-board/contracts/board-live-sse.md §LiveChannel, plan.md S3)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LiveChannel } from "~/lib/board/live/LiveChannel";
import type { BoardUpdate, LiveStatus } from "~/lib/board/types";

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, ((e?: unknown) => void)[]>();
  url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (e?: unknown) => void) {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  emit(event: string, data?: unknown) {
    const list = this.listeners.get(event) ?? [];
    for (const handler of list) {
      handler(data);
    }
  }

  close() {
    this.closed = true;
  }
}

describe("LiveChannel state machine (T122)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("transitions connecting -> open when hello received", () => {
    const statuses: LiveStatus[] = [];
    const channel = new LiveChannel("/api/board/stream", {
      onUpdate: () => undefined,
      onStatus: (s) => statuses.push(s),
      onResync: () => undefined,
    });

    expect(statuses).toEqual(["connecting"]);

    const es = MockEventSource.instances[0]!;
    es.emit("hello");

    expect(channel.state).toBe("open");
    expect(statuses).toEqual(["connecting", "open"]);

    channel.dispose();
    expect(channel.state).toBe("closed");
  });

  it("goes stale after 45s without any event", () => {
    const statuses: LiveStatus[] = [];
    const channel = new LiveChannel("/api/board/stream", {
      onUpdate: () => undefined,
      onStatus: (s) => statuses.push(s),
      onResync: () => undefined,
    });

    const es = MockEventSource.instances[0]!;
    es.emit("hello");

    vi.advanceTimersByTime(45000);
    expect(channel.state).toBe("stale");
    expect(statuses).toContain("stale");

    channel.dispose();
  });

  it("triggers onResync when reconnecting from stale", () => {
    let resyncCalled = false;
    const channel = new LiveChannel("/api/board/stream", {
      onUpdate: () => undefined,
      onStatus: () => undefined,
      onResync: () => { resyncCalled = true; },
    });

    const es = MockEventSource.instances[0]!;
    es.emit("hello");
    vi.advanceTimersByTime(45000); // -> stale

    es.emit("hello"); // reconnect
    expect(resyncCalled).toBe(true);

    channel.dispose();
  });

  it("forwards transition updates to onUpdate callback", () => {
    const updates: BoardUpdate[] = [];
    const channel = new LiveChannel("/api/board/stream", {
      onUpdate: (u) => updates.push(u),
      onStatus: () => undefined,
      onResync: () => undefined,
    });

    const es = MockEventSource.instances[0]!;
    const mockUpdate: BoardUpdate = {
      transitionId: "t-1",
      workItemId: "w-1",
      orderId: "o-1",
      from: "NEW",
      to: "READY_FOR_PRODUCTION",
      actor: { id: "u-1", name: "أحمد" },
      at: new Date().toISOString(),
    };

    es.emit("transition", { data: JSON.stringify(mockUpdate) });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.workItemId).toBe("w-1");

    channel.dispose();
  });
});
