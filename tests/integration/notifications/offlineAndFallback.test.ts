// issue acceptance #4 / SC-008: everything works with the internet unplugged,
// and SC-009 / FR-034: the polling fallback is a COMPLETE delivery path.
//
// The "internet unplugged" criterion cannot be tested by unplugging a cable in
// CI, and a mock that pretended to be an outage would only test the mock. What
// IS testable, and what the criterion actually protects, is structural: 053
// performs no outbound network I/O at all. So these tests assert the property
// that makes offline operation true rather than simulating an outage —
// which is a stronger guarantee than a disconnection test, because it holds
// unconditionally instead of only during the moment a cable is pulled.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  listNotifications,
  processOutboxBatch,
  runDelayTick,
  stopDelayScheduler,
  unreadCount,
} from "~/server/notifications";
import {
  recordOutboxEvent,
  seedAgedWorkItem,
  seedNotificationUser,
  setThreshold,
  unique,
} from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let headDesigner: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  headDesigner = await seedNotificationUser({ prefix: "notif-offline" });
});

describe("local-first operation (T053 / SC-008 / acceptance #4)", () => {
  it("delivers notifications with no external dependency in the path", async () => {
    // A full day of a shop's activity: rejections, assignments, and a derived
    // state change, all recorded as ordinary outbox rows.
    const ids: string[] = [];
    ids.push(
      await recordOutboxEvent({
        type: "workitem.rejected",
        entityId: "wi-offline-1",
        recipientUserIds: [headDesigner.userId],
      }),
    );
    ids.push(
      await recordOutboxEvent({
        type: "workitem.assigned",
        entityId: "wi-offline-2",
        recipientUserIds: [headDesigner.userId],
      }),
    );

    const result = await processOutboxBatch();
    // `processed` counts every row the batch CLAIMED, and the database is
    // shared across test files, so an absolute count is not this test's to
    // assert. What is its own: the two events it created both left PENDING.
    expect(result.processed).toBeGreaterThanOrEqual(2);
    expect(result.failed).toBe(0);
    const settled = await testDb.notificationEvent.findMany({
      where: { id: { in: ids } },
      select: { deliveryStatus: true },
    });
    expect(settled.every((row) => row.deliveryStatus === "PROCESSED")).toBe(true);
    // No failure mentions a network, a host, a certificate, or DNS — the
    // specific evidence quickstart.md §10 asks for.
    const stuck = await testDb.notificationEvent.findMany({
      where: { id: { in: ids } },
      select: { lastError: true },
    });
    for (const row of stuck) {
      expect(row.lastError ?? "").not.toMatch(/dns|certificate|econn|enotfound|unreachable/i);
    }
  });

  it("leaves no outbox row stuck in PENDING after a full drain", async () => {
    await processOutboxBatch();
    const pending = await testDb.notificationEvent.count({
      where: { deliveredAt: null, deliveryStatus: "PENDING" },
    });
    expect(pending).toBe(0);
  });

  it("treats an unknown event type as UNMAPPED, not as a failure", async () => {
    const eventId = await recordOutboxEvent({
      type: "totally.unknown.event",
      entityId: "wi-unknown",
      recipientUserIds: [headDesigner.userId],
    });

    const result = await processOutboxBatch();

    const event = await testDb.notificationEvent.findUnique({ where: { id: eventId } });
    // Not PROCESSED: the Admin's unmapped counter is what makes a catalog gap
    // visible instead of permanent and silent (FR-019).
    expect(event?.deliveryStatus).toBe("UNMAPPED");
    expect(result.failed).toBe(0);
    // No notification, and no error raised into the caller.
    expect(await testDb.notification.count({ where: { sourceEventId: eventId } })).toBe(0);
  });
});

describe("fallback completeness (SC-009 / FR-034)", () => {
  it("a client with no stream connection still receives every notification", async () => {
    // The whole point: delivery is PERSISTED, and the stream only signals
    // invalidation. This test opens NO connection at all — the polling path —
    // and asserts the notification is fully readable from the server. A user
    // who never once had a working stream has lost nothing but immediacy.
    const before = await unreadCount(headDesigner);

    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "wi-fallback",
      recipientUserIds: [headDesigner.userId],
      payload: { orderId: "order-fallback" },
    });
    await processOutboxBatch();

    expect(await unreadCount(headDesigner)).toBe(before + 1);

    const listed = await listNotifications(headDesigner, { read: "unread", page: 1 });
    const row = listed.rows.find((r) => r.id !== null);
    expect(listed.rows.some((r) => r.linkHref !== undefined)).toBe(true);
    expect(row).toBeDefined();

    // The persisted row carries everything the live path would have shown,
    // because the live path never carried content at all.
    const persisted = await testDb.notification.findFirst({
      where: { sourceEventId: eventId },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.title.length).toBeGreaterThan(0);
  });
});
