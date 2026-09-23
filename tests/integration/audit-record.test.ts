// Integration tests for audit.record() — T028.
//
// Verifies insertion, atomicity (rollback), and null-actorId behaviour
// against a REAL Postgres test database (DATABASE_URL_TEST — research.md §9).
// Each test seeds its own User row (actorId is a real FK to User) except the
// null-actorId case, which omits actorId entirely to mirror a pre-auth event.

import { afterAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/testDb";
import { audit } from "~/server/auth/audit";

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

async function seedUser(): Promise<string> {
  const userId = unique("u");
  await testDb.user.create({
    data: {
      id: userId,
      name: "Audit Test User",
      email: `${userId}@local.invalid`,
      username: userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  return userId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("audit.record (integration)", () => {
  it("inserts exactly one AuditEvent row with all expected fields", async () => {
    const actorId = await seedUser();
    const entityId = unique("ent");

    const beforeSnapshot = { status: "draft" };
    const afterSnapshot = { status: "active" };

    await testDb.$transaction(async (tx) => {
      await audit.record(tx, {
        action: "user.updated",
        entityType: "User",
        entityId,
        actorId,
        before: beforeSnapshot,
        after: afterSnapshot,
      });
    });

    const rows = await testDb.auditEvent.findMany({ where: { entityId } });

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.action).toBe("user.updated");
    expect(row.entityType).toBe("User");
    expect(row.entityId).toBe(entityId);
    expect(row.actorId).toBe(actorId);
    // before/after round-trip as the same JSON values passed in
    expect(row.before).toEqual(beforeSnapshot);
    expect(row.after).toEqual(afterSnapshot);
  });

  it("rolls back the AuditEvent insert when the surrounding transaction throws", async () => {
    const actorId = await seedUser();
    const entityId = unique("rollback-ent");

    await expect(
      testDb.$transaction(async (tx) => {
        await audit.record(tx, {
          action: "order.created",
          entityType: "Order",
          entityId,
          actorId,
        });
        throw new Error("rollback-marker");
      }),
    ).rejects.toThrow("rollback-marker");

    // The audit row must have been rolled back with the rest of the transaction.
    const rows = await testDb.auditEvent.findMany({ where: { entityId } });
    expect(rows).toHaveLength(0);
  });

  it("inserts a row with actorId = null when actorId is omitted (pre-auth event)", async () => {
    // Intentionally no User seeded — actorId is omitted from the event object
    // entirely, exercising the nullable FK path (e.g. login.failure on an
    // unknown username where no User row exists).
    const entityId = unique("preauth-ent");

    await testDb.$transaction(async (tx) => {
      await audit.record(tx, {
        action: "login.failure",
        entityType: "User",
        entityId,
        // actorId deliberately omitted
      });
    });

    const rows = await testDb.auditEvent.findMany({ where: { entityId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actorId).toBeNull();
  });
});
