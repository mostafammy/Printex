// SC-001 / issue acceptance #1: a rejection reaches the designer within
// 2 seconds, without a refresh (FR-028, FR-018).
//
// The 2-second bound is asserted on the SERVER side: the time from the event
// committing to the notification being readable. That is the part 053
// controls. A browser round-trip on a shop LAN is not something this test can
// or should measure, and a test that tried would be measuring the test
// machine, not the feature.
//
// "Without a refresh" is asserted structurally rather than with a timer: the
// stream `publish` is called for the recipient, and the signal carries
// identifiers only — never content — so the client must re-read through the
// server. The signal is what makes the notification visible without a page
// reload.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  listNotifications,
  processOutboxBatch,
  registerConnection,
  unregisterConnection,
  unreadCount,
} from "~/server/notifications";
import { recordOutboxEvent, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let designer: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  designer = await seedNotificationUser({ prefix: "notif-latency" });
});

describe("rejection latency (T020 / SC-001 / acceptance #1)", () => {
  it("makes a rejection readable by the designer inside 2 s, and signals the live path", async () => {
    // A "connected client": the stream registry is the same one the SSE route
    // writes to, so registering here is exactly what a connected browser does.
    const frames: string[] = [];
    const connection = registerConnection(designer.userId, (chunk) => frames.push(chunk));

    try {
      const eventId = await recordOutboxEvent({
        type: "workitem.rejected",
        entityType: "WorkItem",
        entityId: "work-item-rejected",
        recipientUserIds: [designer.userId],
        payload: { orderId: "order-rejected", assigneeId: designer.userId },
      });

      const before = Date.now();
      const result = await processOutboxBatch();
      const elapsed = Date.now() - before;

      expect(result.processed).toBe(1);
      // The bound is generous relative to a single indexed insert; the point
      // is that delivery is a local write, not a network round trip to a
      // push provider (constitution VII, PRD §52).
      expect(elapsed).toBeLessThan(2000);

      // --- the notification is immediately readable, no refresh -----------
      const listed = await listNotifications(designer, { page: 1 });
      const row = listed.rows.find((r) => r.type === "workitem.rejected");
      expect(row).toBeDefined();
      // The captured Arabic title is stored at creation (FR-018) — not
      // re-derived from the catalog at read time.
      expect(row!.title).toBe("تم رفض التصميم");
      expect(await unreadCount(designer)).toBeGreaterThanOrEqual(1);

      // --- and the live path was signalled -------------------------------
      const signal = frames.find((f) => f.startsWith("event: notification"));
      expect(signal).toBeDefined();
      // Identifiers and severity ONLY. A title here could leak a Work Item
      // the recipient may no longer view (FR-010).
      expect(signal).not.toContain("تم رفض التصميم");
      expect(signal).toContain(eventId);
      expect(signal).toContain("workitem.rejected");
    } finally {
      unregisterConnection(connection);
    }
  });

  it("signals ONLY the recipient, never another user (FR-032)", async () => {
    const bystander = await seedNotificationUser({ prefix: "notif-latency-bystander" });
    const bystanderFrames: string[] = [];
    const connection = registerConnection(bystander.userId, (c) => bystanderFrames.push(c));

    try {
      await recordOutboxEvent({
        type: "workitem.rejected",
        entityId: "work-item-private",
        recipientUserIds: [designer.userId],
      });
      await processOutboxBatch();

      // The bystander has a live connection and received nothing.
      expect(bystanderFrames).toHaveLength(0);
    } finally {
      unregisterConnection(connection);
    }
  });
});
