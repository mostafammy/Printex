// Integration test for addWorkItem — tasks.md T039, US7.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { addWorkItem } from "~/server/orders";
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

const actor: Actor = {
  userId: unique("test-add-wi-actor"),
  roles: [],
  permissions: new Set<Permission>(["order.create"]),
  departmentIds: [],
};

let customerId: string;

beforeAll(async () => {
  await testDb.user.create({
    data: {
      id: actor.userId,
      name: "Test Actor",
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

const newItemInput = {
  quantity: 5,
  widthValue: 10,
  heightValue: 10,
  dimensionUnit: "CM" as const,
  requiresDesign: true,
  requiresReview: true,
};

describe("addWorkItem (integration)", () => {
  it("succeeds while the order has any non-terminal Work Item, and the new item starts at NEW independent of siblings' states", async () => {
    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "GROUPED",
        createdById: actor.userId,
      },
    });
    await testDb.workItem.create({ data: { orderId: order.id, state: "IN_DESIGN" } });

    const { workItemId } = await addWorkItem(actor, order.id, newItemInput);

    const created = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(created.state).toBe("NEW");
  });

  it("is refused with DomainOrderError(ORDER_FINISHED) once every Work Item is terminal", async () => {
    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "GROUPED",
        createdById: actor.userId,
      },
    });
    await testDb.workItem.create({ data: { orderId: order.id, state: "DELIVERED" } });
    await testDb.workItem.create({ data: { orderId: order.id, state: "CANCELLED" } });

    await expect(addWorkItem(actor, order.id, newItemInput)).rejects.toMatchObject({
      code: "ORDER_FINISHED",
    });

    const items = await testDb.workItem.findMany({ where: { orderId: order.id } });
    expect(items).toHaveLength(2); // nothing written
  });
});
