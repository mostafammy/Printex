// tests/integration/changes/editWorkItemDelegation.test.ts
// Integration test verifying 011 editWorkItem delegation through applySpecChangeInTx.
// tasks.md T025, spec FR-031, PRD §46.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser, seedWorkItem } from "../../helpers/seed";
import { quickCreateOrder, addWorkItem, editWorkItem, DomainOrderError } from "~/server/orders";

import {
  registerSpecChangeListener,
  __resetSpecChangeListenersForTests,
  type SpecChangedEvent,
} from "~/server/changes/events";
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
    roles: ["RECEPTION"],
    permissions: new Set(["order.create", "order.edit", "order.cancel"]),
    departmentIds: [],
  };
}

describe("011 editWorkItem delegation to change control (integration, T025)", () => {
  it("creates DIRECT_EDIT version and writes workitem.edited audit on spec change in NEW", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const actor = makeActor(userId);

    const { workItemId } = await quickCreateOrder(actor, {
      customerId,
      description: "Original brochure",
      priority: "NORMAL",
      channel: "WALK_IN",
    });

    const v1List = await testDb.specVersion.findMany({ where: { workItemId } });
    expect(v1List).toHaveLength(1);
    expect(v1List[0]!.version).toBe(1);

    const emitted: SpecChangedEvent[] = [];
    registerSpecChangeListener("test-spy", async (_tx, event) => {
      emitted.push(event);
    });

    await editWorkItem(actor, workItemId, { quantity: 800 });

    const versions = await testDb.specVersion.findMany({
      where: { workItemId },
      orderBy: { version: "asc" },
    });
    expect(versions).toHaveLength(2);

    const v2 = versions[1]!;
    expect(v2.version).toBe(2);
    expect(v2.origin).toBe("DIRECT_EDIT");
    expect(v2.quantity).toBe(800);
    expect(v2.createdById).toBe(userId);

    const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(wi.currentSpecVersionId).toBe(v2.id);
    expect(wi.quantity).toBe(800);

    // Both audits written: spec_version.created and workitem.edited
    const specVersionAudit = await testDb.auditEvent.findFirst({
      where: { entityType: "SpecVersion", entityId: v2.id, action: "spec_version.created" },
    });
    expect(specVersionAudit).not.toBeNull();

    const workItemAudit = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItemId, action: "workitem.edited" },
      orderBy: { createdAt: "desc" },
    });
    expect(workItemAudit).not.toBeNull();

    // Event emitted
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.fromVersion).toBe(1);
    expect(emitted[0]!.toVersion).toBe(2);
    expect(emitted[0]!.origin).toBe("DIRECT_EDIT");
    expect(emitted[0]!.changedFields).toEqual(["quantity"]);
  });

  it("dueDate-only patch creates no version and emits no SPEC_CHANGED, but is audited (FR-031)", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const actor = makeActor(userId);

    const { workItemId } = await quickCreateOrder(actor, {
      customerId,
      description: "Brochure with due date",
      priority: "NORMAL",
      channel: "WALK_IN",
    });

    const emitted: SpecChangedEvent[] = [];
    registerSpecChangeListener("test-spy-due-date", async (_tx, event) => {
      emitted.push(event);
    });

    const targetDueDate = new Date("2026-11-15T12:00:00.000Z");
    await editWorkItem(actor, workItemId, { dueDate: targetDueDate });

    // No new SpecVersion
    const versions = await testDb.specVersion.findMany({ where: { workItemId } });
    expect(versions).toHaveLength(1);

    // No SPEC_CHANGED event
    expect(emitted).toHaveLength(0);

    // WorkItem updated
    const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(wi.dueDate?.toISOString()).toBe(targetDueDate.toISOString());

    // Audited as workitem.edited
    const workItemAudit = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItemId, action: "workitem.edited" },
      orderBy: { createdAt: "desc" },
    });
    expect(workItemAudit).not.toBeNull();

    // No notificationEvent written
    const notifyCount = await testDb.notificationEvent.count({
      where: { type: "work_item.spec_changed", entityId: workItemId },
    });
    expect(notifyCount).toBe(0);
  });


  it("PAST_EDIT_WINDOW is still thrown outside NEW/ASSIGNED (011 contract unchanged)", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "IN_PRODUCTION" });
    const actor = makeActor(userId);

    await expect(
      editWorkItem(actor, workItemId, { quantity: 1000 }),
    ).rejects.toThrow(DomainOrderError);

    await expect(
      editWorkItem(actor, workItemId, { quantity: 1000 }),
    ).rejects.toMatchObject({ code: "PAST_EDIT_WINDOW" });

    // SpecVersion unchanged
    const versions = await testDb.specVersion.findMany({ where: { workItemId } });
    expect(versions).toHaveLength(0);

    const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(wi.state).toBe("IN_PRODUCTION");
  });

  it("two parallel editWorkItem calls on the same item both resolve and versions 1..3 exist (M1 concurrent last-write-wins)", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const actor = makeActor(userId);

    const { workItemId } = await quickCreateOrder(actor, {
      customerId,
      description: "Concurrent edit test",
      priority: "NORMAL",
      channel: "WALK_IN",
    });

    const v1List = await testDb.specVersion.findMany({ where: { workItemId } });
    expect(v1List).toHaveLength(1);
    expect(v1List[0]!.version).toBe(1);

    // Run two editWorkItem calls concurrently on the same item
    await Promise.all([
      editWorkItem(actor, workItemId, { quantity: 600 }),
      editWorkItem(actor, workItemId, { quantity: 700 }),
    ]);

    const versions = await testDb.specVersion.findMany({
      where: { workItemId },
      orderBy: { version: "asc" },
    });
    expect(versions).toHaveLength(3);
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);

    const updatedWorkItem = await testDb.workItem.findUniqueOrThrow({
      where: { id: workItemId },
    });
    const latestVersion = versions[2]!;
    expect(latestVersion.quantity).toBe(updatedWorkItem.quantity);

    const v2 = versions[1]!;
    const v3 = versions[2]!;
    expect(new Set([v2.quantity, v3.quantity])).toEqual(new Set([600, 700]));
  });

  it("011's unchanged save (same values) produces no version and no notification row, but still writes workitem.edited (m8)", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const actor = makeActor(userId);

    const orderId = await seedOrder({ customerId, createdById: userId });
    // FR-011b: an order with no open Work Item is "finished"; seed an open sibling.
    await seedWorkItem({ orderId, state: "NEW" });
    const { workItemId } = await addWorkItem(actor, orderId, {
      description: "Unchanged save item",
      quantity: 500,
      material: "Vinyl",
      widthValue: 10,
      heightValue: 20,
      dimensionUnit: "CM",
      requiresDesign: true,
      requiresReview: true,
    });

    const initialVersions = await testDb.specVersion.findMany({ where: { workItemId } });
    expect(initialVersions).toHaveLength(1);

    // Save with the exact same values
    await editWorkItem(actor, workItemId, { quantity: 500, material: "Vinyl" });

    // No new SpecVersion created
    const afterVersions = await testDb.specVersion.findMany({ where: { workItemId } });
    expect(afterVersions).toHaveLength(1);

    // No notification row written
    const notifyCount = await testDb.notificationEvent.count({
      where: { type: "work_item.spec_changed", entityId: workItemId },
    });
    expect(notifyCount).toBe(0);

    // Still writes workitem.edited audit
    const workItemAudit = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItemId, action: "workitem.edited" },
      orderBy: { createdAt: "desc" },
    });
    expect(workItemAudit).not.toBeNull();
  });
});

