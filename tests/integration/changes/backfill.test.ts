// tests/integration/changes/backfill.test.ts
// Integration test for 016 spec version backfill script (tasks.md T024).

import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";
import { audit } from "~/server/auth/audit";

afterAll(async () => {
  await testDb.$disconnect();
});

async function runBackfillScript(): Promise<void> {
  const sqlPath = path.resolve(
    process.cwd(),
    "prisma/manual-sql/016-spec-version-backfill.sql",
  );
  const fileContent = fs.readFileSync(sqlPath, "utf-8");

  // Only take the migration transaction block (before Step 4 verification comments)
  const migrationBlock = fileContent.split(/--\s*Step 4/i)[0]!;

  // Split on statement terminator, strip comment lines and transaction keywords
  const statements = migrationBlock
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0 && !/^(BEGIN|COMMIT)$/i.test(s));

  expect(statements).toHaveLength(3);

  for (const stmt of statements) {
    if (stmt.length > 0) {
      await testDb.$executeRawUnsafe(stmt);
    }
  }
}


describe("016 SpecVersion backfill (integration, T024)", () => {
  it("backfills unversioned Work Items idempotently preserving updatedAt and pre-existing audits", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });

    // 1. Create 3 factory Work Items without versions:
    // (a) with Decimal dimensions
    const item1 = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        description: "Poster with decimals",
        quantity: 100,
        widthValue: "10.50",
        heightValue: "20.75",
        dimensionUnit: "CM",
        material: "Vinyl",
        finishNotes: "Matte laminate",
      },
    });

    // (b) with nulls
    const item2 = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        description: null,
        quantity: null,
        widthValue: null,
        heightValue: null,
        dimensionUnit: null,
        material: null,
        finishNotes: null,
      },
    });

    // (c) standard values
    const item3 = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        description: "Standard banner",
        quantity: 500,
        material: "Paper",
      },
    });

    const itemIds = [item1.id, item2.id, item3.id];

    // Record original updatedAt
    const originalUpdatedAts = new Map<string, number>([
      [item1.id, item1.updatedAt.getTime()],
      [item2.id, item2.updatedAt.getTime()],
      [item3.id, item3.updatedAt.getTime()],
    ]);

    // Record pre-existing workitem.edited audit row
    await testDb.$transaction(async (tx) => {
      await audit.record(tx, {
        action: "workitem.edited",
        entityType: "WorkItem",
        entityId: item1.id,
        actorId: userId,
        before: { quantity: 50 },
        after: { quantity: 100 },
      });
    });

    const priorAudits = await testDb.auditEvent.findMany({
      where: { entityId: item1.id, action: "workitem.edited" },
    });
    expect(priorAudits).toHaveLength(1);

    // 2. Execute backfill script
    await runBackfillScript();

    // 3. Assert exactly one BACKFILL v1 each, with values equal to the columns, pointer set,
    // createdById null, and WorkItem.updatedAt unchanged
    for (const id of itemIds) {
      const versions = await testDb.specVersion.findMany({
        where: { workItemId: id },
      });
      expect(versions).toHaveLength(1);
      const v = versions[0]!;
      expect(v.id).toBe(`bf_${id}`);
      expect(v.version).toBe(1);
      expect(v.origin).toBe("BACKFILL");
      expect(v.createdById).toBeNull();
      expect(v.reason).toBe("Backfilled by 016-change-control from current values");

      const wi = await testDb.workItem.findUniqueOrThrow({ where: { id } });
      expect(wi.currentSpecVersionId).toBe(v.id);
      expect(wi.updatedAt.getTime()).toBe(originalUpdatedAts.get(id));

      expect(v.description).toBe(wi.description);
      expect(v.quantity).toBe(wi.quantity);
      expect(v.dimensionUnit).toBe(wi.dimensionUnit);
      expect(v.material).toBe(wi.material);
      expect(v.finishNotes).toBe(wi.finishNotes);

      if (wi.widthValue !== null) {
        expect(v.widthValue?.toString()).toBe(wi.widthValue.toString());
      } else {
        expect(v.widthValue).toBeNull();
      }
      if (wi.heightValue !== null) {
        expect(v.heightValue?.toString()).toBe(wi.heightValue.toString());
      } else {
        expect(v.heightValue).toBeNull();
      }
    }

    // 4. Assert Step 4 verification queries return zero rows
    const unversionedItems = await testDb.$queryRaw<{ id: string }[]>`
      SELECT id FROM "WorkItem" WHERE id IN (${item1.id}, ${item2.id}, ${item3.id}) AND "currentSpecVersionId" IS NULL
    `;
    expect(unversionedItems).toHaveLength(0);

    const mismatchedItems = await testDb.$queryRaw<{ id: string }[]>`
      SELECT w.id FROM "WorkItem" w JOIN "SpecVersion" s ON s.id = w."currentSpecVersionId"
      WHERE w.id IN (${item1.id}, ${item2.id}, ${item3.id})
        AND (w."productTypeId", w.description, w.quantity, w."widthValue", w."heightValue",
             w."dimensionUnit", w.material, w."finishNotes")
        IS DISTINCT FROM
            (s."productTypeId", s.description, s.quantity, s."widthValue", s."heightValue",
             s."dimensionUnit", s.material, s."finishNotes")
    `;
    expect(mismatchedItems).toHaveLength(0);

    // (c) exactly N backfilled-or-initial v1 rows, scoped to the test's ids:
    const v1Count = await testDb.specVersion.count({
      where: {
        workItemId: { in: itemIds },
        version: 1,
      },
    });
    expect(v1Count).toBe(itemIds.length);

    // 5. A second run inserts zero versions (idempotent, US1-3)

    await runBackfillScript();

    for (const id of itemIds) {
      const versions = await testDb.specVersion.findMany({
        where: { workItemId: id },
      });
      expect(versions).toHaveLength(1);
    }

    // 6. Pre-existing workitem.edited audit rows are untouched
    const afterAudits = await testDb.auditEvent.findMany({
      where: { entityId: item1.id, action: "workitem.edited" },
    });
    expect(afterAudits).toHaveLength(1);
    expect(afterAudits[0]!.id).toBe(priorAudits[0]!.id);
  });
});
