// SC-002 / issue acceptance #2: processing the same outbox event twice
// creates ONE notification (FR-007).
//
// The assertion is on the ABSENCE of a second row, not the absence of an
// error. A duplicate insert raises a unique-constraint violation that the
// processor catches and treats as success — so a test that only checked
// "no throw" would pass even if the feature were dropping every notification
// and swallowing the errors.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { processOutboxBatch } from "~/server/notifications";
import { recordOutboxEvent, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let designer: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  designer = await seedNotificationUser({ prefix: "notif-idempotency" });
});

describe("outbox idempotency (T017 / SC-002 / acceptance #2)", () => {
  it("creates exactly one notification when the same event is processed twice", async () => {
    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "work-item-fixture",
      recipientUserIds: [designer.userId],
      payload: { orderId: "order-fixture" },
    });

    // --- first pass -------------------------------------------------------
    const first = await processOutboxBatch();
    expect(first.processed).toBe(1);
    expect(first.notificationsCreated).toBe(1);

    // --- force it back to unprocessed and process again --------------------
    // This is the honest reproduction of "the same event processed twice":
    // the claim predicate is bypassed exactly as a concurrent processor or a
    // retried batch would bypass it.
    await testDb.notificationEvent.update({
      where: { id: eventId },
      data: { deliveredAt: null, deliveryStatus: "PENDING" },
    });

    const second = await processOutboxBatch();

    const rows = await testDb.notification.findMany({
      where: { sourceEventId: eventId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(designer.userId);
    // The second pass reports no NEW notification, because none was created.
    expect(second.notificationsCreated).toBe(0);

    // The outbox row is still correctly marked processed after the retry.
    const event = await testDb.notificationEvent.findUnique({ where: { id: eventId } });
    expect(event?.deliveryStatus).toBe("PROCESSED");
    expect(event?.deliveredAt).not.toBeNull();
  });

  it("holds under two concurrent processors", async () => {
    const eventId = await recordOutboxEvent({
      type: "workitem.assigned",
      entityId: "work-item-concurrent",
      recipientUserIds: [designer.userId],
    });

    // Two batches racing over the same row. Exactly one notification may
    // exist afterwards regardless of which processor wins, which is what the
    // @@unique pair guarantees and what the catch converts into success.
    await Promise.all([processOutboxBatch(), processOutboxBatch()]);

    const rows = await testDb.notification.findMany({ where: { sourceEventId: eventId } });
    expect(rows).toHaveLength(1);
  });

  it("keeps count(Notification) equal to count(distinct userId) per event", async () => {
    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "work-item-multi",
      recipientUserIds: [designer.userId],
    });
    await processOutboxBatch();
    await testDb.notificationEvent.update({
      where: { id: eventId },
      data: { deliveredAt: null, deliveryStatus: "PENDING" },
    });
    await processOutboxBatch();

    const rows = await testDb.notification.findMany({ where: { sourceEventId: eventId } });
    const distinct = new Set(rows.map((r) => r.userId));
    expect(rows).toHaveLength(distinct.size);
  });
});
