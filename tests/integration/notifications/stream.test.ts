// US4 / FR-028 / FR-032 / FR-033 / FR-034: the stream is a HINT CHANNEL.
//
// The contract's central claim is that the fallback is a COMPLETE delivery
// path, because delivery is persisted and the stream only signals
// invalidation. These tests assert that claim structurally rather than by
// simulating an outage: what matters is that the row exists regardless of any
// connection, and that a connection can only ever affect immediacy.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  connectionCount,
  connectionsFor,
  listNotifications,
  processOutboxBatch,
  publish,
  registerConnection,
  resetRegistry,
  serializeSignal,
  unregisterConnection,
  unreadCount,
} from "~/server/notifications";
import { recordOutboxEvent, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});
afterEach(() => resetRegistry());

let alice: Awaited<ReturnType<typeof seedNotificationUser>>;
let bob: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  alice = await seedNotificationUser({ prefix: "stream-alice" });
  bob = await seedNotificationUser({ prefix: "stream-bob" });
});

describe("stream delivery (T044 / FR-028 / SC-001)", () => {
  it("signals a connected client, and the notification is readable after", async () => {
    const frames: string[] = [];
    const connection = registerConnection(alice.userId, (c) => frames.push(c));

    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "stream-delivery",
      recipientUserIds: [alice.userId],
    });
    await processOutboxBatch();

    // The client was told to re-read...
    const signal = frames.find((f) => f.startsWith("event: notification"));
    expect(signal).toBeDefined();
    expect(signal).toContain(eventId);

    // ...and the re-read is what supplies the content. The signal alone is
    // not enough, and never was: it carries no title, body, or link.
    const listed = await listNotifications(alice, { page: 1 });
    expect(listed.rows.some((r) => r.id.length > 0)).toBe(true);
    expect(await unreadCount(alice)).toBeGreaterThanOrEqual(1);

    unregisterConnection(connection);
  });

  it("carries identifiers and severity ONLY (FR-010)", () => {
    // `serializeSignal` is the data line alone; the registry wraps it in the
    // `event:`/`data:` SSE frame.
    const json = serializeSignal({ id: "n1", type: "workitem.rejected", severity: "ACTION" });
    const payload = JSON.parse(json) as Record<string, unknown>;
    // Exactly three keys. A title added here could leak a Work Item the
    // recipient may no longer be permitted to view; a type string cannot.
    expect(Object.keys(payload).sort()).toEqual(["id", "severity", "type"]);
    expect(payload).toEqual({ id: "n1", type: "workitem.rejected", severity: "ACTION" });
  });

  it("one user may hold several connections and all are signalled", async () => {
    const first: string[] = [];
    const second: string[] = [];
    const a = registerConnection(alice.userId, (c) => first.push(c));
    const b = registerConnection(alice.userId, (c) => second.push(c));
    expect(connectionsFor(alice.userId)).toBe(2);

    await recordOutboxEvent({
      type: "workitem.assigned",
      entityId: "stream-two-tabs",
      recipientUserIds: [alice.userId],
    });
    await processOutboxBatch();

    expect(first.some((f) => f.startsWith("event: notification"))).toBe(true);
    expect(second.some((f) => f.startsWith("event: notification"))).toBe(true);

    unregisterConnection(a);
    unregisterConnection(b);
  });
});

