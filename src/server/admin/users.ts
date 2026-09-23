import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor, Permission } from "~/server/auth";

export async function createUser(
  actor: Actor,
  input: {
    username: string;
    initialPassword: string;
    roleIds: string[];
    departmentIds: string[];
  },
): Promise<{ userId: string }> {
  authorize(actor, "admin.users");

  const userId = randomUUID();
  const accountId = randomUUID();
  const hashedPassword = await hashPassword(input.initialPassword);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.user.create({
      data: {
        id: userId,
        name: input.username,
        email: `${input.username}@local.invalid`,
        emailVerified: false,
        username: input.username,
        displayUsername: input.username,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });

    await tx.account.create({
      data: {
        id: accountId,
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashedPassword,
      },
    });

    for (const roleId of input.roleIds) {
      await tx.userRole.create({ data: { userId, roleId } });
    }

    for (const departmentId of input.departmentIds) {
      await tx.userDepartment.create({ data: { userId, departmentId } });
    }

    // audit.record must use tx, not db, so the audit row commits atomically
    // with the user creation (constitution III).
    await audit.record(tx, {
      action: "user.created",
      entityType: "User",
      entityId: userId,
      actorId: actor.userId,
      after: {
        username: input.username,
        roleIds: input.roleIds,
        departmentIds: input.departmentIds,
      },
    });
  });

  return { userId };
}

export async function deactivateUser(
  actor: Actor,
  targetUserId: string,
): Promise<void> {
  authorize(actor, "admin.users");

  const user = await db.user.findUnique({ where: { id: targetUserId } });
  // Spec edge case: silently no-op if the user doesn't exist or is already inactive.
  if (!user?.isActive) return;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
    });

    // Revoke all active sessions in the same transaction so the session
    // invalidation and the isActive=false write are atomic.
    await tx.session.deleteMany({ where: { userId: targetUserId } });

    await audit.record(tx, {
      action: "user.deactivated",
      entityType: "User",
      entityId: targetUserId,
      actorId: actor.userId,
      before: { isActive: true },
      after: { isActive: false },
    });
  });
}

export async function reactivateUser(
  actor: Actor,
  targetUserId: string,
): Promise<void> {
  authorize(actor, "admin.users");

  const user = await db.user.findUnique({ where: { id: targetUserId } });
  // Spec edge case: silently no-op if the user doesn't exist or is already active.
  if (!user || user.isActive) return;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: { isActive: true },
    });

    await audit.record(tx, {
      action: "user.reactivated",
      entityType: "User",
      entityId: targetUserId,
      actorId: actor.userId,
      before: { isActive: false },
      after: { isActive: true },
    });
  });
}

export async function resetPassword(
  actor: Actor,
  targetUserId: string,
  newPassword: string,
): Promise<void> {
  authorize(actor, "admin.users");

  const hashedPassword = await hashPassword(newPassword);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.account.updateMany({
      where: { userId: targetUserId, providerId: "credential" },
      data: { password: hashedPassword },
    });

    // Never pass the password or hash into the audit record (spec edge case).
    await audit.record(tx, {
      action: "password.reset",
      entityType: "User",
      entityId: targetUserId,
      actorId: actor.userId,
    });
  });
}

export async function forceLogout(
  actor: Actor,
  targetUserId: string,
): Promise<void> {
  authorize(actor, "admin.users");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.session.deleteMany({ where: { userId: targetUserId } });

    await audit.record(tx, {
      action: "logout",
      entityType: "User",
      entityId: targetUserId,
      actorId: actor.userId,
    });
  });
}

export async function updateUserRoleAssignments(
  actor: Actor,
  targetUserId: string,
  roleIds: string[],
): Promise<void> {
  authorize(actor, "admin.users");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.userRole.findMany({
      where: { userId: targetUserId },
    });
    const beforeRoleIds = current.map((ur) => ur.roleId);

    const beforeSet = new Set(beforeRoleIds);
    const afterSet = new Set(roleIds);

    const toDelete = beforeRoleIds.filter((id) => !afterSet.has(id));
    const toAdd = roleIds.filter((id) => !beforeSet.has(id));

    if (toDelete.length > 0) {
      await tx.userRole.deleteMany({
        where: { userId: targetUserId, roleId: { in: toDelete } },
      });
    }

    for (const roleId of toAdd) {
      await tx.userRole.create({ data: { userId: targetUserId, roleId } });
    }

    await audit.record(tx, {
      action: "role.changed",
      entityType: "User",
      entityId: targetUserId,
      actorId: actor.userId,
      before: { roleIds: beforeRoleIds },
      after: { roleIds },
    });
  });
}

export async function updateUserDepartments(
  actor: Actor,
  targetUserId: string,
  departmentIds: string[],
): Promise<void> {
  authorize(actor, "admin.users");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.userDepartment.findMany({
      where: { userId: targetUserId },
    });
    const beforeDepartmentIds = current.map((ud) => ud.departmentId);

    const beforeSet = new Set(beforeDepartmentIds);
    const afterSet = new Set(departmentIds);

    const toDelete = beforeDepartmentIds.filter((id) => !afterSet.has(id));
    const toAdd = departmentIds.filter((id) => !beforeSet.has(id));

    if (toDelete.length > 0) {
      await tx.userDepartment.deleteMany({
        where: { userId: targetUserId, departmentId: { in: toDelete } },
      });
    }

    for (const departmentId of toAdd) {
      await tx.userDepartment.create({
        data: { userId: targetUserId, departmentId },
      });
    }

    // Department reassignment is documented under role.changed per the fixed
    // action-string list — no separate action key exists for it.
    await audit.record(tx, {
      action: "role.changed",
      entityType: "User",
      entityId: targetUserId,
      actorId: actor.userId,
      before: { departmentIds: beforeDepartmentIds },
      after: { departmentIds },
    });
  });
}

export async function grantUserPermission(
  actor: Actor,
  targetUserId: string,
  permission: Permission,
  reason?: string,
): Promise<void> {
  authorize(actor, "admin.users");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Upsert with a no-op update so granting an already-held permission is
    // idempotent at the DB level (unique constraint on [userId, permission]).
    await tx.userPermission.upsert({
      where: { userId_permission: { userId: targetUserId, permission } },
      update: {},
      create: {
        userId: targetUserId,
        permission,
        grantedById: actor.userId,
      },
    });

    await audit.record(tx, {
      action: "role.changed",
      entityType: "User",
      entityId: targetUserId,
      actorId: actor.userId,
      after: { grantedPermission: permission },
      reason,
    });
  });
}

export async function revokeUserPermission(
  actor: Actor,
  targetUserId: string,
  permission: Permission,
): Promise<void> {
  authorize(actor, "admin.users");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // deleteMany on the unique pair is a no-op when the row doesn't exist,
    // avoiding a findUnique + conditional delete round-trip.
    await tx.userPermission.deleteMany({
      where: { userId: targetUserId, permission },
    });

    await audit.record(tx, {
      action: "role.changed",
      entityType: "User",
      entityId: targetUserId,
      actorId: actor.userId,
      before: { revokedPermission: permission },
    });
  });
}
