// Per-catalog-type recipient overrides — FR-017, contract §recipientOverride.
//
// The seam that makes delivery CONFIGURATION rather than code: an Admin can
// redirect who hears about an event without a deploy, and without editing the
// catalog. It is the only piece of 053 that DELETEs anything, and what it
// deletes is a *configuration* row — never a notification, a breach, or an
// audit record (constitution III is preserved because nothing that records
// what happened is being erased).
//
// SEMANTICS, stated once and enforced in `unionSpecs` (recipients.ts): an
// override UNIONS with the catalog default. A non-empty array adds recipients
// and cannot remove the catalog's own. This is why "clear" is a DELETE rather
// than an empty array — under union semantics the two are indistinguishable.

import { z } from "zod";
import type { Actor } from "~/server/auth";
import { ALL_PERMISSIONS, ALL_ROLE_KEYS, audit, authorize } from "~/server/auth";
import { db } from "~/server/db";
import { lookup } from "./catalog";
import type { RecipientSpec } from "./recipients";
import { DomainNotificationError } from "./errors";

/** The row as the Admin screen reads it. */
export interface OverrideView {
  readonly type: string;
  readonly userIds: readonly string[];
  readonly roles: readonly string[];
  readonly departmentIds: readonly string[];
  readonly permissions: readonly string[];
  readonly updatedAt: string;
  readonly updatedById: string | null;
}

export interface SetRecipientOverrideInput {
  readonly type: string;
  readonly userIds?: readonly string[];
  readonly roles?: readonly string[];
  readonly departmentIds?: readonly string[];
  readonly permissions?: readonly string[];
  /** REQUIRED — validated before `audit.record`, never after (FR-062). */
  readonly reason: string;
}

const stringArray = z.array(z.string().min(1)).max(200);

const inputSchema = z.object({
  type: z.string().min(1),
  userIds: stringArray.optional(),
  roles: stringArray.optional(),
  departmentIds: stringArray.optional(),
  permissions: stringArray.optional(),
  reason: z.string().trim().min(1, "السبب مطلوب"),
});

/**
 * Reads the override for `type`, or `null` when none exists.
 *
 * Called on the processor's hot path once per event, so it is a single
 * indexed read on `type`'s unique index — not a join, and not a scan of the
 * override table (contract §1).
 */
export async function recipientOverride(
  type: string,
): Promise<RecipientSpec | null> {
  // The override is keyed by CANONICAL type, so a lookup by alias must be
  // canonicalised first or an override could be silently bypassed by an
  // emitter using the other spelling.
  const entry = lookup(type);
  const canonical = entry?.type ?? type;

  const row = await db.notificationTypeOverride.findUnique({ where: { type: canonical } });
  if (!row) return null;

  return {
    userIds: row.userIds,
    roles: row.roles,
    departmentIds: row.departmentIds,
    permissions: row.permissions,
  };
}

/** Every override row, for the Admin screen's editor. */
export async function listRecipientOverrides(): Promise<OverrideView[]> {
  const rows = await db.notificationTypeOverride.findMany({ orderBy: { type: "asc" } });
  return rows.map((row) => ({
    type: row.type,
    userIds: row.userIds,
    roles: row.roles,
    departmentIds: row.departmentIds,
    permissions: row.permissions,
    updatedAt: row.updatedAt.toISOString(),
    updatedById: row.updatedById,
  }));
}

async function assertKnownDepartments(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await db.department.findMany({
    where: { id: { in: [...ids] }, isActive: true },
    select: { id: true },
  });
  const known = new Set(found.map((d) => d.id));
  const unknown = ids.find((id) => !known.has(id));
  if (unknown !== undefined) {
    throw new DomainNotificationError("UNKNOWN_DEPARTMENT", `unknown department: ${unknown}`);
  }
}

function assertKnownRoles(roles: readonly string[]): void {
  const known = new Set<string>(ALL_ROLE_KEYS);
  const unknown = roles.find((role) => !known.has(role));
  if (unknown !== undefined) {
    throw new DomainNotificationError("UNKNOWN_ROLE", `unknown role: ${unknown}`);
  }
}

function assertKnownPermissions(permissions: readonly string[]): void {
  const known = new Set<string>(ALL_PERMISSIONS);
  const unknown = permissions.find((p) => !known.has(p));
  if (unknown !== undefined) {
    throw new DomainNotificationError("UNKNOWN_PERMISSION", `unknown permission: ${unknown}`);
  }
}