describe("stream isolation (T045 / FR-032)", () => {
  it("never delivers one user's notification to another (FR-032)", async () => {
    const aliceFrames: string[] = [];
    const bobFrames: string[] = [];
    const a = registerConnection(alice.userId, (c) => aliceFrames.push(c));
    const b = registerConnection(bob.userId, (c) => bobFrames.push(c));

    await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "stream-private",
      recipientUserIds: [alice.userId],
    });
    await processOutboxBatch();

    expect(aliceFrames.length).toBeGreaterThan(0);
    // Bob is connected and receives nothing at all — not even a count event.
    expect(bobFrames).toHaveLength(0);
    // And Bob's own read path is empty for that event.
    expect(await unreadCount(bob)).toBe(0);

    unregisterConnection(a);
    unregisterConnection(b);
  });

  it("publish() to a user with no connections is a no-op, not an error", () => {
    expect(publish("nobody-connected", { id: "x", type: "t", severity: "INFO" })).toBe(0);
  });

  it("reclaiming a dead connection removes its registry slot (FR-033)", () => {
    // A socket that throws on write — a peer that vanished without a clean
    // close. Without reclaiming, a machine that slept would hold a slot until
    // the process restarted.
    registerConnection(alice.userId, () => {
      throw new Error("EPIPE");
    });
    expect(connectionsFor(alice.userId)).toBe(1);

    publish(alice.userId, { id: "x", type: "t", severity: "INFO" });

    expect(connectionsFor(alice.userId)).toBe(0);
    expect(connectionCount()).toBe(0);
  });
});

describe("stream capacity (T046 / FR-033)", () => {
  it("drops the SIGNAL on a congested connection, never the notification", () => {
    // `inFlight` stands in for a socket whose buffer is full. The frame is
    // dropped rather than queued without bound, and because delivery is
    // persisted the client loses immediacy, not the notification.
    const delivered: string[] = [];
    const connection = registerConnection(alice.userId, (c) => delivered.push(c));

    // Simulate a write already in flight by driving the same path twice with
    // the connection marked busy between them.
    connection.inFlight = true;
    publish(alice.userId, { id: "dropped", type: "workitem.rejected", severity: "ACTION" });
    expect(delivered).toHaveLength(0);

    connection.inFlight = false;
    publish(alice.userId, { id: "delivered", type: "workitem.rejected", severity: "ACTION" });
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toContain("delivered");

    unregisterConnection(connection);
  });

  it("unregistering twice is a no-op, not an error (FR-033)", () => {
    const connection = registerConnection(alice.userId, () => undefined);
    unregisterConnection(connection);
    expect(() => unregisterConnection(connection)).not.toThrow();
    expect(connectionCount()).toBe(0);
  });
});

describe("fallback completeness (T047 / FR-034 / SC-009)", () => {
  it("a client with NO connection still receives every notification", async () => {
    // No registerConnection at all. This is the polling path in its purest
    // form: the browser's EventSource is broken, or absent, forever.
    const before = await unreadCount(alice);
    expect(connectionCount()).toBe(0);

    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "stream-fallback",
      recipientUserIds: [alice.userId],
      payload: { orderId: "fallback-order" },
    });
    await processOutboxBatch();

    // Everything the live path would have produced is present, because the
    // live path never produced any of it — it only signalled.
    expect(await unreadCount(alice)).toBeGreaterThanOrEqual(before + 1);

    // Scoped to THIS event and THIS recipient. The database is shared, and a
    // recipient override another test installs can add recipients — so the
    // count that matters is "did my notification arrive", not "am I the only
    // one who got one".
    const rows = await testDb.notification.findMany({
      where: { sourceEventId: eventId, userId: alice.userId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("تم رفض التصميم");
    expect(rows[0]!.readAt).toBeNull();
    expect(rows[0]!.severity).toBe("ACTION");
  });

  it("a later connection receives no backlog — it re-reads instead (FR-034)", async () => {
    // The signal is a hint, never a queue. A client connecting after the
    // fact is not replayed old notifications; it polls and finds them. This
    // is why no notification is lost when a stream drops: the row is the
    // durable record, and the stream was never holding it.
    const frames: string[] = [];
    const connection = registerConnection(alice.userId, (c) => frames.push(c));
    expect(frames).toHaveLength(0);

    const listed = await listNotifications(alice, { read: "unread", page: 1 });
    expect(listed.unreadTotal).toBeGreaterThan(0);

    unregisterConnection(connection);
  });
});
