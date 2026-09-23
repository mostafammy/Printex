// Integration test for completeProduction — specs/014-production/tasks.md T023 (US4).
// Covers completing a Work Item with produced quantity and notes, closing the open
// active PhaseTiming segment, writing the audit event, and enforcing the VENDOR_RECEIPT_REQUIRED
// gate for external production departments (FR-006, FR-007, FR-008, FR-012).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { completeProduction } from "~/server/production/completion";
import { startProduction } from "~/server/production/timer";
import { recordSentToVendor, recordReceivedFromVendor } from "~/server/production/vendor";
import type { Actor, Permission } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

let customerId: string;
let internalDept: { id: string };
let externalDept: { id: string };

function actorFor(departmentIds: string[]): Actor {
  return {
    userId: unique("test-integration-completion-actor"),
    roles: [],
    permissions: new Set<Permission>(["production.operate"]),
    departmentIds,
  };
}

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  internalDept = await testDb.department.create({
    data: { name: unique("Internal-Production-Dept"), isExternalProduction: false },
  });
  externalDept = await testDb.department.create({
    data: { name: unique("External-Production-Dept"), isExternalProduction: true },
  });
});

async function seedActorUser(actor: Actor) {
  await testDb.user.create({
    data: {
      id: actor.userId,
      name: "Test Operator",
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
}

describe("completeProduction (integration, US4)", () => {
  it("completes an IN_PRODUCTION Work Item, sets quantity/notes, closes active PhaseTiming, and records audit event", async () => {
    const actor = actorFor([internalDept.id]);
    await seedActorUser(actor);

    const order = await testDb.order.create({
      data: {
        number: Number(process.hrtime.bigint() % 1_000_000_000n),
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "READY_FOR_PRODUCTION", departmentId: internalDept.id },
    });

    // Start production: moves to IN_PRODUCTION and opens an ACTIVE PhaseTiming segment
    await startProduction(actor, workItem.id);

    const inProductionItem = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(inProductionItem?.state).toBe("IN_PRODUCTION");

    const openSegment = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItem.id, phase: "IN_PRODUCTION", kind: "ACTIVE", endedAt: null },
    });
    expect(openSegment).not.toBeNull();
    expect(openSegment?.userId).toBe(actor.userId);

    // Complete production with produced quantity and note
    await completeProduction(actor, workItem.id, {
      producedQuantity: 50,
      notes: "Printed and inspected 50 units",
    });

    // WorkItem updated state, quantity, notes
    const completedItem = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(completedItem?.state).toBe("PRODUCTION_COMPLETED");
    expect(completedItem?.producedQuantity).toBe(50);
    expect(completedItem?.productionNotes).toBe("Printed and inspected 50 units");

    // Open segment is closed (endedAt non-null)
    const remainingOpen = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItem.id, kind: "ACTIVE", endedAt: null },
    });
    expect(remainingOpen).toBeNull();

    const closedSegment = await testDb.phaseTiming.findUnique({ where: { id: openSegment!.id } });
    expect(closedSegment?.endedAt).toBeInstanceOf(Date);

    // Audit event recorded
    const auditEvent = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItem.id, action: "workitem.production_completed" },
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.actorId).toBe(actor.userId);
    expect(auditEvent?.after).toMatchObject({
      producedQuantity: 50,
      notes: "Printed and inspected 50 units",
    });
  });

  it("enforces VENDOR_RECEIPT_REQUIRED gate for external production departments", async () => {
    const actor = actorFor([externalDept.id]);
    await seedActorUser(actor);

    const order = await testDb.order.create({
      data: {
        number: Number(process.hrtime.bigint() % 1_000_000_000n),
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "READY_FOR_PRODUCTION", departmentId: externalDept.id },
    });

    await startProduction(actor, workItem.id);

    // 1. Refused before any vendor record exists
    await expect(
      completeProduction(actor, workItem.id, { producedQuantity: 20 }),
    ).rejects.toMatchObject({ code: "VENDOR_RECEIPT_REQUIRED" });

    // 2. Refused while vendor record is sent but not yet received
    const { recordId } = await recordSentToVendor(actor, workItem.id, {
      vendorName: "External Finishing House",
    });

    await expect(
      completeProduction(actor, workItem.id, { producedQuantity: 20 }),
    ).rejects.toMatchObject({ code: "VENDOR_RECEIPT_REQUIRED" });

    // 3. Allowed once vendor receipt is recorded
    await recordReceivedFromVendor(actor, workItem.id, recordId);

    await completeProduction(actor, workItem.id, {
      producedQuantity: 20,
      notes: "Received and inspected from vendor",
    });

    const completed = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(completed?.state).toBe("PRODUCTION_COMPLETED");
    expect(completed?.producedQuantity).toBe(20);
    expect(completed?.productionNotes).toBe("Received and inspected from vendor");
  });
});
