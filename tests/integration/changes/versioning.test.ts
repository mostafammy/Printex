// tests/integration/changes/versioning.test.ts
// Integration test for User Story 1: Specification Versioning.
// tasks.md T022, spec FR-001..005, FR-030.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser, seedWorkItem } from "../../helpers/seed";
import { quickCreateOrder, createOrder } from "~/server/orders/create";
import { addWorkItem } from "~/server/orders/workItems";
import {
  applySpecChangeInTx,
  getSpecHistory,
} from "~/server/changes";
import { toSpecSnapshot } from "~/server/changes/specFields";
import { __resetSpecChangeListenersForTests } from "~/server/changes/events";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

beforeEach(() => {
  __resetSpecChangeListenersForTests();
});

function makeActor(userId: string): Actor {
  return {
    userId,
    roles: ["RECEPTION", "ADMIN_OWNER"],
    permissions: new Set([
      "order.create",
      "order.edit",
      "order.cancel",
      "change.approve",
      "admin.override",
    ]),
    departmentIds: [],
  };
}

/**
 * Asserts FR-003: "WorkItem mirror columns == toSpecSnapshot(currentSpecVersion)"
 */
async function assertMirrorMatchesCurrentVersion(workItemId: string): Promise<void> {
  const item = await testDb.workItem.findUniqueOrThrow({
    where: { id: workItemId },
    include: { currentSpecVersion: true },
  });

  expect(item.currentSpecVersionId).not.toBeNull();
  expect(item.currentSpecVersion).not.toBeNull();

  const mirrorSnapshot = toSpecSnapshot(item);
  const versionSnapshot = toSpecSnapshot(item.currentSpecVersion!);
  expect(mirrorSnapshot).toEqual(versionSnapshot);
}

