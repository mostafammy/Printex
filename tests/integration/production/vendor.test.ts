// Integration test for recordSentToVendor/recordReceivedFromVendor —
// specs/014-production/tasks.md T033 (US6). Covers the full sent -> received
// cycle for an external-production department, including the audit trail
// (research.md §5: one VendorProductionRecord per production cycle).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { recordSentToVendor, recordReceivedFromVendor } from "~/server/production/vendor";
import { completeProduction } from "~/server/production/completion";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

let customerId: string;
let externalDept: { id: string };

function actorFor(departmentIds: string[]): Actor {
  return {
    userId: unique("test-integration-vendor-actor"),
    roles: [],
    permissions: new Set<Permission>(["production.operate"]),
    departmentIds,
  };
}

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  externalDept = await testDb.department.create({
    data: { name: unique("External-Vendor-Dept"), isExternalProduction: true },
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

describe("recordSentToVendor + recordReceivedFromVendor (integration, US6)", () => {
  it("runs the full sent -> received cycle and records both audit entries", async () => {
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
      data: { orderId: order.id, state: "IN_PRODUCTION", departmentId: externalDept.id },
    });

    const { recordId } = await recordSentToVendor(actor, workItem.id, { vendorName: "Coastal Printers" });

    const sentAudit = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItem.id, action: "workitem.sent_to_vendor" },
    });
    expect(sentAudit).not.toBeNull();

    let record = await testDb.vendorProductionRecord.findUnique({ where: { id: recordId } });
    expect(record?.receivedAt).toBeNull();
    expect(record?.sentAt).toBeInstanceOf(Date);

    await recordReceivedFromVendor(actor, workItem.id, recordId);

    const receivedAudit = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItem.id, action: "workitem.received_from_vendor" },
    });
    expect(receivedAudit).not.toBeNull();

    record = await testDb.vendorProductionRecord.findUnique({ where: { id: recordId } });
    expect(record?.receivedAt).toBeInstanceOf(Date);
  });

  it("blocks completeProduction until the vendor receipt is recorded, then allows it (FR-012)", async () => {
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
      data: { orderId: order.id, state: "IN_PRODUCTION", departmentId: externalDept.id },
    });

    await expect(
      completeProduction(actor, workItem.id, { producedQuantity: 10 }),
    ).rejects.toMatchObject({ code: "VENDOR_RECEIPT_REQUIRED" });

    const { recordId } = await recordSentToVendor(actor, workItem.id, { vendorName: "Riverside Vendor" });

    await expect(
      completeProduction(actor, workItem.id, { producedQuantity: 10 }),
    ).rejects.toMatchObject({ code: "VENDOR_RECEIPT_REQUIRED" });

    await recordReceivedFromVendor(actor, workItem.id, recordId);

    await completeProduction(actor, workItem.id, { producedQuantity: 10 });

    const completed = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(completed?.state).toBe("PRODUCTION_COMPLETED");
    expect(completed?.producedQuantity).toBe(10);
  });
});
