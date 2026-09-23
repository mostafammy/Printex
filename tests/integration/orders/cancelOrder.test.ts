// Integration test for cancelOrder — tasks.md T034, US6.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { cancelOrder } from "~/server/orders";
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
  userId: unique("test-cancel-order-actor"),
  roles: [],
  permissions: new Set<Permission>(["order.cancel"]),
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

describe("cancelOrder (integration)", () => {
  it("cancels only the non-terminal Work Items, leaving already-terminal ones untouched, each with its own audit entry", async () => {
    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "GROUPED",
        createdById: actor.userId,
      },
    });

    const nonTerminal1 = await testDb.workItem.create({ data: { orderId: order.id, state: "NEW" } });
    const nonTerminal2 = await testDb.workItem.create({ data: { orderId: order.id, state: "IN_DESIGN" } });
    const alreadyDelivered = await testDb.workItem.create({
      data: { orderId: order.id, state: "DELIVERED" },
    });

    const { cancelledWorkItemIds } = await cancelOrder(actor, order.id, "customer cancelled entire order");

    expect(new Set(cancelledWorkItemIds)).toEqual(new Set([nonTerminal1.id, nonTerminal2.id]));

    const items = await testDb.workItem.findMany({ where: { orderId: order.id } });
    const byId = new Map(items.map((wi) => [wi.id, wi]));
    expect(byId.get(nonTerminal1.id)?.state).toBe("CANCELLED");
    expect(byId.get(nonTerminal2.id)?.state).toBe("CANCELLED");
    expect(byId.get(alreadyDelivered.id)?.state).toBe("DELIVERED");

    const transitions = await testDb.workItemTransition.findMany({
      where: { workItemId: { in: [nonTerminal1.id, nonTerminal2.id] } },
    });
    expect(transitions).toHaveLength(2);

    const untouchedTransitions = await testDb.workItemTransition.findMany({
      where: { workItemId: alreadyDelivered.id },
    });
    expect(untouchedTransitions).toHaveLength(0);
  });
});
