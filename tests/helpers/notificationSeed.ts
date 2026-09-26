// Shared fixtures for 053-notifications tests. Reuses the 051/052 seed
// helpers for the Customer -> Order -> WorkItem graph and adds the
// notification-specific rows: users with the roles and permissions 053's
// recipient resolution needs, a department, and helpers that record outbox
// events directly.
//
// Fixtures insert via `testDb` directly — no application code writes
// fixtures (pricingSeed.ts convention). The one exception is
// `recordOutboxEvent`, which is a thin wrapper over the same column set
// `notify()` writes, so a fixture event and a real one are indistinguishable
// to the processor.

import { testDb } from "./testDb";
import { unique, seedCustomer, seedOrderWithWorkItem } from "./pricingSeed";
import type { Actor, Permission, RoleKey } from "~/server/auth";

export { unique, seedCustomer, seedOrderWithWorkItem };

let counter = 0;
function uniq(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${process.hrtime.bigint().toString()}_${counter}`;
}

export interface SeedUserOptions {
  readonly prefix: string;
  readonly roleKeys?: readonly RoleKey[];
  readonly permissions?: readonly Permission[];
  readonly departmentIds?: readonly string[];
}

/**
 * Creates a User with roles, per-user extra permissions, and department
 * memberships, then returns the matching `Actor`.
 *
 * Permissions come from BOTH `UserRole` -> `RolePermission` and
 * `UserPermission`, because 053's resolver must see the same effective set
 * `getActorForSession` builds for a real session — a fixture that only set
 * `UserPermission` would not exercise the role path.
 */
export async function seedNotificationUser(
  opts: SeedUserOptions,
): Promise<Actor & { userId: string }> {
  const userId = uniq(opts.prefix);

  await testDb.user.create({
    data: {
      id: userId,
      name: `Test ${opts.prefix}`,
      email: `${userId}@local.invalid`,
      username: userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });

  for (const roleKey of opts.roleKeys ?? []) {
    const role = await testDb.role.findUnique({ where: { key: roleKey } });
    if (!role) {
      throw new Error(
        `seedNotificationUser: role "${roleKey}" is not seeded. Run pnpm test:db first.`,
      );
    }
    await testDb.userRole.create({ data: { userId, roleId: role.id } });
  }

  for (const permission of opts.permissions ?? []) {
    await testDb.userPermission.create({
      data: { userId, permission, grantedById: userId },
    });
  }

  for (const departmentId of opts.departmentIds ?? []) {
    await testDb.userDepartment.create({ data: { userId, departmentId } });
  }

  // Mirrors getActorForSession: roles -> role permissions, plus extras.
  const roleRows = await testDb.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: true } } },
  });
  const permissions = new Set<Permission>();
  for (const roleRow of roleRows) {
    for (const rolePermission of roleRow.role.permissions) {
      permissions.add(rolePermission.permission as Permission);
    }
  }
  for (const permission of opts.permissions ?? []) permissions.add(permission);

  return {
    userId,
    roles: [...(opts.roleKeys ?? [])],
    permissions,
    departmentIds: [...(opts.departmentIds ?? [])],
  };
}

/** An active department, for department-addressed recipient tests. */
export async function seedDepartment(prefix: string): Promise<string> {
  const department = await testDb.department.create({
    data: { name: uniq(prefix), isActive: true },
  });
  return department.id;
}

/**
 * Records an outbox event exactly as `notify()` would, then returns its id.
 *
 * `deliveryStatus: "PENDING"` is what the processor's claim predicate reads.
 * A test that wants "an event recorded before 053 existed" uses
 * `deliveryStatus: null` — that is the state every pre-migration row is in,
 * and the A-001 regression test depends on being able to produce it.
 */
export async function recordOutboxEvent(params: {
  type: string;
  entityType?: string;
  entityId?: string;
  recipientUserIds?: readonly string[];
  recipientRoles?: readonly string[];
  recipientDepartmentIds?: readonly string[];
  recipientPermissions?: readonly string[];
  payload?: Record<string, unknown>;
  /** null reproduces a pre-migration row (A-001). */
  deliveryStatus?: "PENDING" | "PROCESSED" | "FAILED" | "UNMAPPED" | null;
  createdAt?: Date;
}): Promise<string> {
  const event = await testDb.notificationEvent.create({
    data: {
      type: params.type,
      entityType: params.entityType ?? "WorkItem",
      entityId: params.entityId ?? "fixture-entity",
      recipientUserIds: [...(params.recipientUserIds ?? [])],
      recipientRoles: [...(params.recipientRoles ?? [])],
      recipientDepartmentIds: [...(params.recipientDepartmentIds ?? [])],
      recipientPermissions: [...(params.recipientPermissions ?? [])],
      payload: (params.payload ?? {}) as never,
      deliveryStatus: params.deliveryStatus === undefined ? "PENDING" : params.deliveryStatus,
      createdAt: params.createdAt ?? new Date(),
    },
    select: { id: true },
  });
  return event.id;
}

/**
 * A Work Item parked in `state` with a `QUEUE` segment that opened
 * `ageMinutes` ago — the exact shape the delay derivation reads, so a test
 * can make a Work Item "late" without waiting or editing a clock.
 */
export async function seedAgedWorkItem(params: {
  orderId: string;
  state: Parameters<typeof testDb.workItem.create>[0]["data"]["state"];
  ageMinutes: number;
  requiresDesign?: boolean;
  departmentId?: string | null;
  assigneeId?: string | null;
  queueKind?: "QUEUE" | "ACTIVE";
}): Promise<string> {
  const workItem = await testDb.workItem.create({
    data: {
      orderId: params.orderId,
      state: params.state,
      requiresDesign: params.requiresDesign ?? true,
      departmentId: params.departmentId ?? null,
      assigneeId: params.assigneeId ?? null,
    },
    select: { id: true },
  });

  await testDb.phaseTiming.create({
    data: {
      workItemId: workItem.id,
      phase: params.state,
      kind: params.queueKind ?? "QUEUE",
      startedAt: new Date(Date.now() - params.ageMinutes * 60_000),
    },
  });

  return workItem.id;
}

/** A Work Item whose pricing has been unresolved since `ageMinutes` ago. */
export async function seedUnpricedWorkItem(params: {
  orderId: string;
  state: Parameters<typeof testDb.workItem.create>[0]["data"]["state"];
  ageMinutes: number;
  status?: "PENDING" | "DISPUTED";
}): Promise<string> {
  const workItem = await testDb.workItem.create({
    data: {
      orderId: params.orderId,
      state: params.state,
      requiresDesign: false,
    },
    select: { id: true },
  });

  await testDb.pricingStatus.create({
    data: {
      workItemId: workItem.id,
      status: params.status ?? "PENDING",
      waitingSince: new Date(Date.now() - params.ageMinutes * 60_000),
    },
  });

  return workItem.id;
}

/** Sets one phase's threshold, for tests that must not disturb the seed. */
export async function setThreshold(
  phase: "DESIGN" | "REVIEW" | "PRICING" | "PRODUCTION" | "COLLECTION",
  thresholdMinutes: number | null,
  extra?: { alertRoles?: readonly string[]; alertPermissions?: readonly string[]; alertDepartmentIds?: readonly string[] },
): Promise<void> {
  await testDb.delayThreshold.upsert({
    where: { phase },
    create: {
      phase,
      thresholdMinutes,
      alertRoles: [...(extra?.alertRoles ?? [])],
      alertPermissions: [...(extra?.alertPermissions ?? [])],
      alertDepartmentIds: [...(extra?.alertDepartmentIds ?? [])],
    },
    update: {
      thresholdMinutes,
      ...(extra?.alertRoles ? { alertRoles: [...extra.alertRoles] } : {}),
      ...(extra?.alertPermissions ? { alertPermissions: [...extra.alertPermissions] } : {}),
      ...(extra?.alertDepartmentIds ? { alertDepartmentIds: [...extra.alertDepartmentIds] } : {}),
    },
  });
}
