// Contract test for src/server/production/vendor.ts —
// specs/014-production/contracts/production.md's `recordSentToVendor` /
// `recordReceivedFromVendor`. tasks.md T032 (US6).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { recordSentToVendor, recordReceivedFromVendor } from "~/server/production/vendor";
import { ForbiddenError } from "~/server/auth/authorize";
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

async function createActor(permissions: Permission[], departmentIds: string[]): Promise<Actor> {
  const actor: Actor = {
    userId: unique("test-contract-vendor-actor"),
    roles: [],
    permissions: new Set<Permission>(permissions),
    departmentIds,
  };
  await testDb.user.create({
    data: {
      id: actor.userId,
      name: actor.userId,
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  return actor;
}

let customerId: string;
let externalDept: { id: string };
let internalDept: { id: string };
let operatorActor: Actor;
let noPermissionActor: Actor;

beforeAll(async () => {
  externalDept = await testDb.department.create({ data: { name: unique("ExternalDept"), isExternalProduction: true } });
  internalDept = await testDb.department.create({ data: { name: unique("InternalDept") } });
  operatorActor = await createActor(["production.operate"], [externalDept.id, internalDept.id]);
  noPermissionActor = await createActor([], [externalDept.id]);

  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedWorkItem(departmentId: string) {
  const order = await testDb.order.create({
    data: {
      number: Number(process.hrtime.bigint() % 1_000_000_000n),
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: operatorActor.userId,
    },
  });
  return testDb.workItem.create({ data: { orderId: order.id, state: "IN_PRODUCTION", departmentId } });
}

describe("production contract: recordSentToVendor", () => {
  it("requires production.operate — FORBIDDEN without it", async () => {
    const wi = await seedWorkItem(externalDept.id);
    await expect(
      recordSentToVendor(noPermissionActor, wi.id, { vendorName: "Acme Print Co" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses a department not configured for external production", async () => {
    const wi = await seedWorkItem(internalDept.id);
    await expect(
      recordSentToVendor(operatorActor, wi.id, { vendorName: "Acme Print Co" }),
    ).rejects.toMatchObject({ code: "NOT_EXTERNAL_DEPARTMENT" });
  });

  it("rejects a blank vendor name", async () => {
    const wi = await seedWorkItem(externalDept.id);
    await expect(recordSentToVendor(operatorActor, wi.id, { vendorName: "  " })).rejects.toThrow();
  });

  it("creates a VendorProductionRecord for an external department", async () => {
    const wi = await seedWorkItem(externalDept.id);
    const { recordId } = await recordSentToVendor(operatorActor, wi.id, { vendorName: "Acme Print Co" });
    expect(typeof recordId).toBe("string");

    const record = await testDb.vendorProductionRecord.findUnique({ where: { id: recordId } });
    expect(record?.workItemId).toBe(wi.id);
    expect(record?.vendorName).toBe("Acme Print Co");
    expect(record?.receivedAt).toBeNull();
  });
});

describe("production contract: recordReceivedFromVendor", () => {
  it("requires production.operate — FORBIDDEN without it", async () => {
    const wi = await seedWorkItem(externalDept.id);
    const { recordId } = await recordSentToVendor(operatorActor, wi.id, { vendorName: "Vendor X" });
    await expect(recordReceivedFromVendor(noPermissionActor, wi.id, recordId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("errors WORK_ITEM_NOT_FOUND for a record belonging to a different Work Item", async () => {
    const wi1 = await seedWorkItem(externalDept.id);
    const wi2 = await seedWorkItem(externalDept.id);
    const { recordId } = await recordSentToVendor(operatorActor, wi1.id, { vendorName: "Vendor X" });
    await expect(recordReceivedFromVendor(operatorActor, wi2.id, recordId)).rejects.toMatchObject({
      code: "WORK_ITEM_NOT_FOUND",
    });
  });

  it("marks receivedAt and refuses a second receipt", async () => {
    const wi = await seedWorkItem(externalDept.id);
    const { recordId } = await recordSentToVendor(operatorActor, wi.id, { vendorName: "Vendor X" });

    await recordReceivedFromVendor(operatorActor, wi.id, recordId);
    const record = await testDb.vendorProductionRecord.findUnique({ where: { id: recordId } });
    expect(record?.receivedAt).toBeInstanceOf(Date);

    await expect(recordReceivedFromVendor(operatorActor, wi.id, recordId)).rejects.toMatchObject({
      code: "ALREADY_RECEIVED",
    });
  });
});
