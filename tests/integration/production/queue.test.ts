// Integration test for getOperatorQueue/routeToDepartment — specs/014-production/
// tasks.md T009 (US1), T009a. Seeds 3 READY_FOR_PRODUCTION Work Items across 2
// departments (1 urgent, 2 normal at different enteredQueueAt) plus 1 non-ready
// Work Item; asserts department scoping and ordering (spec.md US1 Acceptance
// Scenarios 1-2, FR-001, FR-003). T009a covers the effective-department
// fallback and routeToDepartment (research.md §8).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed to
// the test DB (tasks.md T002) before this file can run.

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

let customerId: string;
let departmentA: { id: string };
let departmentB: { id: string };

function actorFor(departmentIds: string[]): Actor {
  return {
    userId: unique("test-integration-production-actor"),
    roles: [],
    permissions: new Set<Permission>(["production.operate", "workitem.assign_designer"]),
    departmentIds,
  };
}

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  departmentA = await testDb.department.create({ data: { name: unique("Dept-A") } });
  departmentB = await testDb.department.create({ data: { name: unique("Dept-B") } });
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

async function seedOrder(priority: "NORMAL" | "URGENT", createdById: string) {
  return testDb.order.create({
    data: {
      number: Number(process.hrtime.bigint() % 1_000_000_000n),
      customerId,
      channel: "WALK_IN",
      priority,
      mode: "SEPARATE",
      createdById,
    },
  });
}

async function seedReadyWorkItem(
  priority: "NORMAL" | "URGENT",
  enteredAt: Date,
  departmentId: string,
  createdById: string,
) {
  const order = await seedOrder(priority, createdById);
  const workItem = await testDb.workItem.create({
    data: { orderId: order.id, state: "READY_FOR_PRODUCTION", departmentId },
  });
  await testDb.workItemTransition.create({
    data: {
      workItemId: workItem.id,
      from: "WAITING_PRICING",
      to: "READY_FOR_PRODUCTION",
      actorId: createdById,
      at: enteredAt,
    },
  });
  return workItem;
}

describe("getOperatorQueue (integration, US1)", () => {
  it("scopes to the actor's departments, orders urgent-first then oldest, excludes non-ready and other-department items", async () => {
    const actor = actorFor([departmentA.id]);
    await seedActorUser(actor);

    const now = Date.now();
    const olderNormal = await seedReadyWorkItem("NORMAL", new Date(now - 60_000), departmentA.id, actor.userId);
    const newerNormal = await seedReadyWorkItem("NORMAL", new Date(now - 10_000), departmentA.id, actor.userId);
    const urgent = await seedReadyWorkItem("URGENT", new Date(now - 30_000), departmentA.id, actor.userId);
    const otherDept = await seedReadyWorkItem("URGENT", new Date(now), departmentB.id, actor.userId);

    const order = await seedOrder("NORMAL", actor.userId);
    const notReady = await testDb.workItem.create({
      data: { orderId: order.id, state: "IN_PRODUCTION", departmentId: departmentA.id },
    });

    const rows = await getOperatorQueue(actor);
    const ids = new Set([olderNormal.id, newerNormal.id, urgent.id, otherDept.id, notReady.id]);
    const relevant = rows.filter((r) => ids.has(r.workItemId));

    expect(relevant.map((r) => r.workItemId)).toEqual([urgent.id, olderNormal.id, newerNormal.id]);
    expect(rows.find((r) => r.workItemId === otherDept.id)).toBeUndefined();
    expect(rows.find((r) => r.workItemId === notReady.id)).toBeUndefined();
  });
});

describe("routeToDepartment + effective-department fallback (integration, US1, T009a, research.md §8)", () => {
  it("falls back to the Product Type default when departmentId is null, and routeToDepartment overrides it", async () => {
    const actor = actorFor([departmentA.id, departmentB.id]);
    await seedActorUser(actor);

    const productType = await testDb.productType.create({
      data: { name: unique("ProductType"), defaultDepartmentId: departmentA.id },
    });
    const order = await seedOrder("NORMAL", actor.userId);
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "READY_FOR_PRODUCTION",
        productTypeId: productType.id,
        departmentId: null,
      },
    });
    await testDb.workItemTransition.create({
      data: {
        workItemId: workItem.id,
        from: "WAITING_PRICING",
        to: "READY_FOR_PRODUCTION",
        actorId: actor.userId,
      },
    });

    let rows = await getOperatorQueue(actor);
    expect(rows.find((r) => r.workItemId === workItem.id)?.departmentId).toBe(departmentA.id);

    await routeToDepartment(actor, workItem.id, departmentB.id);

    rows = await getOperatorQueue(actor);
    expect(rows.find((r) => r.workItemId === workItem.id)?.departmentId).toBe(departmentB.id);
  });

  it("refuses routeToDepartment once the Work Item is IN_PRODUCTION or later", async () => {
    const actor = actorFor([departmentA.id]);
    await seedActorUser(actor);

    const order = await seedOrder("NORMAL", actor.userId);
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "IN_PRODUCTION", departmentId: departmentA.id },
    });

    await expect(routeToDepartment(actor, workItem.id, departmentB.id)).rejects.toMatchObject({
      code: "PRODUCTION_ALREADY_STARTED",
    });
  });

  it("refuses getOperatorQueue and routeToDepartment for an actor missing the required permission", async () => {
    const unauthorized: Actor = {
      userId: unique("test-integration-production-unauth"),
      roles: [],
      permissions: new Set<Permission>(),
      departmentIds: [departmentA.id],
    };

    await expect(getOperatorQueue(unauthorized)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(routeToDepartment(unauthorized, "nonexistent", departmentA.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
