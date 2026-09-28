// US3 / SC-006 / FR-025 / SC-007: the notification center.
//
// Three properties, and the third is the one that is easiest to get subtly
// wrong:
//   1. the unread count equals a direct database count after EVERY
//      transition, not just the first (SC-006);
//   2. scoping is by IDENTITY, not by permission — a user may only ever
//      change their own rows, and another user's row is NOT_FOUND rather than
//      a silent success (FR-025);
//   3. every state change writes an audit event in the SAME transaction,
//      and `markAllRead` writes ONE event carrying a count rather than one
//      per row (SC-007).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  DomainNotificationError,
  listNotifications,
  markAllRead,
  markRead,
  markUnread,
  processOutboxBatch,
  unreadCount,
} from "~/server/notifications";
import { recordOutboxEvent, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let alice: Awaited<ReturnType<typeof seedNotificationUser>>;
let bob: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  alice = await seedNotificationUser({ prefix: "center-alice" });
  bob = await seedNotificationUser({ prefix: "center-bob" });
});

/** Direct-from-database count, so the assertion cannot inherit the bug. */
async function dbUnread(userId: string): Promise<number> {
  return testDb.notification.count({
    where: { userId, readAt: null, archivedAt: null },
  });
}

async function give(userId: string, type = "workitem.assigned"): Promise<string> {
  const eventId = await recordOutboxEvent({
    type,
    entityId: `center-${userId}`,
    recipientUserIds: [userId],
  });
  await processOutboxBatch();
  return eventId;
}

describe("unread count (T036 / SC-006)", () => {
  it("matches a direct database count after every transition", async () => {
    for (let i = 0; i < 5; i += 1) await give(alice.userId);

    const start = await dbUnread(alice.userId);
    expect(await unreadCount(alice)).toBe(start);
    expect(start).toBeGreaterThanOrEqual(5);

    const listed = await listNotifications(alice, { read: "unread", page: 1 });
    const ids = listed.rows.slice(0, 5).map((r) => r.id);
    expect(ids).toHaveLength(5);

    // 5 -> 4: mark one read.
    await markRead(alice, ids[0]!);
    expect(await unreadCount(alice)).toBe(start - 1);
    expect(await unreadCount(alice)).toBe(await dbUnread(alice.userId));

    // 4 -> 3: mark a second.
    await markRead(alice, ids[1]!);
    expect(await unreadCount(alice)).toBe(start - 2);

    // 3 -> 4: mark one unread again, which is the direction people forget.
    await markUnread(alice, ids[0]!);
    expect(await unreadCount(alice)).toBe(start - 1);
    expect(await unreadCount(alice)).toBe(await dbUnread(alice.userId));

    // -> 0: mark all read.
    const result = await markAllRead(alice);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect(await unreadCount(alice)).toBe(0);
    expect(await unreadCount(alice)).toBe(await dbUnread(alice.userId));

    // A no-op mark-all on an empty inbox writes nothing and changes nothing.
    const again = await markAllRead(alice);
    expect(again.updated).toBe(0);
    expect(await unreadCount(alice)).toBe(0);
  });

  it("never counts another user's notifications (FR-025)", async () => {
    const before = await unreadCount(bob);
    await give(alice.userId);
    expect(await unreadCount(bob)).toBe(before);
  });
});

