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
  it("a stopped loop does NOT deliver, and restarting resumes (FR-054)", async () => {
    // FIRST test in the file on purpose. The premise — "nothing delivers
    // while stopped" — can only be proven when no batch has EVER been
    // issued: a `void processOutboxBatch()` from an earlier test can sit
    // queued in Prisma's connection pool (not FIFO) and execute after this
    // record, regardless of how long the test waited or how many drains it
    // awaited itself. With this test first, the only claim queries that can
    // exist are ones this test awaited to completion.
    const before = await unreadCount(designer);

    stopOutboxProcessor();
    expect(isOutboxProcessorRunning()).toBe(false);

    const eventId = await recordOutboxEvent({
      type: "workitem.assigned",
      entityId: `loop-stopped-${Date.now()}`,
      recipientUserIds: [designer.userId],
    });

    // Stopped with no prior loop: the row sits unprocessed. This is the
    // assertion that the loop is what does the delivering — without it,
    // the manual calls in other tests would mask the missing trigger.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await unreadCount(designer)).toBe(before);

    // Scoped by THIS event's id. A deterministic entityId makes findFirst
    // return the previous suite run's row — already PROCESSED — and the
    // assertion then "fails" against a row this run never touched. That
    // single scoping mistake produced every flake this test ever had.
    const pending = await testDb.notificationEvent.findFirst({
      where: { id: eventId },
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
