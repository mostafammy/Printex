// Contract test for src/server/production/timer.ts —
// specs/014-production/contracts/production.md's `startProduction`,
// `pauseProduction`, `resumeProduction`. tasks.md T016 (US3).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { startProduction, pauseProduction, resumeProduction } from "~/server/production/timer";
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
    userId: unique("test-contract-timer-actor"),
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
  department = await testDb.department.create({ data: { name: unique("Dept") } });
  otherDepartment = await testDb.department.create({ data: { name: unique("OtherDept") } });
  operatorActor = await createActor(["production.operate"], [department.id]);
  outsideActor = await createActor(["production.operate"], [otherDepartment.id]);
  noPermissionActor = await createActor([], [department.id]);

  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedWorkItem(
  state: "READY_FOR_PRODUCTION" | "NEW" = "READY_FOR_PRODUCTION",
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

describe("production contract: startProduction", () => {
  it("requires production.operate scoped to the Work Item's department — FORBIDDEN without it", async () => {
    const wi = await seedWorkItem("READY_FOR_PRODUCTION");

    // Actor with no permissions
    await expect(startProduction(noPermissionActor, wi.id)).rejects.toBeInstanceOf(ForbiddenError);

    // Actor with production.operate but in a different department
    await expect(startProduction(outsideActor, wi.id)).rejects.toBeInstanceOf(ForbiddenError);

    // State must remain unchanged
    const untouched = await testDb.workItem.findUnique({ where: { id: wi.id } });
    expect(untouched?.state).toBe("READY_FOR_PRODUCTION");
  });

  it("transitions the Work Item to IN_PRODUCTION when called on a READY_FOR_PRODUCTION Work Item", async () => {
    const wi = await seedWorkItem("READY_FOR_PRODUCTION");

    await startProduction(operatorActor, wi.id);

    const updated = await testDb.workItem.findUnique({ where: { id: wi.id } });
    expect(updated?.state).toBe("IN_PRODUCTION");
  });

  it("refuses with DomainProductionError('NOT_READY_FOR_PRODUCTION') when the Work Item is not READY_FOR_PRODUCTION", async () => {
    const wi = await seedWorkItem("NEW");

    await expect(startProduction(operatorActor, wi.id)).rejects.toMatchObject({
      code: "NOT_READY_FOR_PRODUCTION",
    });

    const untouched = await testDb.workItem.findUnique({ where: { id: wi.id } });
    expect(untouched?.state).toBe("NEW");
  });

  it("throws WORK_ITEM_NOT_FOUND when the Work Item does not exist", async () => {
    await expect(startProduction(operatorActor, "non-existent-work-item")).rejects.toMatchObject({
      code: "WORK_ITEM_NOT_FOUND",
    });
  });
});

describe("production contract: pauseProduction", () => {
  it("requires production.operate scoped to the Work Item's department — FORBIDDEN without it", async () => {
    const wi = await seedWorkItem("READY_FOR_PRODUCTION");

    // Actor with no permissions
    await expect(pauseProduction(noPermissionActor, wi.id)).rejects.toBeInstanceOf(ForbiddenError);

    // Actor outside the department
    await expect(pauseProduction(outsideActor, wi.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws WORK_ITEM_NOT_FOUND when the Work Item does not exist", async () => {
    await expect(pauseProduction(operatorActor, "non-existent-work-item")).rejects.toMatchObject({
      code: "WORK_ITEM_NOT_FOUND",
    });
  });
});

describe("production contract: resumeProduction", () => {
  it("requires production.operate scoped to the Work Item's department — FORBIDDEN without it", async () => {
    const wi = await seedWorkItem("READY_FOR_PRODUCTION");

    // Actor with no permissions
    await expect(resumeProduction(noPermissionActor, wi.id)).rejects.toBeInstanceOf(ForbiddenError);

    // Actor outside the department
    await expect(resumeProduction(outsideActor, wi.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws WORK_ITEM_NOT_FOUND when the Work Item does not exist", async () => {
    await expect(resumeProduction(operatorActor, "non-existent-work-item")).rejects.toMatchObject({
      code: "WORK_ITEM_NOT_FOUND",
    });
  });
});
