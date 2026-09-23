// Integration tests for admin user-management actions — T018.
//
// Covers createUser, updateUserRoleAssignments, updateUserDepartments,
// grantUserPermission, revokeUserPermission, and deactivateUser edge cases,
// all verified against a REAL Postgres test database (DATABASE_URL_TEST —
// research.md §9).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { testDb } from "../helpers/testDb";
import { getActorForSession, UnauthenticatedError } from "~/server/auth/getActor";
import {
  createUser,
  deactivateUser,
  grantUserPermission,
  revokeUserPermission,
  updateUserDepartments,
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
  userId: unique("test-admin-adminusers"),
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

/** Seeds a complete user (User + Account + Role + UserRole) without a session. */
async function seedUserWithRole(permissionKeys: string[]): Promise<{
  userId: string;
  roleId: string;
}> {
  const userId = unique("u");
  const roleId = unique("r");

  await testDb.user.create({
    data: {
      id: userId,
      name: "Admin Test User",
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

  return { userId, roleId };
}

/** Seeds a Session row for an existing userId with a future expiresAt. */
async function seedSession(userId: string): Promise<{ expiresAt: Date }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // +12 h
  await testDb.session.create({
    data: {
      id: unique("s"),
      token: unique("tok"),
      userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    },
  });
  return { expiresAt };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin user management (integration)", () => {
  it("createUser produces a loginnable account whose actor reflects the assigned role and department", async () => {
    // Seed a Role and a Department to assign during creation.
    const roleId = unique("r");
    await testDb.role.create({
      data: {
        id: roleId,
        key: `ROLE_${roleId}`,
        name: `Test Role ${roleId}`,
        permissions: { create: [{ permission: "order.create" }] },
      },
    });
    const dept = await testDb.department.create({ data: { name: unique("dept") } });

    const username = unique("newuser");
    const { userId } = await createUser(testAdminActor, {
      username,
      initialPassword: "TestPass123!",
      roleIds: [roleId],
      departmentIds: [dept.id],
    });

    // createUser does not create a session — seed one manually.
    const { expiresAt } = await seedSession(userId);

    const actor = await getActorForSession({ userId, expiresAt });

    expect(actor.userId).toBe(userId);
    expect(actor.permissions.has("order.create")).toBe(true);
    expect(actor.departmentIds).toContain(dept.id);
  });

  it("updateUserRoleAssignments and updateUserDepartments are reflected by a subsequent getActorForSession", async () => {
    const { userId } = await seedUserWithRole(["order.create"]);

    const dept1 = await testDb.department.create({ data: { name: unique("dept") } });
    await testDb.userDepartment.create({ data: { userId, departmentId: dept1.id } });

    const { expiresAt } = await seedSession(userId);

    // Confirm baseline
    const actorBefore = await getActorForSession({ userId, expiresAt });
    expect(actorBefore.permissions.has("order.create")).toBe(true);
    expect(actorBefore.departmentIds).toContain(dept1.id);

    // Create a new role and department to reassign to.
    const newRoleId = unique("r2");
    await testDb.role.create({
      data: {
        id: newRoleId,
        key: `ROLE_${newRoleId}`,
        name: `Test Role ${newRoleId}`,
        permissions: { create: [{ permission: "order.edit" }] },
      },
    });
    const dept2 = await testDb.department.create({ data: { name: unique("dept2") } });

    await updateUserRoleAssignments(testAdminActor, userId, [newRoleId]);
    await updateUserDepartments(testAdminActor, userId, [dept2.id]);

    const actorAfter = await getActorForSession({ userId, expiresAt });

    expect(actorAfter.permissions.has("order.create")).toBe(false);
    expect(actorAfter.permissions.has("order.edit")).toBe(true);
    expect(actorAfter.departmentIds).not.toContain(dept1.id);
    expect(actorAfter.departmentIds).toContain(dept2.id);
  });

  it("grantUserPermission adds the permission; revokeUserPermission removes it", async () => {
    const { userId } = await seedUserWithRole(["order.create"]);
    const { expiresAt } = await seedSession(userId);

    const actorBefore = await getActorForSession({ userId, expiresAt });
    expect(actorBefore.permissions.has("pricing.set_variable")).toBe(false);

    await grantUserPermission(
      testAdminActor,
      userId,
      "pricing.set_variable" as Permission,
    );

    const actorAfterGrant = await getActorForSession({ userId, expiresAt });
    expect(actorAfterGrant.permissions.has("pricing.set_variable")).toBe(true);

    await revokeUserPermission(
      testAdminActor,
      userId,
      "pricing.set_variable" as Permission,
    );

    const actorAfterRevoke = await getActorForSession({ userId, expiresAt });
    expect(actorAfterRevoke.permissions.has("pricing.set_variable")).toBe(false);
  });

  it("deactivateUser is a silent no-op for a nonexistent user", async () => {
    await expect(
      deactivateUser(testAdminActor, "nonexistent-id-xyz"),
    ).resolves.toBeUndefined();
  });

  it("deactivateUser is a silent no-op when called twice on the same user", async () => {
    const { userId } = await seedUserWithRole(["order.create"]);

    await deactivateUser(testAdminActor, userId);

    // Second call on an already-inactive user must also resolve without throwing.
    await expect(
      deactivateUser(testAdminActor, userId),
    ).resolves.toBeUndefined();
  });
});
