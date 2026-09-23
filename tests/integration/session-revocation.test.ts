// Integration tests for session-revocation behaviour — T017.
//
// Exercises `deactivateUser`, `forceLogout`, and `updateUserRoleAssignments`
// against a REAL Postgres test database (DATABASE_URL_TEST — research.md §9).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { testDb } from "../helpers/testDb";
import { getActorForSession, UnauthenticatedError } from "~/server/auth/getActor";
import {
  deactivateUser,
  forceLogout,
  updateUserRoleAssignments,
} from "~/server/admin/users";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

// ---------------------------------------------------------------------------
// Seeding helpers (local to this test file)
// ---------------------------------------------------------------------------

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

// Minimal admin actor that satisfies authorize(actor, "admin.users"). Its
// userId must reference a real User row, since audit.record() writes
// actorId as a foreign key to User.
const testAdminActor: Actor = {
  userId: unique("test-admin-sessrev"),
  roles: [],
  permissions: new Set<Permission>(["admin.users"]),
  departmentIds: [],
};

beforeAll(async () => {
  await testDb.user.create({
    data: {
      id: testAdminActor.userId,
      name: "Test Admin",
      email: `${testAdminActor.userId}@local.invalid`,
      username: testAdminActor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
});

async function seedUserWithSession(opts?: { permissionKeys?: string[] }): Promise<{
  userId: string;
  sessionId: string;
  expiresAt: Date;
}> {
  const userId = unique("u");
  const roleId = unique("r");
  const sessionId = unique("s");
  const permissionKeys = opts?.permissionKeys ?? ["order.create"];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // +12 h

  await testDb.user.create({
    data: {
      id: userId,
      name: "Session Test User",
      email: `${userId}@local.invalid`,
      username: userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });

  const hashedPassword = await hashPassword("TestPass123!");
  await testDb.account.create({
    data: {
      id: unique("acct"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashedPassword,
    },
  });

  await testDb.role.create({
    data: {
      id: roleId,
      key: `ROLE_${roleId}`,
      name: `Test Role ${roleId}`,
      permissions: {
        create: permissionKeys.map((perm) => ({ permission: perm })),
      },
    },
  });

  await testDb.userRole.create({ data: { userId, roleId } });

  await testDb.session.create({
    data: {
      id: sessionId,
      token: unique("tok"),
      userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { userId, sessionId, expiresAt };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("session revocation (integration)", () => {
  it("deactivateUser deletes all sessions and sets isActive=false, causing getActorForSession to throw", async () => {
    const { userId, expiresAt } = await seedUserWithSession();

    const sessionsBefore = await testDb.session.findMany({ where: { userId } });
    expect(sessionsBefore).toHaveLength(1);

    await deactivateUser(testAdminActor, userId);

    const sessionsAfter = await testDb.session.findMany({ where: { userId } });
    expect(sessionsAfter).toHaveLength(0);

    await expect(
      getActorForSession({ userId, expiresAt }),
    ).rejects.toThrowError(UnauthenticatedError);
  });

  it("forceLogout deletes sessions without setting isActive=false", async () => {
    const { userId } = await seedUserWithSession();

    const sessionsBefore = await testDb.session.findMany({ where: { userId } });
    expect(sessionsBefore).toHaveLength(1);

    await forceLogout(testAdminActor, userId);

    const sessionsAfter = await testDb.session.findMany({ where: { userId } });
    expect(sessionsAfter).toHaveLength(0);

    const user = await testDb.user.findUnique({ where: { id: userId } });
    expect(user?.isActive).toBe(true);
  });

  it("updateUserRoleAssignments does NOT delete the existing session", async () => {
    const { userId, sessionId } = await seedUserWithSession();

    // Seed a second role to reassign the user to
    const newRoleId = unique("r2");
    await testDb.role.create({
      data: {
        id: newRoleId,
        key: `ROLE_${newRoleId}`,
        name: `Test Role ${newRoleId}`,
        permissions: { create: [{ permission: "order.edit" }] },
      },
    });

    await updateUserRoleAssignments(testAdminActor, userId, [newRoleId]);

    const sessionsAfter = await testDb.session.findMany({ where: { userId } });
    expect(sessionsAfter.some((s) => s.id === sessionId)).toBe(true);
  });
});
