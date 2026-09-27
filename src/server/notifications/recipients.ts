// resolveRecipients — contracts/notification-service.md §resolveRecipients.
//
// Four addressing modes (explicit ids, roles, departments, permissions) unioned
// and deduplicated by user, restricted to **active** users only. This is the
// ONLY place 053 reads `UserRole` / `UserDepartment` / `RolePermission` /
// `UserPermission` (FR-002, FR-003).
//
// Two properties are load-bearing and easy to get wrong:
//
//  1. A user matching by TWO modes receives ONE notification. The
//     `@@unique([sourceEventId, userId])` constraint enforces the pair; this
//     function's dedup is what stops the wasted work and the confusing
//     double-signal before the constraint ever sees it.
//
//  2. An unknown role/permission string contributes NOTHING and never throws.
//     A typo in a catalog entry must not break an unrelated feature's
//     delivery. A *configured* threshold with an unknown value is rejected
//     earlier, at write time, by `delayThresholds.update` — the two paths
//     have deliberately different failure modes (contract §3).

import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";

/**
 * The recipient specification every addressing path shares: 002's
 * `NotifyEvent.recipients` plus 053's fourth, `permissions` mode (FR-016).
 */
export interface RecipientSpec {
  readonly userIds?: readonly string[];
  readonly roles?: readonly string[];
  readonly departmentIds?: readonly string[];
  readonly permissions?: readonly string[];
}

/** The slice of a Prisma client the resolver needs. */
export type RecipientClient = Pick<Prisma.TransactionClient, "user">;

const emptyClient = db as unknown as RecipientClient;

/**
 * Resolves `spec` to the set of ACTIVE user ids it addresses.
 *
 * Accepts an explicit `client` so the processor can resolve inside the same
 * transaction as the notification insert; defaults to the app client.
 */
export async function resolveRecipients(
  spec: RecipientSpec,
  client: RecipientClient = emptyClient,
): Promise<ReadonlySet<string>> {
  const resolved = new Set<string>();

  // Mode 1: explicit ids. Still filtered to active users — addressing a
  // deactivated employee must not create a notification nobody can read,
  // and a notification row for a deactivated user is unreachable through
  // the very API that renders it.
  if (spec.userIds?.length) {
    const users = await client.user.findMany({
      where: { id: { in: [...spec.userIds] }, isActive: true },
      select: { id: true },
    });
    for (const user of users) resolved.add(user.id);
  }

  // Mode 2: roles, via UserRole.
  if (spec.roles?.length) {
    const users = await client.user.findMany({
      where: { isActive: true, roles: { some: { role: { key: { in: [...spec.roles] } } } } },
      select: { id: true },
    });
    for (const user of users) resolved.add(user.id);
  }

  // Mode 3: departments, via UserDepartment.
  if (spec.departmentIds?.length) {
    const users = await client.user.findMany({
      where: { isActive: true, departments: { some: { departmentId: { in: [...spec.departmentIds] } } } },
      select: { id: true },
    });
    for (const user of users) resolved.add(user.id);
  }

  // Mode 4: permissions, via RolePermission ∪ UserPermission (FR-016).
  // A permission can arrive through a role or as a per-user extra grant, so
  // both are unioned — that is what makes 016's `usersWithPermission` and
  // 091's `admin.config` addressing expressible.
  if (spec.permissions?.length) {
    const keys = [...spec.permissions];
    const users = await client.user.findMany({
      where: {
        isActive: true,
        OR: [
          { roles: { some: { role: { permissions: { some: { permission: { in: keys } } } } } } },
          { extraPermissions: { some: { permission: { in: keys } } } },
        ],
      },
      select: { id: true },
    });
    for (const user of users) resolved.add(user.id);
  }

  return resolved;
}

/**
 * Unions `extra` into `base`, treating an absent or empty array as "adds
 * nothing".
 *
 * This is the override semantics FR-017 depends on, and the whole reason it
 * lives in one named function: a non-empty array ADDS recipients and can
 * never remove the catalog's own. A shop that installs a bad override gets
 * *more* people hearing about something — recoverable — rather than a role
 * the business depends on silently going silent, which nothing would report
 * as an error (data-model.md §NotificationTypeOverride, research.md
 * §Decision: the per-event override unions).
 */
export function unionSpecs(base: RecipientSpec, extra: RecipientSpec | null): RecipientSpec {
  if (!extra) return base;
  const union = (a: readonly string[] | undefined, b: readonly string[] | undefined) => [
    ...new Set([...(a ?? []), ...(b ?? [])]),
  ];
  return {
    userIds: union(base.userIds, extra.userIds),
    roles: union(base.roles, extra.roles),
    departmentIds: union(base.departmentIds, extra.departmentIds),
    permissions: union(base.permissions, extra.permissions),
  };
}
