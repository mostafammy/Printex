// tests/contract/changes/append-only.test.ts
// Contract test for database-level SpecVersion and LateCancellation append-only enforcement.
// tasks.md T023, data-model.md Step 2, prisma/manual-sql/016-change-control-constraints.sql.

import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  seedCustomer,
  seedOrder,
  seedUser,
  seedWorkItem,
} from "../../helpers/seed";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

describe("016 SpecVersion & LateCancellation append-only (database contract, T023)", () => {
  it("raw UPDATE on SpecVersion is rejected by spec_version_forbid_update trigger", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });

    const specVersionId = unique("spec_v1");
    await testDb.specVersion.create({
      data: {
        id: specVersionId,
        workItemId,
        version: 1,
        origin: "INITIAL",
        quantity: 100,
        stateAtCreation: "NEW",
        createdById: userId,
      },
    });

    // BEFORE UPDATE trigger spec_version_forbid_update raises exception
    await expect(
      testDb.$executeRaw`UPDATE "SpecVersion" SET reason = 'tampered' WHERE id = ${specVersionId}`,
    ).rejects.toThrow(/SpecVersion is append-only/);
  });

  it("raw DELETE on SpecVersion is rejected by Postgres permission error", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });

    const specVersionId = unique("spec_v2");
    await testDb.specVersion.create({
      data: {
        id: specVersionId,
        workItemId,
        version: 1,
        origin: "INITIAL",
        quantity: 100,
        stateAtCreation: "NEW",
        createdById: userId,
      },
    });

    // REVOKE DELETE ON "SpecVersion" FROM CURRENT_USER
    await expect(
      testDb.$executeRaw`DELETE FROM "SpecVersion" WHERE id = ${specVersionId}`,
    ).rejects.toThrow(/permission denied/);
  });

  it("raw UPDATE on LateCancellation is rejected by Postgres permission error", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "CANCELLED" });

    const lateCancellationId = unique("lc_1");
    await testDb.lateCancellation.create({
      data: {
        id: lateCancellationId,
        workItemId,
        stateAtCancellation: "IN_PRODUCTION",
        reason: "Customer cancelled",
        costIncurred: "150.00",
        createdById: userId,
      },
    });

    // REVOKE UPDATE, DELETE ON "LateCancellation" FROM CURRENT_USER
    await expect(
      testDb.$executeRaw`UPDATE "LateCancellation" SET "costNote" = 'tampered' WHERE id = ${lateCancellationId}`,
    ).rejects.toThrow(/permission denied/);
  });

  it("raw DELETE on LateCancellation is rejected by Postgres permission error", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "CANCELLED" });

    const lateCancellationId = unique("lc_2");
    await testDb.lateCancellation.create({
      data: {
        id: lateCancellationId,
        workItemId,
        stateAtCancellation: "IN_PRODUCTION",
        reason: "Customer cancelled",
        costIncurred: "200.00",
        createdById: userId,
      },
    });

    // REVOKE UPDATE, DELETE ON "LateCancellation" FROM CURRENT_USER
    await expect(
      testDb.$executeRaw`DELETE FROM "LateCancellation" WHERE id = ${lateCancellationId}`,
    ).rejects.toThrow(/permission denied/);
  });

  it("guarantees src/server/changes/** contains no specVersion or lateCancellation update/delete calls", () => {
    const changesDir = path.resolve(process.cwd(), "src/server/changes");
    const files = fs.readdirSync(changesDir, { recursive: true }) as string[];

    expect(files.length).toBeGreaterThan(0);

    const forbiddenPatterns = [
      /specVersion\.(update|updateMany|upsert|delete|deleteMany)\b/,
      /lateCancellation\.(update|updateMany|upsert|delete|deleteMany)\b/,
      /(UPDATE|DELETE FROM)\s+"(SpecVersion|LateCancellation)"/i,
    ];

    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      const fullPath = path.join(changesDir, file);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const content = fs.readFileSync(fullPath, "utf-8");

      for (const pattern of forbiddenPatterns) {
        const matches = content.match(pattern);
        expect(
          matches,
          `File ${file} must not call specVersion or lateCancellation update/delete (append-only contract)`,
        ).toBeNull();
      }
    }
  });

});
