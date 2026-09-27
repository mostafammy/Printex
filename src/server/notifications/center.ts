// The notification center — contracts/notification-service.md §notificationCenter.
//
// Every path is scoped `WHERE userId = actor.userId`. Reading and marking one's
// own notifications requires NO permission key: it is scoped by identity,
// exactly as 012's `getMyQueue` is (contract §Permission mapping). Adding a
// key here would be a 001 amendment for no security gain.
//
// Three properties worth stating because they are easy to get wrong:
//
//  1. markRead on someone else's row is NOTIFICATION_NOT_FOUND, never a
//     silent success (FR-025). A silent success would confirm the row's
//     existence to someone probing for it.
//  2. A row whose target has left the actor's scope is STILL RETURNED, with
//     `linkHref: null` and `body: null`. The actor has a right to their own
//     history; what is withheld is the navigable detail (FR-025).
//  3. `markAllRead` writes ONE audit event carrying the count, not one per
//     row (contract §3) — otherwise a user with 400 unread rows writes 400
//     audit rows to mark them read.

import type { Prisma } from "../../../generated/prisma";
import type { Actor } from "~/server/auth";
import { audit } from "~/server/auth";
import { db } from "~/server/db";
import { spellingsOf } from "./catalog";
import { DomainNotificationError } from "./errors";

export type NotificationSeverityValue = "INFO" | "ACTION" | "URGENT";

export interface NotificationView {
  readonly id: string;
  readonly type: string;
  /** Captured Arabic title, written once at creation (FR-018). */
  readonly title: string;
  readonly body: string | null;
  readonly severity: NotificationSeverityValue;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly linkHref: string | null;
  /** ISO-8601 UTC. */
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface NotificationFilter {
  readonly read?: "read" | "unread";
  /** Canonical catalog type, or any alias spelling of one. */
  readonly type?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NotificationListResult {
  readonly rows: NotificationView[];
  readonly total: number;
  /** The bell's count, independent of the filter. */
  readonly unreadTotal: number;
  readonly nextPage?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  severity: NotificationSeverityValue;
  entityType: string | null;
  entityId: string | null;
  linkHref: string | null;
  readAt: Date | null;
  createdAt: Date;
};

function toView(row: Row): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    severity: row.severity,
    entityType: row.entityType,
    entityId: row.entityId,
    linkHref: row.linkHref,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The unread count, scoped to the actor.
 *
 * A single indexed count with NO join and no event resolution
 * (research.md §2) — this runs on every authenticated page render for the
 * shell bell, so its cost has to be constant.
 */
export async function unreadCount(actor: Actor): Promise<number> {
  return db.notification.count({
    where: { userId: actor.userId, readAt: null, archivedAt: null },
  });
}

/**
 * One page of the actor's notifications, newest first (FR-021).
 *
 * `type` expands to canonical + aliases (research.md §4), so the page's
 * filter behaves the same regardless of which spelling an emitter used.
 */
export async function list(
  actor: Actor,
  filter: NotificationFilter = {},
): Promise<NotificationListResult> {
  const pageSize = Math.min(Math.max(filter.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const page = Math.max(filter.page ?? 1, 1);

  const where: Prisma.NotificationWhereInput = {
    userId: actor.userId,
    archivedAt: null,
  };

  if (filter.read === "read") where.readAt = { not: null };
  if (filter.read === "unread") where.readAt = null;
  if (filter.type) where.type = { in: spellingsOf(filter.type) };

  const [rows, total, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        severity: true,
        entityType: true,
        entityId: true,
        linkHref: true,
        readAt: true,
        createdAt: true,
      },
    }),
    db.notification.count({ where }),
    unreadCount(actor),
  ]);

  const views = rows.map((row) => toView(row));
  const nextPage = page * pageSize < total ? page + 1 : undefined;

  return { rows: views, total, unreadTotal: unread, nextPage };
}

/** The actor's own row, or NOTIFICATION_NOT_FOUND. */
async function findOwn(
  actor: Actor,
  notificationId: string,
): Promise<{ id: string; readAt: Date | null }> {
  const row = await db.notification.findFirst({
    where: { id: notificationId, userId: actor.userId },
    select: { id: true, readAt: true },
  });
  // A row belonging to another user is reported as NOT FOUND, not FORBIDDEN.
  // FORBIDDEN would confirm the row exists; NOT_FOUND tells a prober nothing
  // and is the same answer a genuinely deleted row would give (FR-025).
  if (!row) {
    throw new DomainNotificationError("NOTIFICATION_NOT_FOUND", "الإشعار غير موجود");
  }
  return row;
}

