// Contract test for src/server/production/sendBack.ts —
// specs/014-production/contracts/production.md's `sendBackToDesign`.
// tasks.md T027 (US5).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { sendBackToDesign } from "~/server/production/sendBack";
import { ForbiddenError } from "~/server/auth/authorize";
import type { Actor, Permission } from "~/server/auth";

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
    userId: unique("test-contract-sendback-actor"),
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
let department: { id: string };
let otherDepartment: { id: string };
let operatorActor: Actor;
let outsideActor: Actor;
let noPermissionActor: Actor;

beforeAll(async () => {
  department = await testDb.department.create({ data: { name: unique("Dept-SendBack") } });
  otherDepartment = await testDb.department.create({ data: { name: unique("OtherDept-SendBack") } });
  operatorActor = await createActor(["production.operate"], [department.id]);
  outsideActor = await createActor(["production.operate"], [otherDepartment.id]);
  noPermissionActor = await createActor([], [department.id]);

  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedWorkItem(
  state: "IN_PRODUCTION" | "READY_FOR_PRODUCTION" = "IN_PRODUCTION",
  deptId: string = department.id,
) {
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
  return testDb.workItem.create({
    data: {
      orderId: order.id,
      state,
      departmentId: deptId,
    },
  });
}

describe("production contract: sendBackToDesign", () => {
  it("requires production.operate scoped to the department — FORBIDDEN without it", async () => {
    const wi = await seedWorkItem();

    // Actor with no permissions
    await expect(
      sendBackToDesign(noPermissionActor, wi.id, { reason: "Design rework required" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Actor with production.operate but in a different department
    await expect(
      sendBackToDesign(outsideActor, wi.id, { reason: "Design rework required" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // State must remain unchanged
    const unchanged = await testDb.workItem.findUnique({ where: { id: wi.id } });
    expect(unchanged?.state).toBe("IN_PRODUCTION");
  });

  it("rejects a submission missing or blank reason and confirms state is unchanged", async () => {
    const wi = await seedWorkItem();

    // Missing reason
    await expect(
      sendBackToDesign(operatorActor, wi.id, {} as unknown as { reason: string }),
    ).rejects.toThrow();

    let unchanged = await testDb.workItem.findUnique({ where: { id: wi.id } });
    expect(unchanged?.state).toBe("IN_PRODUCTION");

    // Empty string reason
    await expect(
      sendBackToDesign(operatorActor, wi.id, { reason: "" }),
    ).rejects.toThrow();

    unchanged = await testDb.workItem.findUnique({ where: { id: wi.id } });
    expect(unchanged?.state).toBe("IN_PRODUCTION");

    // Whitespace-only reason
    await expect(
      sendBackToDesign(operatorActor, wi.id, { reason: "   " }),
    ).rejects.toThrow();

    unchanged = await testDb.workItem.findUnique({ where: { id: wi.id } });
    expect(unchanged?.state).toBe("IN_PRODUCTION");
  });

  it("transitions an IN_PRODUCTION Work Item with a department to REWORK_REQUIRED and returns returnId on valid input", async () => {
    const wi = await seedWorkItem();

    const { returnId } = await sendBackToDesign(operatorActor, wi.id, {
      reason: "Artwork dimensions do not match the job specifications",
    });

    expect(typeof returnId).toBe("string");
    expect(returnId.length).toBeGreaterThan(0);

    const updated = await testDb.workItem.findUnique({ where: { id: wi.id } });
    expect(updated?.state).toBe("REWORK_REQUIRED");
  });

  it("errors WORK_ITEM_NOT_FOUND when the Work Item does not exist", async () => {
    await expect(
      sendBackToDesign(operatorActor, unique("nonexistent-wi"), { reason: "Valid reason" }),
    ).rejects.toMatchObject({ code: "WORK_ITEM_NOT_FOUND" });
  });
});
