// Contract test for src/server/production/workload.ts —
// specs/014-production/contracts/production.md's `getDepartmentWorkload`.
// tasks.md T042 (Polish, 090's dashboard consumer).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getDepartmentWorkload } from "~/server/production/workload";
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

function actorWith(permissions: Permission[]): Actor {
  return {
    userId: unique("test-workload-actor"),
    roles: [],
    permissions: new Set<Permission>(permissions),
    departmentIds: [],
  };
}

let customerId: string;

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedWorkItem(departmentId: string, state: "READY_FOR_PRODUCTION" | "IN_PRODUCTION") {
  const order = await testDb.order.create({
    data: {
      number: Number(process.hrtime.bigint() % 1_000_000_000n),
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: unique("test-workload-creator"),
    },
  });
  await testDb.user.create({
    data: {
      id: order.createdById,
      name: order.createdById,
      email: `${order.createdById}@local.invalid`,
      username: order.createdById,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  return testDb.workItem.create({ data: { orderId: order.id, state, departmentId } });
}

describe("production contract: getDepartmentWorkload", () => {
  it("requires production.operate — FORBIDDEN without it", async () => {
    await expect(getDepartmentWorkload(actorWith([]))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns readyCount/inProductionCount per department, not scoped to the actor's own departments", async () => {
    const department = await testDb.department.create({ data: { name: unique("Dept") } });
    await seedWorkItem(department.id, "READY_FOR_PRODUCTION");
    await seedWorkItem(department.id, "READY_FOR_PRODUCTION");
    await seedWorkItem(department.id, "IN_PRODUCTION");

    const actor = actorWith(["production.operate"]);
    const rows = await getDepartmentWorkload(actor);
    const row = rows.find((r) => r.departmentId === department.id);

    expect(row).toBeDefined();
    expect(row?.readyCount).toBe(2);
    expect(row?.inProductionCount).toBe(1);
  });
});
