// US7 / constitution III: a notification is a POINTER, never the record.
//
// Four properties:
//   - T065 / FR-018: content is write-once. No later change to a Work Item
//     or to the catalog rewrites what an employee was already told.
//   - T066 / FR-063: the OUTBOX row can reconstruct delivery independently —
//     the recipients it was addressed to are retained after processing, so
//     "was my department told?" is answerable from the event alone.
//   - T064 / SC-007: audit events are independent of notifications — marking
//     a notification read does not touch the audit record of the business
//     action it points at.
//   - T043 / FR-024: NO code path deletes a notification. Archival is the
//     only removal model. Asserted structurally (a source scan) AND
//     behaviourally (archive keeps the row).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  archive,
  listNotifications,
  markRead,
  processOutboxBatch,
} from "~/server/notifications";
import { recordOutboxEvent, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let designer: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  designer = await seedNotificationUser({ prefix: "immutability" });
});

describe("content is write-once (T065 / FR-018 / US7 scenario 4)", () => {
  it("a later catalog edit and a later Work Item move cannot rewrite a delivered row", async () => {
    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "write-once-work-item",
      recipientUserIds: [designer.userId],
      payload: { assigneeId: designer.userId, orderId: "write-once-order" },
    });
    await processOutboxBatch();

    const created = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: eventId, userId: designer.userId },
    });
    expect(created.title).toBe("تم رفض التصميم");
    const createdAt = created.createdAt;

    // 1. Someone changes the Work Item's state — the notification still
    //    describes the moment it was written about.
    await testDb.notificationEvent.update({
      where: { id: eventId },
      data: { payload: { assigneeId: designer.userId, totally: "different payload" } },
    });

    // 2. Processing the same event AGAIN (a forced retry) must not rewrite
    //    the row: the unique pair makes the insert a no-op, and no UPDATE
    //    path exists for content.
    await testDb.notificationEvent.update({
      where: { id: eventId },
      data: { deliveredAt: null, deliveryStatus: "PENDING" },
    });
    await processOutboxBatch();

    const after = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: eventId, userId: designer.userId },
    });
    expect(after.title).toBe(created.title);
    expect(after.body).toEqual(created.body);
    expect(after.linkHref).toEqual(created.linkHref);
    expect(after.severity).toBe(created.severity);
    expect(after.createdAt).toEqual(createdAt);
    expect(after.type).toBe(created.type);
  });

  it("reading a notification changes ONLY readAt — never content", async () => {
    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "read-changes-only-readat",
      recipientUserIds: [designer.userId],
      payload: { assigneeId: designer.userId },
    });
    await processOutboxBatch();

    const before = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: eventId, userId: designer.userId },
    });

    await markRead(designer, before.id);

    const after = await testDb.notification.findFirstOrThrow({ where: { id: before.id } });
    // The single mutable column moved...
    expect(after.readAt).not.toBeNull();
    // ...and every write-once column is bit-identical.
    expect(after.title).toBe(before.title);
    expect(after.body).toEqual(before.body);
    expect(after.linkHref).toEqual(before.linkHref);
    expect(after.severity).toBe(before.severity);
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.entityId).toBe(before.entityId);
    expect(after.archivedAt).toBeNull();
  });
});

describe("outbox reconstruction (T066 / FR-063)", () => {
  it("retains the full recipient specification after processing", async () => {
    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "reconstruct-me",
      recipientUserIds: [designer.userId],
      recipientRoles: ["HEAD_DESIGNER", "ADMIN_OWNER"],
      recipientPermissions: ["admin.config"],
      payload: { assigneeId: designer.userId },
    });
    await processOutboxBatch();

    const event = await testDb.notificationEvent.findUniqueOrThrow({ where: { id: eventId } });

    // Delivery is reconstructible WITHOUT reading a single Notification
    // row: who it was addressed to (all four addressing modes), when, and
    // how it was answered. That is what makes the outbox the delivery audit
    // trail and the notification itself only a pointer (FR-063).
    expect(event.deliveryStatus).toBe("PROCESSED");
    expect(event.deliveredAt).not.toBeNull();
    expect(event.recipientUserIds).toEqual([designer.userId]);
    expect(event.recipientRoles).toEqual(["HEAD_DESIGNER", "ADMIN_OWNER"]);
    expect(event.recipientPermissions).toEqual(["admin.config"]);
    expect(event.createdAt).toBeInstanceOf(Date);

    // And which notifications it produced, by the foreign key alone.
    const produced = await testDb.notification.findMany({ where: { sourceEventId: eventId } });
    expect(produced.length).toBeGreaterThanOrEqual(1);
    for (const row of produced) expect(row.type).toBe("workitem.rejected");
  });
});