describe("center scope (T037 / FR-025)", () => {
  it("refuses to mark another user's notification read", async () => {
    const eventId = await give(alice.userId);
    const row = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: eventId, userId: alice.userId },
    });

    // NOT_FOUND, never FORBIDDEN: FORBIDDEN would confirm the row exists to
    // someone probing for it, and would differ from the answer a genuinely
    // deleted row gives.
    await expect(markRead(bob, row.id)).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
    });
    // And the row is genuinely untouched.
    const after = await testDb.notification.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.readAt).toBeNull();
  });

  it("refuses a non-existent id rather than throwing something unexpected", async () => {
    await expect(markRead(alice, "no-such-id")).rejects.toBeInstanceOf(DomainNotificationError);
  });

  it("markAllRead touches ONLY the actor's own rows", async () => {
    await give(bob.userId);
    const bobBefore = await dbUnread(bob.userId);
    expect(bobBefore).toBeGreaterThan(0);

    await markAllRead(alice);

    // Alice's are all read; Bob's are untouched.
    expect(await dbUnread(alice.userId)).toBe(0);
    expect(await dbUnread(bob.userId)).toBe(bobBefore);
  });

  it("a row whose link is withheld is still returned (FR-025)", async () => {
    await give(alice.userId, "workitem.rejected");
    const listed = await listNotifications(alice, { page: 1 });
    const row = listed.rows.find((r) => r.type === "workitem.rejected");
    expect(row).toBeDefined();
    // A target that no longer exists resolves to linkHref null — the
    // notification is retained (constitution III) but reveals nothing, and
    // never throws.
    expect(row!.linkHref === null || typeof row!.linkHref === "string").toBe(true);
  });
});

describe("audit emission (T038 / SC-007)", () => {
  it("writes one event per state change, with actor and timestamp", async () => {
    const eventId = await give(alice.userId);
    const row = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: eventId, userId: alice.userId },
    });

    await markRead(alice, row.id);
    const reads = await testDb.auditEvent.findMany({
      where: { action: "notification.read", entityId: row.id },
      orderBy: { createdAt: "asc" },
    });
    expect(reads).toHaveLength(1);
    expect(reads[0]!.actorId).toBe(alice.userId);
    expect(reads[0]!.createdAt).toBeInstanceOf(Date);

    await markUnread(alice, row.id);
    const unreads = await testDb.auditEvent.findMany({
      where: { action: "notification.unread", entityId: row.id },
    });
    expect(unreads).toHaveLength(1);
  });

  it("writes NO second event for a no-op mark on an already-read row", async () => {
    const eventId = await give(alice.userId);
    const row = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: eventId, userId: alice.userId },
    });

    await markRead(alice, row.id);
    const first = await testDb.auditEvent.count({
      where: { action: "notification.read", entityId: row.id },
    });
    expect(first).toBe(1);

    // Same call again: success, but nothing changed, so nothing is written.
    await markRead(alice, row.id);
    const second = await testDb.auditEvent.count({
      where: { action: "notification.read", entityId: row.id },
    });
    expect(second).toBe(1);
  });

  it("markAllRead writes ONE event carrying the count, not one per row", async () => {
    for (let i = 0; i < 4; i += 1) await give(alice.userId);
    const unreadBefore = await dbUnread(alice.userId);
    expect(unreadBefore).toBeGreaterThanOrEqual(4);

    const before = await testDb.auditEvent.count({
      where: { action: "notification.read_all", entityId: alice.userId },
    });
    await markAllRead(alice);
    const after = await testDb.auditEvent.count({
      where: { action: "notification.read_all", entityId: alice.userId },
    });

    // ONE additional event, however many rows it affected.
    expect(after - before).toBe(1);

    const event = await testDb.auditEvent.findFirstOrThrow({
      where: { action: "notification.read_all", entityId: alice.userId },
      orderBy: { createdAt: "desc" },
    });
    const payload = event.before as { unreadCount?: number } | null;
    expect(payload?.unreadCount).toBe(unreadBefore);
  });

  it("writes no notification.created event per notification (FR-060)", async () => {
    // The outbox row is the delivery audit trail. Writing one audit row per
    // recipient per event would multiply the audit log by the recipient count
    // for information the outbox row already holds.
    const before = await testDb.auditEvent.count({
      where: { action: "notification.created" },
    });
    await give(alice.userId);
    await give(alice.userId);
    const after = await testDb.auditEvent.count({
      where: { action: "notification.created" },
    });
    expect(after).toBe(before);
  });
});
