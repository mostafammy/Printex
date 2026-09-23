// Integration tests for admin department-management actions — T019.
//
// Covers addDepartment, renameDepartment, and deactivateDepartment against a
// REAL Postgres test database (DATABASE_URL_TEST — research.md §9).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/testDb";
import { addDepartment, deactivateDepartment, renameDepartment } from "~/server/admin/departments";
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

// Minimal admin actor that satisfies authorize(actor, "admin.config"). Its
// userId must reference a real User row, since audit.record() writes
// actorId as a foreign key to User.
const testAdminActor: Actor = {
  userId: unique("test-admin-depts"),
  roles: [],
  permissions: new Set<Permission>(["admin.config"]),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin department management (integration)", () => {
  it("addDepartment creates a new Department row with the given name and isActive=true", async () => {
    const name = unique("dept");
    const { departmentId } = await addDepartment(testAdminActor, name);

    const row = await testDb.department.findUnique({ where: { id: departmentId } });

    expect(row).not.toBeNull();
    expect(row?.name).toBe(name);
    expect(row?.isActive).toBe(true);
  });

  it("renameDepartment updates the name and leaves isActive unchanged", async () => {
    const { departmentId } = await addDepartment(testAdminActor, unique("dept"));

    const newName = unique("renamed");
    await renameDepartment(testAdminActor, departmentId, newName);

    const row = await testDb.department.findUnique({ where: { id: departmentId } });

    expect(row?.name).toBe(newName);
    expect(row?.isActive).toBe(true);
  });

  it("deactivateDepartment sets isActive=false", async () => {
    const { departmentId } = await addDepartment(testAdminActor, unique("dept"));

    await deactivateDepartment(testAdminActor, departmentId);

    const row = await testDb.department.findUnique({ where: { id: departmentId } });

    expect(row?.isActive).toBe(false);
  });

  it("deactivateDepartment is a silent no-op when called again on an already-inactive department", async () => {
    const { departmentId } = await addDepartment(testAdminActor, unique("dept"));
    await deactivateDepartment(testAdminActor, departmentId);

    // Second call must resolve without throwing.
    await expect(
      deactivateDepartment(testAdminActor, departmentId),
    ).resolves.toBeUndefined();
  });

  it("deactivateDepartment is a silent no-op for a nonexistent department id", async () => {
    await expect(
      deactivateDepartment(testAdminActor, "nonexistent-dept-id-xyz"),
    ).resolves.toBeUndefined();
  });
});