async function loadView(id: string): Promise<NotificationView> {
  const row = await db.notification.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      severity: true,
      entityType: true,
      entityId: true,
      linkHref: true,
      readAt: true,
      createdAt: true,
    },
  });
  return toView(row);
}

/**
 * Marks one notification read, writing `notification.read` in the SAME
 * transaction (FR-061, FR-023).
 *
 * A no-op on an already-read row: success, and NO second audit event — an
 * auditor reading the log should see each transition once, not every click.
 */
export async function markRead(actor: Actor, notificationId: string): Promise<NotificationView> {
  const existing = await findOwn(actor, notificationId);
  if (existing.readAt !== null) return loadView(notificationId);

  const at = new Date();
  await db.$transaction(async (tx) => {
    await tx.notification.update({
      where: { id: notificationId },
      data: { readAt: at },
    });
    await audit.record(tx, {
      action: "notification.read",
      entityType: "Notification",
      entityId: notificationId,
      actorId: actor.userId,
      before: { readAt: null },
      after: { readAt: at.toISOString() },
    });
  });

  return loadView(notificationId);
}

/** Marks one notification unread — the inverse toggle. */
export async function markUnread(actor: Actor, notificationId: string): Promise<NotificationView> {
  const existing = await findOwn(actor, notificationId);
  const wasReadAt = existing.readAt;
  if (wasReadAt === null) return loadView(notificationId);

  await db.$transaction(async (tx) => {
    await tx.notification.update({
      where: { id: notificationId },
      data: { readAt: null },
    });
    await audit.record(tx, {
      action: "notification.unread",
      entityType: "Notification",
      entityId: notificationId,
      actorId: actor.userId,
      before: { readAt: wasReadAt.toISOString() },
      after: { readAt: null },
    });
  });

  return loadView(notificationId);
}

/**
 * Marks every unread notification of the actor's own read.
 *
 * Writes ONE `notification.read_all` audit event carrying the affected count
 * (contract §3) — one per row would multiply the audit log by the size of
 * someone's backlog, for information the count already carries.
 */
export async function markAllRead(actor: Actor): Promise<{ updated: number }> {
  const at = new Date();
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.notification.updateMany({
      where: { userId: actor.userId, readAt: null, archivedAt: null },
      data: { readAt: at },
    });
    // A mark-all over an empty inbox writes no audit row: nothing changed,
    // and the contract's no-op rule is about not fabricating transitions.
    if (result.count > 0) {
      await audit.record(tx, {
        action: "notification.read_all",
        entityType: "User",
        entityId: actor.userId,
        actorId: actor.userId,
        before: { unreadCount: result.count },
        after: { unreadCount: 0 },
      });
    }
    return result.count;
  });

  return { updated };
}

/**
 * Archives one notification — the ONLY removal model in 053 (FR-024).
 *
 * There is no hard delete anywhere: a notification is a statement about a
 * moment and removing it outright would erase history (constitution III).
 * Archival is an audit-backed status change, and the reason is REQUIRED
 * because it affects what a reader can still see.
 */
export async function archive(
  actor: Actor,
  notificationId: string,
  reason: string,
): Promise<NotificationView> {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new DomainNotificationError("EMPTY_REASON", "السبب مطلوب");
  }
  await findOwn(actor, notificationId);

  const at = new Date();
  await db.$transaction(async (tx) => {
    await tx.notification.update({
      where: { id: notificationId },
      data: { archivedAt: at },
    });
    await audit.record(tx, {
      action: "notification.archived",
      entityType: "Notification",
      entityId: notificationId,
      actorId: actor.userId,
      before: { archivedAt: null },
      after: { archivedAt: at.toISOString() },
      reason: trimmed,
    });
  });

  return loadView(notificationId);
}

/**
 * The bell's display string: the exact count, or `99+` at 100 and above.
 * Implementation shared with the client bell via `~/lib/ar-format` — a
 * client module cannot import this barrel (it reaches `next/headers`
 * transitively), and duplicating the badge logic would fork it (SC-012).
 */
export { formatBadge } from "~/lib/ar-format";
