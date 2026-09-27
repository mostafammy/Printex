// tests/contract/changes/directCostPort.test.ts
// The DirectCostPort contract for 052 Finance. tasks.md T064,
// contracts/events-and-ports.md §2.

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedUser } from "../../helpers/seed";
import {
  cancelAfterProductionStarted,
  noopDirectCostPort,
  setDirectCostPort,
  type DirectCostPort,
} from "~/server/changes";
import { __resetDirectCostPortForTests, getDirectCostPort } from "~/server/changes/ports";
import { createProductionItem, receptionActor } from "../../integration/changes/productionFactory";

afterAll(async () => {
  await testDb.$disconnect();
});

afterEach(() => {
  __resetDirectCostPortForTests();
});

describe("T064 — DirectCostPort", () => {
  it("defaults to the no-op, and setDirectCostPort replaces it", () => {
    expect(getDirectCostPort()).toBe(noopDirectCostPort);

    const port: DirectCostPort = { recordLateCancellationCost: () => Promise.resolve() };
    setDirectCostPort(port);
    expect(getDirectCostPort()).toBe(port);
  });

  it("with the no-op installed, the LateCancellation row is still recorded", async () => {
    const item = await createProductionItem();
    const res = await cancelAfterProductionStarted(receptionActor(await seedUser()), {
      workItemId: item.workItemId,
      reason: "customer withdrew",
      costIncurred: "12.5",
    });
    expect(res.ok).toBe(true);
    const row = await testDb.lateCancellation.findUniqueOrThrow({
      where: { workItemId: item.workItemId },
    });
    expect(row.costIncurred.toFixed(2)).toBe("12.50");
  });

  it("receives the cancellation's tx: its writes commit with the cancellation", async () => {
    const item = await createProductionItem();
    const marker = `cost-port-${item.workItemId}`;
    setDirectCostPort({
      async recordLateCancellationCost(tx, cost) {
        // Stand-in for 052's direct-cost row: an outbox entry written in the same tx.
        await tx.notificationEvent.create({
          data: {
            type: marker,
            entityType: "LateCancellation",
            entityId: cost.lateCancellationId,
            recipientUserIds: [],
            recipientRoles: [],
            recipientDepartmentIds: [],
          },
        });
      },
    });

    const res = await cancelAfterProductionStarted(receptionActor(await seedUser()), {
      workItemId: item.workItemId,
      reason: "customer withdrew",
      costIncurred: "350",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const written = await testDb.notificationEvent.findFirstOrThrow({ where: { type: marker } });
    expect(written.entityId).toBe(res.data.lateCancellationId);
  });

  it("a port write is rolled back with the cancellation when the port then throws", async () => {
    const item = await createProductionItem();
    const marker = `cost-port-rollback-${item.workItemId}`;
    setDirectCostPort({
      async recordLateCancellationCost(tx, cost) {
        await tx.notificationEvent.create({
          data: {
            type: marker,
            entityType: "LateCancellation",
            entityId: cost.lateCancellationId,
            recipientUserIds: [],
            recipientRoles: [],
            recipientDepartmentIds: [],
          },
        });
        throw new Error("ledger closed");
      },
    });

    await expect(
      cancelAfterProductionStarted(receptionActor(await seedUser()), {
        workItemId: item.workItemId,
        reason: "customer withdrew",
        costIncurred: "350",
      }),
    ).rejects.toThrow("ledger closed");

    expect(await testDb.notificationEvent.count({ where: { type: marker } })).toBe(0);
    expect((await testDb.workItem.findUniqueOrThrow({ where: { id: item.workItemId } })).state).toBe(
      "IN_PRODUCTION",
    );
  });
});
