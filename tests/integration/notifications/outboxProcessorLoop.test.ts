// T024 / FR-028: the outbox must DELIVER without anyone poking it.
//
// Every other processor test calls `processOutboxBatch()` by hand, which
// proves the processor is correct — not that it RUNS. This file asserts the
// property the 2-second criterion actually depends on: an event recorded by
// an ordinary business action becomes a visible notification with no manual
// invocation, within the loop's interval, and that stopping the loop stops
// delivery (with stopping being reversible).

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  isOutboxProcessorRunning,
  processOutboxBatch,
  startOutboxProcessor,
  stopOutboxProcessor,
  unreadCount,
} from "~/server/notifications";
import { recordOutboxEvent, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  stopOutboxProcessor();
  await testDb.$disconnect();
});

afterEach(() => {
  stopOutboxProcessor();
});

let designer: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  designer = await seedNotificationUser({ prefix: "loop-designer" });
});

describe("outbox delivery loop (T024 / FR-028)", () => {
  it("start is idempotent — a second call does not stack an interval (FR-050)", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    startOutboxProcessor({ processorIntervalMs: 10_000 });
    startOutboxProcessor({ processorIntervalMs: 10 });

    expect(isOutboxProcessorRunning()).toBe(true);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    // The 100x-shorter interval from the second call did NOT take effect:
    // repeat starts are no-ops, not reconfigurations.

    setIntervalSpy.mockRestore();
  });

  it("delivers a recorded event with NO manual processOutboxBatch call", async () => {
    const before = await unreadCount(designer);

    await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "loop-delivery",
      recipientUserIds: [designer.userId],
      payload: { assigneeId: designer.userId },
    });

    // The whole point: nothing below invokes the processor. The loop does.
    startOutboxProcessor({ processorIntervalMs: 100 });

    await vi.waitFor(
      async () => {
        expect(await unreadCount(designer)).toBe(before + 1);
      },
      // Generous against a 100ms loop; the assertion that matters is
      // "arrives without being asked", not the exact millisecond.
      { timeout: 2000, interval: 50 },
    );
  });

  it("a stopped loop does NOT deliver, and restarting resumes (FR-054)", async () => {
    const before = await unreadCount(designer);

    // Stop FIRST and wait out any batch already in flight from the previous
    // test, so this row is recorded when nothing is scanning. `clearInterval`
    // cannot cancel a tick that is mid-`await`, and its claim query executes
    // on its own schedule — if that query lands after this record, it claims
    // the row and the "stopped means undelivered" assertion fails for a race
    // rather than for the reason it is testing. 500ms is an order of
    // magnitude above a local claim round-trip, which is what made this
    // flaky at 150ms under a full-suite load.
    stopOutboxProcessor();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await recordOutboxEvent({
      type: "workitem.assigned",
      entityId: "loop-stopped",
      recipientUserIds: [designer.userId],
    });

    // Stopped: the row sits unprocessed. This is the assertion that the loop
    // was the thing doing the delivering — without it, one of the manual
    // calls in other tests would mask the missing trigger.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await unreadCount(designer)).toBe(before);

    const pending = await testDb.notificationEvent.findFirst({
      where: { entityId: "loop-stopped" },
    });
    expect(pending?.deliveryStatus).toBe("PENDING");

    // Reversible: starting again delivers it (FR-054's stop must not
    // strand events).
    startOutboxProcessor({ processorIntervalMs: 100 });
    await vi.waitFor(
      async () => {
        expect(await unreadCount(designer)).toBe(before + 1);
      },
      { timeout: 2000, interval: 50 },
    );
  });

  it("a batch that was already processed by hand is not double-claimed", async () => {
    // Belt and braces: the loop's first immediate drain must tolerate a row
    // another processor already took — same catch-as-success path as the
    // manual double-run, exercised through the loop instead.
    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "loop-race",
      recipientUserIds: [designer.userId],
    });
    await processOutboxBatch();

    startOutboxProcessor({ processorIntervalMs: 50 });
    await new Promise((resolve) => setTimeout(resolve, 400));

    const rows = await testDb.notification.findMany({ where: { sourceEventId: eventId } });
    expect(rows).toHaveLength(1);
  });
});
