// Integration test for createOrder — tasks.md T015, US2.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { createOrder } from "~/server/orders";
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

const receptionActor: Actor = {
  userId: unique("test-reception-createorder"),
  roles: [],
  permissions: new Set<Permission>(["order.create"]),
  departmentIds: [],
};

let customerId: string;
let departmentIds: string[];

beforeAll(async () => {
  await testDb.user.create({
    data: {
      id: receptionActor.userId,
      name: "Test Reception",
      email: `${receptionActor.userId}@local.invalid`,
      username: receptionActor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;

  const depts = await Promise.all(
    [1, 2, 3, 4].map((i) => testDb.department.create({ data: { name: unique(`Dept${i}`) } })),
  );
  departmentIds = depts.map((d) => d.id);
});

describe("createOrder (integration)", () => {
  it("creates one Order and 4 Work Items across 4 departments, one audit.record per Work Item, and honors per-item dueDate overrides", async () => {
    const orderDueDate = new Date("2026-10-01T00:00:00.000Z");
    const itemDueDate = new Date("2026-09-25T00:00:00.000Z");

    const { orderId, workItemIds } = await createOrder(receptionActor, {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "GROUPED",
      dueDate: orderDueDate,
      workItems: departmentIds.map((departmentId, i) => ({
        quantity: 10 + i,
        widthValue: 5,
        heightValue: 5,
        dimensionUnit: "CM" as const,
        requiresDesign: true,
        requiresReview: true,
        departmentId,
        ...(i === 0 ? { dueDate: itemDueDate } : {}),
      })),
    });

    expect(workItemIds).toHaveLength(4);

    const order = await testDb.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.mode).toBe("GROUPED");
    expect(order.dueDate?.toISOString()).toBe(orderDueDate.toISOString());

    const workItems = await testDb.workItem.findMany({ where: { orderId } });
    expect(workItems).toHaveLength(4);
    expect(new Set(workItems.map((wi) => wi.departmentId))).toEqual(new Set(departmentIds));

    const firstItem = workItems.find((wi) => wi.id === workItemIds[0]);
    expect(firstItem?.dueDate?.toISOString()).toBe(itemDueDate.toISOString());
    const secondItem = workItems.find((wi) => wi.id === workItemIds[1]);
    expect(secondItem?.dueDate).toBeNull();

    const workItemAuditEvents = await testDb.auditEvent.findMany({
      where: { entityId: { in: workItemIds }, action: "workitem.created" },
    });
    expect(workItemAuditEvents).toHaveLength(4);

    const orderAuditEvents = await testDb.auditEvent.findMany({
      where: { entityId: orderId, action: "order.created" },
    });
    expect(orderAuditEvents).toHaveLength(1);
  });
});