function toView(row: {
  type: string;
  userIds: string[];
  roles: string[];
  departmentIds: string[];
  permissions: string[];
  updatedAt: Date;
  updatedById: string | null;
}): OverrideView {
  return {
    type: row.type,
    userIds: row.userIds,
    roles: row.roles,
    departmentIds: row.departmentIds,
    permissions: row.permissions,
    updatedAt: row.updatedAt.toISOString(),
    updatedById: row.updatedById,
  };
}

/**
 * Creates or replaces the override for a catalog type.
 *
 * Requires `admin.config`. Writes the row and
 * `notification.recipient_override_updated` — with the REQUIRED reason — in
 * ONE transaction, so an audit row can never exist without its change and a
 * change can never exist without its audit row (FR-061).
 */
export async function setRecipientOverride(
  actor: Actor,
  input: SetRecipientOverrideInput,
): Promise<OverrideView> {
  authorize(actor, "admin.config");

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    // The reason's emptiness gets its own code so the UI can render
    // "السبب مطلوب" next to the reason field rather than a generic message.
    const reasonIssue = parsed.error.issues.find((i) => i.path[0] === "reason");
    throw new DomainNotificationError(
      reasonIssue ? "EMPTY_REASON" : "VALIDATION",
      reasonIssue?.message ?? "invalid recipient override",
    );
  }

  // An override for a type with no catalog entry is a VALIDATION error, not a
  // dormant row: a row nothing will ever read is a configuration lie.
  const entry = lookup(parsed.data.type);
  if (!entry) {
    throw new DomainNotificationError(
      "UNKNOWN_EVENT_TYPE",
      `no catalog entry for type: ${parsed.data.type}`,
    );
  }

  assertKnownRoles(parsed.data.roles ?? []);
  assertKnownPermissions(parsed.data.permissions ?? []);
  await assertKnownDepartments(parsed.data.departmentIds ?? []);

  const canonical = entry.type;
  const before = await db.notificationTypeOverride.findUnique({ where: { type: canonical } });

  const row = await db.$transaction(async (tx) => {
    const saved = await tx.notificationTypeOverride.upsert({
      where: { type: canonical },
      create: {
        type: canonical,
        userIds: [...(parsed.data.userIds ?? [])],
        roles: [...(parsed.data.roles ?? [])],
        departmentIds: [...(parsed.data.departmentIds ?? [])],
        permissions: [...(parsed.data.permissions ?? [])],
        updatedById: actor.userId,
      },
      update: {
        userIds: [...(parsed.data.userIds ?? [])],
        roles: [...(parsed.data.roles ?? [])],
        departmentIds: [...(parsed.data.departmentIds ?? [])],
        permissions: [...(parsed.data.permissions ?? [])],
        updatedById: actor.userId,
      },
    });

    await audit.record(tx, {
      action: "notification.recipient_override_updated",
      entityType: "NotificationType",
      entityId: canonical,
      actorId: actor.userId,
      before: before
        ? {
            userIds: before.userIds,
            roles: before.roles,
            departmentIds: before.departmentIds,
            permissions: before.permissions,
          }
        : null,
      after: {
        userIds: saved.userIds,
        roles: saved.roles,
        departmentIds: saved.departmentIds,
        permissions: saved.permissions,
      },
      reason: parsed.data.reason,
    });

    return saved;
  });

  return toView(row);
}

/**
 * Removes the override, restoring the catalog default.
 *
 * The only DELETE in 053, and it deletes configuration, never history. A
 * DELETE with no matching row is a no-op success rather than an error, so a
 * double-click on "إلغاء التجاوز" cannot surface a failure to an Admin who
 * simply wants the default back.
 */
export async function clearRecipientOverride(
  actor: Actor,
  type: string,
  reason: string,
): Promise<void> {
  authorize(actor, "admin.config");

  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new DomainNotificationError("EMPTY_REASON", "السبب مطلوب");
  }

  const entry = lookup(type);
  if (!entry) {
    throw new DomainNotificationError("UNKNOWN_EVENT_TYPE", `no catalog entry for type: ${type}`);
  }
  const canonical = entry.type;

  const before = await db.notificationTypeOverride.findUnique({ where: { type: canonical } });

  await db.$transaction(async (tx) => {
    await tx.notificationTypeOverride.deleteMany({ where: { type: canonical } });

    await audit.record(tx, {
      action: "notification.recipient_override_updated",
      entityType: "NotificationType",
      entityId: canonical,
      actorId: actor.userId,
      before: before
        ? {
            userIds: before.userIds,
            roles: before.roles,
            departmentIds: before.departmentIds,
            permissions: before.permissions,
          }
        : null,
      // "After" is the catalog default, expressed as an absence: under union
      // semantics, no row IS the default.
      after: null,
      reason: trimmed,
    });
  });
}
