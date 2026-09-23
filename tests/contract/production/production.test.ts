// Contract test for src/server/production/queue.ts —
// specs/014-production/contracts/production.md's `getOperatorQueue` /
// `routeToDepartment`. tasks.md T008 (US1).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getOperatorQueue, routeToDepartment } from "~/server/production/queue";
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
    userId: unique("test-contract-production-actor"),
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
let operatorActor: Actor;
let noPermissionActor: Actor;

beforeAll(async () => {
  department = await testDb.department.create({ data: { name: unique("Dept") } });
  operatorActor = await createActor(["production.operate"], [department.id]);
  noPermissionActor = await createActor([], [department.id]);

  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedWorkItem(state: "READY_FOR_PRODUCTION" | "NEW") {
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
  return testDb.workItem.create({ data: { orderId: order.id, state, departmentId: department.id } });
}

describe("production contract: getOperatorQueue", () => {
  it("requires production.operate — FORBIDDEN without it", async () => {
    await expect(getOperatorQueue(noPermissionActor)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns only READY_FOR_PRODUCTION rows scoped to the actor's departments", async () => {
    const ready = await seedWorkItem("READY_FOR_PRODUCTION");
    const notReady = await seedWorkItem("NEW");

    const rows = await getOperatorQueue(operatorActor);
    const ids = rows.map((r) => r.workItemId);

    expect(ids).toContain(ready.id);
    expect(ids).not.toContain(notReady.id);
  });

  it("matches the frozen ProductionQueueRow shape", async () => {
    const wi = await seedWorkItem("READY_FOR_PRODUCTION");

    const rows = await getOperatorQueue(operatorActor);
    const row = rows.find((r) => r.workItemId === wi.id);

    expect(row).toBeDefined();
    expect(typeof row?.workItemId).toBe("string");
    expect(typeof row?.orderId).toBe("string");
    expect(typeof row?.orderNumber).toBe("number");
    expect(typeof row?.customerName).toBe("string");
    expect(row?.productTypeName === null || typeof row?.productTypeName === "string").toBe(true);
    expect(typeof row?.departmentId).toBe("string");
    expect(["NORMAL", "URGENT"]).toContain(row?.priority);
    expect(row?.enteredQueueAt).toBeInstanceOf(Date);
    expect(typeof row?.hasPendingFileRevision).toBe("boolean");
    expect(row?.hasPendingFileRevision).toBe(false);
  });
});

describe("production contract: routeToDepartment", () => {
  it("requires the Head-Designer/Reception routing permission (workitem.assign_designer) — FORBIDDEN without it", async () => {
    await expect(
      routeToDepartment(noPermissionActor, "nonexistent", department.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses once the Work Item is IN_PRODUCTION or later", async () => {
    const router = await createActor(["workitem.assign_designer"], [department.id]);
    const order = await testDb.order.create({
      data: {
        number: Number(process.hrtime.bigint() % 1_000_000_000n),
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: router.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "IN_PRODUCTION", departmentId: department.id },
    });

    await expect(routeToDepartment(router, workItem.id, department.id)).rejects.toMatchObject({
      code: "PRODUCTION_ALREADY_STARTED",
    });
  });
});
