// Contract test for the seeded role × permission matrix — T030 / SC-001.
//
// Queries the already-seeded Role/RolePermission rows from the real test
// database (DATABASE_URL_TEST — same Supabase instance as the dev DB, per
// .env comment; seed.ts has already been run against it) and asserts they
// match the authoritative matrix from
// specs/001-identity-access-audit/data-model.md §"Seeded role × permission matrix".
//
// This test MUST NOT create, upsert, or modify any Role or RolePermission rows.

import { afterAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/testDb";
import { ALL_PERMISSIONS } from "~/server/auth/permissions";

afterAll(async () => {
  await testDb.$disconnect();
});

// ---------------------------------------------------------------------------
// Authoritative matrix — transcribed directly from data-model.md lines 137-160.
// Sorted arrays match the sort applied to the DB query result below.
// ---------------------------------------------------------------------------

// Expected permissions per role key (sorted, for deterministic comparison).
const EXPECTED_MATRIX: Record<string, string[]> = {
  RECEPTION: [
    "customer.manage",
    "finance.view",
    "order.cancel",
    "order.create",
    "order.edit",
    "pricing.use_fixed",
    "workitem.assign_designer",
  ],
  DESIGNER: ["design.work"],
  HEAD_DESIGNER: ["change.approve", "design.review"],
  PRODUCTION_OPERATOR: ["files.download_production", "production.operate"],
  PRINT_RECEPTION_DELIVERY: ["collection.receive", "delivery.record"],
  ACCOUNTING: ["expense.record", "finance.view", "payment.record", "payment.void"],
  // ADMIN_OWNER is asserted separately against ALL_PERMISSIONS below.
  ADMIN_OWNER: [...ALL_PERMISSIONS].sort(),
};

describe("role × permission matrix (contract)", () => {
  it("every expected role key exists in the seeded database", async () => {
    const roles = await testDb.role.findMany({ include: { permissions: true } });
    const foundKeys = new Set(roles.map((r) => r.key));

    for (const expectedKey of Object.keys(EXPECTED_MATRIX)) {
      expect(
        foundKeys.has(expectedKey),
        `Role key "${expectedKey}" is missing from the database — was seed.ts run?`,
      ).toBe(true);
    }
  });

  it("each seeded role's permission set matches the authoritative matrix exactly", async () => {
    const roles = await testDb.role.findMany({ include: { permissions: true } });

    // Build a map: role key → sorted permission strings.
    const actual: Record<string, string[]> = {};
    for (const role of roles) {
      // Only assert against roles that appear in our expected matrix;
      // any extra test-seeded roles (e.g. from integration tests) are ignored.
      if (role.key in EXPECTED_MATRIX) {
        actual[role.key] = role.permissions.map((p) => p.permission).sort();
      }
    }

    for (const [key, expectedPerms] of Object.entries(EXPECTED_MATRIX)) {
      expect(
        actual[key],
        `Role "${key}" was not found in the query result — ensure it appears in EXPECTED_MATRIX keys`,
      ).toBeDefined();
      expect(actual[key]).toEqual(expectedPerms);
    }
  });

  it("ADMIN_OWNER has exactly 23 permissions matching ALL_PERMISSIONS", async () => {
    const adminOwnerRole = await testDb.role.findUnique({
      where: { key: "ADMIN_OWNER" },
      include: { permissions: true },
    });

    expect(
      adminOwnerRole,
      "Role ADMIN_OWNER is missing from the database — was seed.ts run?",
    ).not.toBeNull();

    const actualPerms = adminOwnerRole!.permissions.map((p) => p.permission).sort();
    const allPermsSorted = [...ALL_PERMISSIONS].sort();

    expect(actualPerms).toHaveLength(23);
    expect(actualPerms).toEqual(allPermsSorted);
  });

  it("HEAD_DESIGNER and ADMIN_OWNER have change.approve; other seeded roles do not (016 FR-013)", async () => {
    const roles = await testDb.role.findMany({ include: { permissions: true } });
    const permsByRole = new Map<string, string[]>();
    for (const role of roles) {
      permsByRole.set(
        role.key,
        role.permissions.map((p) => p.permission),
      );
    }

    expect(permsByRole.get("HEAD_DESIGNER")).toContain("change.approve");
    expect(permsByRole.get("ADMIN_OWNER")).toContain("change.approve");

    const rolesWithoutChangeApprove = [
      "RECEPTION",
      "DESIGNER",
      "PRODUCTION_OPERATOR",
      "PRINT_RECEPTION_DELIVERY",
      "ACCOUNTING",
    ] as const;

    for (const roleKey of rolesWithoutChangeApprove) {
      expect(permsByRole.get(roleKey)).toBeDefined();
      expect(permsByRole.get(roleKey)).not.toContain("change.approve");
    }
  });
});