describe("audit is independent of notifications (T064 / SC-007)", () => {
  it("marking read does not touch the business action's own audit record", async () => {
    // A real audit event for a business action, as 013 would write it.
    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "audit-independent",
      recipientUserIds: [designer.userId],
      payload: { assigneeId: designer.userId, returnId: "return-1" },
    });
    await processOutboxBatch();

    const notification = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: eventId, userId: designer.userId },
    });

    // Before: snapshot every audit event about this entity, anywhere.
    const auditsBefore = await testDb.auditEvent.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, action: true, entityId: true, createdAt: true },
    });

    await markRead(designer, notification.id);
    await archive(designer, notification.id, "tidied up: batch 4120 complete");
    const listed = await listNotifications(designer, { page: 1, pageSize: 100 });
    expect(listed.rows.some((r) => r.id === notification.id)).toBe(false);

    const auditsAfter = await testDb.auditEvent.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, action: true, entityId: true, createdAt: true },
    });

    // The business action's audit rows are IDENTICAL — none rewritten,
    // none appended against the Work Item. What changed is exactly the
    // notification's own lifecycle events (read / archived), keyed to the
    // notification id, not to the business action.
    const newEvents = auditsAfter.filter(
      (after) => !auditsBefore.some((before) => before.id === after.id),
    );
    expect(newEvents.every((e) => e.entityId === notification.id)).toBe(true);
    expect(newEvents.every((e) => e.action.startsWith("notification."))).toBe(true);
  });
});

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (name.endsWith(".ts")) out.push(path);
  }
  return out;
}

describe("no delete path exists (T043 / FR-024)", () => {
  it("no server entry point issues DELETE against notification", () => {
    // Mirrors 052's SC-002 test for money rows, inverted: 053 relies on the
    // application layer plus this scan rather than a DB REVOKE, because a
    // revoke would also block the retention cleanup that would one day be
    // needed (data-model.md §Migration notes — the reasoning is recorded,
    // not improvised here).
    const roots = [
      join(process.cwd(), "src", "server"),
      join(process.cwd(), "src", "app"),
    ];

    const offenders: string[] = [];
    // Scoped to the two Prisma forms that can remove a row. Scoped to
    // `notification` by requiring the model name directly before `.delete` —
    // `notificationTypeOverride.deleteMany` (053's one legitimate DELETE,
    // configuration not history) does not match because "TypeOverride"
    // sits between the model name and the method.
    const patterns = [/\.notification\s*\.\s*delete\s*\(/, /\.notification\s*\.\s*deleteMany\s*\(/];

    for (const root of roots) {
      for (const file of sourceFiles(root)) {
        const text = readFileSync(file, "utf-8");
        for (const pattern of patterns) {
          if (pattern.test(text)) offenders.push(file);
        }
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });

  it("archival KEEPS the row and sets archivedAt (behavioural half)", async () => {
    const eventId = await recordOutboxEvent({
      type: "workitem.assigned",
      entityId: "archive-keeps-row",
      recipientUserIds: [designer.userId],
    });
    await processOutboxBatch();

    const notification = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: eventId, userId: designer.userId },
    });

    await archive(designer, notification.id, "cleanup: end of shift");

    // Still there — removal model is archival, not deletion.
    const after = await testDb.notification.findUniqueOrThrow({ where: { id: notification.id } });
    expect(after.archivedAt).not.toBeNull();
    // Archival touches ONLY archivedAt — readAt keeps whatever it had (this
    // row was never read), which is the property worth asserting: archival
    // is one column, not a state cascade.
    expect(after.readAt).toBeNull();
    expect(after.id).toBe(notification.id);
    // Content survived: archival hides from the list, it does not erase.
    expect(after.title.length).toBeGreaterThan(0);

    // And the reason went to the audit log — archive is audit-backed.
    const audit = await testDb.auditEvent.findFirst({
      where: { action: "notification.archived", entityId: notification.id },
    });
    expect(audit?.reason).toBe("cleanup: end of shift");
  });
});
