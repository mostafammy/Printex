// Contract test for database-level audit_event append-only enforcement — T029.
//
// Verifies that the REVOKE UPDATE, DELETE already applied via
// prisma/manual-sql/audit-event-append-only.sql is live against the real test
// database. Does not attempt to re-apply the REVOKE — that is a one-time
// manual deployment step already completed.

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
      name: "Append-Only Test User",
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

describe("audit_event append-only (database contract)", () => {
  it("UPDATE on audit_event is rejected by Postgres", async () => {
    const actorId = await seedUser();
    const entityId = unique("ao-ent");

    // Insert a real row via audit.record() inside a transaction.
    await testDb.$transaction(async (tx) => {
      await audit.record(tx, {
        action: "user.created",
        entityType: "User",
        entityId,
        actorId,
      });
    });

    const rows = await testDb.auditEvent.findMany({ where: { entityId } });
    expect(rows).toHaveLength(1);
    const id = rows[0]!.id;

    // The REVOKE UPDATE is already applied — Postgres must reject this.
    await expect(
      testDb.$executeRaw`UPDATE audit_event SET reason = 'tampered' WHERE id = ${id}`,
    ).rejects.toThrow();
  });

  it("DELETE on audit_event is rejected by Postgres", async () => {
    const actorId = await seedUser();
    const entityId = unique("ao-del-ent");

    await testDb.$transaction(async (tx) => {
      await audit.record(tx, {
        action: "order.created",
        entityType: "Order",
        entityId,
        actorId,
      });
    });

    const rows = await testDb.auditEvent.findMany({ where: { entityId } });
    expect(rows).toHaveLength(1);
    const id = rows[0]!.id;

    // The REVOKE DELETE is already applied — Postgres must reject this.
    await expect(
      testDb.$executeRaw`DELETE FROM audit_event WHERE id = ${id}`,
    ).rejects.toThrow();
  });
});