describe("016 Specification Versioning (integration, T022)", () => {
  it("quickCreateOrder creates v1 INITIAL with entered values, pointer set, and audit (US1-1, FR-001)", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const actor = makeActor(userId);

    const { workItemId } = await quickCreateOrder(actor, {
      customerId,
      description: "Quick business cards",
      priority: "NORMAL",
      channel: "WALK_IN",
    });

    const versions = await testDb.specVersion.findMany({ where: { workItemId } });
    expect(versions).toHaveLength(1);

    const v1 = versions[0]!;
    expect(v1.version).toBe(1);
    expect(v1.origin).toBe("INITIAL");
    expect(v1.description).toBe("Quick business cards");
    expect(v1.stateAtCreation).toBe("NEW");
    expect(v1.createdById).toBe(userId);

    const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(wi.currentSpecVersionId).toBe(v1.id);

    const auditRow = await testDb.auditEvent.findFirst({
      where: { entityType: "SpecVersion", entityId: v1.id, action: "spec_version.created" },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.actorId).toBe(userId);

    await assertMirrorMatchesCurrentVersion(workItemId);
  });

  it("createOrder (2 items) creates v1 INITIAL for both items with pointer and audits", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const actor = makeActor(userId);

    const { workItemIds } = await createOrder(actor, {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      workItems: [
        {
          description: "Item One",
          quantity: 200,
          widthValue: 10,
          heightValue: 15,
          dimensionUnit: "CM",
          requiresDesign: true,
          requiresReview: true,
          material: "Matte Paper",
        },
        {
          description: "Item Two",
          quantity: 500,
          material: "Vinyl",
          widthValue: 10,
          heightValue: 20,
          dimensionUnit: "CM",
          requiresDesign: true,
          requiresReview: true,
        },
      ],
    });

    expect(workItemIds).toHaveLength(2);

    for (const wiId of workItemIds) {
      const versions = await testDb.specVersion.findMany({ where: { workItemId: wiId } });
      expect(versions).toHaveLength(1);
      const v = versions[0]!;
      expect(v.version).toBe(1);
      expect(v.origin).toBe("INITIAL");
      expect(v.stateAtCreation).toBe("NEW");
      expect(v.createdById).toBe(userId);

      const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: wiId } });
      expect(wi.currentSpecVersionId).toBe(v.id);

      const auditRow = await testDb.auditEvent.findFirst({
        where: { entityType: "SpecVersion", entityId: v.id, action: "spec_version.created" },
      });
      expect(auditRow).not.toBeNull();

      await assertMirrorMatchesCurrentVersion(wiId);
    }
  });

  it("addWorkItem creates v1 INITIAL and sets pointer", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const actor = makeActor(userId);

    const { workItemId } = await addWorkItem(actor, orderId, {
      description: "Added flyer",
      quantity: 1000,
      widthValue: 21,
      heightValue: 29.7,
      dimensionUnit: "CM",
      requiresDesign: true,
      requiresReview: true,
      material: "Glossy",
    });

    const versions = await testDb.specVersion.findMany({ where: { workItemId } });
    expect(versions).toHaveLength(1);

    const v1 = versions[0]!;
    expect(v1.version).toBe(1);
    expect(v1.origin).toBe("INITIAL");
    expect(v1.description).toBe("Added flyer");
    expect(v1.quantity).toBe(1000);
    expect(v1.createdById).toBe(userId);

    const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(wi.currentSpecVersionId).toBe(v1.id);

    await assertMirrorMatchesCurrentVersion(workItemId);
  });

  it("addWorkItem on order whose other item is IN_PRODUCTION succeeds with v1 and creates no CR (FR-030)", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const actor = makeActor(userId);

    // Sibling item in production
    await seedWorkItem({ orderId, state: "IN_PRODUCTION" });

    const { workItemId } = await addWorkItem(actor, orderId, {
      description: "Additional brochure while sibling in production",
      quantity: 300,
      widthValue: 15,
      heightValue: 20,
      dimensionUnit: "CM",
      requiresDesign: true,
      requiresReview: true,
      material: "Kraft",
    });

    const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(wi.state).toBe("NEW");
    expect(wi.currentSpecVersionId).not.toBeNull();

    // No change requests created
    const crCount = await testDb.changeRequest.count({ where: { workItemId } });
    expect(crCount).toBe(0);

    await assertMirrorMatchesCurrentVersion(workItemId);
  });

  it("factory-made Work Item without version gets BACKFILL v1 then v2 in one transaction, readable via getSpecHistory (FR-005 self-heal, US1-2)", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });

    // Create unversioned Work Item via factory
    const unversionedItem = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        description: "Unversioned initial flyer",
        quantity: 500,
        material: "Standard",
      },
    });

    expect(unversionedItem.currentSpecVersionId).toBeNull();
    const initialVersions = await testDb.specVersion.findMany({
      where: { workItemId: unversionedItem.id },
    });
    expect(initialVersions).toHaveLength(0);

    // Call applySpecChangeInTx: self-heals v1 (BACKFILL) then creates v2 (DIRECT_EDIT)
    const actor = makeActor(userId);
    const applied = await testDb.$transaction(async (tx) => {
      return applySpecChangeInTx(
        { tx, afterCommit: (fn) => void fn() },
        {
          workItemId: unversionedItem.id,
          actorId: userId,
          origin: "DIRECT_EDIT",
          patch: { quantity: 800 },
          expected: { version: 1 },
          reason: "Customer requested 800 instead",
          ifUnchanged: "fail",
        },
      );
    });

    expect(applied).not.toBeNull();
    expect(applied!.previous.version).toBe(1);
    expect(applied!.previous.origin).toBe("BACKFILL");
    expect(applied!.previous.snapshot.quantity).toBe(500);

    expect(applied!.current.version).toBe(2);
    expect(applied!.current.origin).toBe("DIRECT_EDIT");
    expect(applied!.current.snapshot.quantity).toBe(800);

    const allVersions = await testDb.specVersion.findMany({
      where: { workItemId: unversionedItem.id },
      orderBy: { version: "asc" },
    });
    expect(allVersions).toHaveLength(2);
    expect(allVersions[0]!.version).toBe(1);
    expect(allVersions[0]!.origin).toBe("BACKFILL");
    expect(allVersions[1]!.version).toBe(2);
    expect(allVersions[1]!.origin).toBe("DIRECT_EDIT");

    // Call getSpecHistory and verify both versions returned
    const historyResult = await getSpecHistory(actor, { workItemId: unversionedItem.id });
    expect(historyResult.ok).toBe(true);
    if (!historyResult.ok) return;

    expect(historyResult.data.versions).toHaveLength(2);
    expect(historyResult.data.versions[0]!.version).toBe(1);
    expect(historyResult.data.versions[0]!.snapshot.quantity).toBe(500);
    expect(historyResult.data.versions[1]!.version).toBe(2);
    expect(historyResult.data.versions[1]!.snapshot.quantity).toBe(800);

    expect(historyResult.data.diffs).toHaveLength(1);
    expect(historyResult.data.diffs[0]!.from).toBe(1);
    expect(historyResult.data.diffs[0]!.to).toBe(2);
    expect(historyResult.data.diffs[0]!.changes).toEqual([
      { field: "quantity", kind: "CHANGED", before: 500, after: 800 },
    ]);

    await assertMirrorMatchesCurrentVersion(unversionedItem.id);
  });
});
