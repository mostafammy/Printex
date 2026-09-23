// Integration test for `getActorForSession()` — T010.
//
// Exercises the core of the actor-resolution pipeline against a REAL Postgres
// test database (DATABASE_URL_TEST — research.md §9, testDb.ts).  Tests call
// `getActorForSession` directly (the cookie-independent lower-level export
// from getActor.ts) rather than `getActor()`, avoiding any dependency on
// Next.js headers()/cookies() in a non-HTTP test context.
//
// Seeding mirrors the pattern from prisma/seed.ts's `seedAdminUser()`:
//   - hashPassword from "better-auth/crypto" for Account rows
//   - User with `username`, `isActive`, etc.
//   - Role → RolePermission rows
//   - UserRole linking
//   - Better Auth Session row (id, token, userId, expiresAt, createdAt, updatedAt)

import { afterAll, describe, expect, it } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { testDb } from "../helpers/testDb";
import { getActorForSession, UnauthenticatedError } from "~/server/auth/getActor";

afterAll(async () => {
  await testDb.$disconnect();
});

// ---------------------------------------------------------------------------
// Seeding helpers (local to this test file — no shared factory needed)
// ---------------------------------------------------------------------------

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

async function seedFullActor(opts: {
  isActive?: boolean;
  permissionKeys?: string[];
  departmentId?: string;
}): Promise<{
  userId: string;
  sessionToken: string;
  expiresAt: Date;
}> {
  const userId = unique("u");
  const roleId = unique("r");
  const sessionId = unique("s");
  const sessionToken = unique("tok");
  const isActive = opts.isActive ?? true;
  const permissionKeys = opts.permissionKeys ?? ["order.create"];
  const departmentId = opts.departmentId;

  // 1. User
  await testDb.user.create({
    data: {
      id: userId,
      name: "Test Actor",
      email: `${userId}@local.invalid`,
      username: userId,
      isActive,
      failedLoginAttempts: 0,
    },
  });

  // 2. Account (credential provider, mirrors seed.ts seedAdminUser pattern)
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

  // 3. Role + RolePermission rows
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

  // 4. UserRole
  await testDb.userRole.create({
    data: { userId, roleId },
  });

  // 5. Optional UserDepartment
  if (departmentId) {
    await testDb.userDepartment.create({
      data: { userId, departmentId },
    });
  }

  // 6. Better Auth Session row
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // +12 h
  await testDb.session.create({
    data: {
      id: sessionId,
      token: sessionToken,
      userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { userId, sessionToken, expiresAt };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getActorForSession (integration)", () => {
  it("valid session + active user returns correct Actor with permissions", async () => {
    const { userId, expiresAt } = await seedFullActor({
      permissionKeys: ["order.create", "order.edit"],
    });

    const actor = await getActorForSession({ userId, expiresAt });

    expect(actor.userId).toBe(userId);
    expect(actor.permissions.has("order.create")).toBe(true);
    expect(actor.permissions.has("order.edit")).toBe(true);
    expect(actor.roles).toHaveLength(1);
  });

  it("valid session for user with departmentIds returns them on the actor", async () => {
    // Seed a Department first (core.prisma model)
    const dept = await testDb.department.create({ data: { name: unique("dept") } });
    const { userId, expiresAt } = await seedFullActor({
      departmentId: dept.id,
    });

    const actor = await getActorForSession({ userId, expiresAt });

    expect(actor.departmentIds).toContain(dept.id);
  });

  it("throws UnauthenticatedError when session is null", async () => {
    await expect(getActorForSession(null)).rejects.toThrowError(UnauthenticatedError);
  });

  it("thrown error for null session has name 'UnauthenticatedError' and message 'UNAUTHENTICATED'", async () => {
    try {
      await getActorForSession(null);
      expect.fail("expected UnauthenticatedError");
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthenticatedError);
      expect((err as UnauthenticatedError).name).toBe("UnauthenticatedError");
      expect((err as UnauthenticatedError).message).toBe("UNAUTHENTICATED");
    }
  });

  it("throws UnauthenticatedError when session.expiresAt is in the past", async () => {
    const { userId } = await seedFullActor({});
    const expiredAt = new Date(Date.now() - 1000); // 1 second ago

    await expect(
      getActorForSession({ userId, expiresAt: expiredAt }),
    ).rejects.toThrowError(UnauthenticatedError);
  });

  it("throws UnauthenticatedError when the user is deactivated (isActive=false)", async () => {
    const { userId, expiresAt } = await seedFullActor({ isActive: false });

    await expect(
      getActorForSession({ userId, expiresAt }),
    ).rejects.toThrowError(UnauthenticatedError);
  });

  it("throws UnauthenticatedError when userId does not exist in the database", async () => {
    const nonExistentUserId = unique("ghost");
    const expiresAt = new Date(Date.now() + 60_000);

    await expect(
      getActorForSession({ userId: nonExistentUserId, expiresAt }),
    ).rejects.toThrowError(UnauthenticatedError);
  });

  it("unions permissions from multiple roles", async () => {
    const userId = unique("multi");
    const roleId1 = unique("r1");
    const roleId2 = unique("r2");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const now = new Date();

    await testDb.user.create({
      data: {
        id: userId,
        name: "Multi-role User",
        email: `${userId}@local.invalid`,
        username: userId,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });

    await testDb.role.create({
      data: {
        id: roleId1,
        key: `ROLE_${roleId1}`,
        name: `Role ${roleId1}`,
        permissions: { create: [{ permission: "order.create" }] },
      },
    });
    await testDb.role.create({
      data: {
        id: roleId2,
        key: `ROLE_${roleId2}`,
        name: `Role ${roleId2}`,
        permissions: { create: [{ permission: "customer.manage" }] },
      },
    });
    await testDb.userRole.createMany({
      data: [
        { userId, roleId: roleId1 },
        { userId, roleId: roleId2 },
      ],
    });
    await testDb.session.create({
      data: {
        id: unique("sess"),
        token: unique("tok"),
        userId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      },
    });

    const actor = await getActorForSession({ userId, expiresAt });

    expect(actor.permissions.has("order.create")).toBe(true);
    expect(actor.permissions.has("customer.manage")).toBe(true);
    expect(actor.roles).toHaveLength(2);
  });

  it("includes extra (UserPermission) grants in the actor's permissions", async () => {
    const userId = unique("extra");
    const roleId = unique("r");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const now = new Date();

    await testDb.user.create({
      data: {
        id: userId,
        name: "Extra Perm User",
        email: `${userId}@local.invalid`,
        username: userId,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });
    await testDb.role.create({
      data: {
        id: roleId,
        key: `ROLE_${roleId}`,
        name: `Role ${roleId}`,
        permissions: { create: [{ permission: "order.create" }] },
      },
    });
    await testDb.userRole.create({ data: { userId, roleId } });

    // A second user to act as the grant-giver (grantedById)
    const granterId = unique("granter");
    await testDb.user.create({
      data: {
        id: granterId,
        name: "Granter",
        email: `${granterId}@local.invalid`,
        username: granterId,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });

    // Extra permission not in the role
    await testDb.userPermission.create({
      data: {
        userId,
        permission: "pricing.set_variable",
        grantedById: granterId,
      },
    });

    await testDb.session.create({
      data: {
        id: unique("sess"),
        token: unique("tok"),
        userId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      },
    });

    const actor = await getActorForSession({ userId, expiresAt });

    expect(actor.permissions.has("pricing.set_variable")).toBe(true);
    // Role permission also present
    expect(actor.permissions.has("order.create")).toBe(true);
  });
});
