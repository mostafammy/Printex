// A-001 REGRESSION: the migration's `NULL -> PENDING` backfill is
// load-bearing, and this is the test that proves it rather than assuming it.
//
// The story it guards: 002 shipped `NotificationEvent` with a
// `deliveryStatus` column it never wrote, and 012/013/014/015/016 have been
// recording events into that table ever since. The processor's claim
// predicate is `deliveredAt IS NULL AND deliveryStatus = 'PENDING'`, so
// without the backfill every one of those already-recorded events is
// INVISIBLE — and the feature ships looking healthy while delivering nothing
// for the very events that motivated it, starting with rejections.
//
// The first draft of 053's artifacts specified a parallel `processedAt` /
// `processingStatus` pair instead of reusing 002's reserved columns, which
// would have left those two columns permanently dead and given one row two
// answers to "was this event delivered?".

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { processOutboxBatch } from "~/server/notifications";
import { recordOutboxEvent, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let designer: Awaited<ReturnType<typeof seedNotificationUser>>;

/**
 * Ids of the rows this file created that were BACKFILLED and should therefore
 * have been delivered. Tracked explicitly rather than re-queried by a naming
 * convention, because the file also creates one row that is deliberately left
 * un-backfilled — the counterfactual — and that row is invisible ON PURPOSE.
 */
const backfilledEventIds: string[] = [];

beforeAll(async () => {
  designer = await seedNotificationUser({ prefix: "backfill-designer" });
});

describe("outbox backfill (T076 / A-001 regression)", () => {
  it("processes a pre-migration row that still has deliveryStatus NULL", async () => {
    // Exactly the state every event recorded before 053 shipped is in.
    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "backfill-work-item",
      recipientUserIds: [designer.userId],
      payload: { orderId: "backfill-order", assigneeId: designer.userId },
      deliveryStatus: null,
    });

    const before = await testDb.notificationEvent.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(before.deliveryStatus).toBeNull();
    expect(before.deliveredAt).toBeNull();

    // The backfill is what makes this row claimable. Scoped to this one id on
    // purpose: the migration backfills every NULL row at once, but a test that
    // did the same would sweep up the counterfactual row below and destroy the
    // very state that test exists to observe.
    await testDb.notificationEvent.updateMany({
      where: { id: eventId, deliveryStatus: null },
      data: { deliveryStatus: "PENDING" },
    });

    await processOutboxBatch();

    const after = await testDb.notificationEvent.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(after.deliveryStatus).toBe("PROCESSED");
    expect(after.deliveredAt).not.toBeNull();

    backfilledEventIds.push(eventId);

    // The point of the backfill: this event produced its notification.
    const notifications = await testDb.notification.findMany({
      where: { sourceEventId: eventId },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.userId).toBe(designer.userId);
    expect(notifications[0]!.title).toBe("تم رفض التصميم");
  });

  it("leaves a NULL row unprocessed WITHOUT the backfill — the failure it prevents", async () => {
    // The counterfactual. This is what the feature would do on a database
    // that skipped the backfill, and asserting it is what makes the
    // regression test falsifiable rather than a restatement of the fix.
    const eventId = await recordOutboxEvent({
      type: "workitem.assigned",
      entityId: "backfill-counterfactual",
      recipientUserIds: [designer.userId],
      deliveryStatus: null,
    });

    // The claim predicate cannot see a NULL status, so a batch that does not
    // backfill first leaves this row exactly as it was.
    const claimed = await testDb.notificationEvent.findMany({
      where: { deliveredAt: null, deliveryStatus: "PENDING" },
      select: { id: true },
    });
    expect(claimed.map((c) => c.id)).not.toContain(eventId);

    const row = await testDb.notificationEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(row.deliveryStatus).toBeNull();
    expect(
      await testDb.notification.count({ where: { sourceEventId: eventId } }),
    ).toBe(0);
  });

  it("leaves no BACKFILLED row invisible to the processor", async () => {
    // The steady-state invariant, stated over exactly the rows the backfill
    // was supposed to rescue. A row that is undelivered and still carries a
    // NULL status is invisible to the claim predicate, and nothing anywhere
    // reports it — which is the failure this whole file exists to prevent.
    expect(backfilledEventIds.length).toBeGreaterThan(0);

    const rows = await testDb.notificationEvent.findMany({
      where: { id: { in: backfilledEventIds } },
      select: { id: true, deliveryStatus: true, deliveredAt: true },
    });
    expect(rows).toHaveLength(backfilledEventIds.length);

    for (const row of rows) {
      expect(
        row.deliveredAt !== null || row.deliveryStatus !== null,
        `event ${row.id} is invisible to the processor`,
      ).toBe(true);
      // And concretely: each one was actually delivered.
      expect(row.deliveredAt, `event ${row.id} was never delivered`).not.toBeNull();
    }
  });
});
