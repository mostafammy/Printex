// Integration test for cancelOrder — tasks.md T034, US6.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { cancelOrder } from "~/server/orders";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth";
import { registerGuard } from "~/server/core";

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
let blockedWorkItemId: string | null = null;

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

  registerGuard({ to: "CANCELLED" }, async (ctx) => {
    if (blockedWorkItemId && ctx.workItem.id === blockedWorkItemId) {
      return {
        ok: false,
        error: { code: "GUARD_FAILED", message: "Cancellation rejected by guard" },
      };
    }
    return { ok: true, value: true };
  });
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

    const { cancelledWorkItemIds, failedWorkItemIds } = await cancelOrder(actor, order.id, "customer cancelled entire order");

    expect(new Set(cancelledWorkItemIds)).toEqual(new Set([nonTerminal1.id, nonTerminal2.id]));
    expect(failedWorkItemIds).toEqual([]);

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

  it("reports failed Work Item cancellations in failedWorkItemIds while successes land in cancelledWorkItemIds", async () => {
    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "GROUPED",
        createdById: actor.userId,
      },
    });

    const itemSuccess = await testDb.workItem.create({ data: { orderId: order.id, state: "NEW" } });
    const itemFail = await testDb.workItem.create({ data: { orderId: order.id, state: "IN_DESIGN" } });

    blockedWorkItemId = itemFail.id;

    try {
      const { cancelledWorkItemIds, failedWorkItemIds } = await cancelOrder(
        actor,
        order.id,
        "partial cancellation test",
      );

      expect(cancelledWorkItemIds).toEqual([itemSuccess.id]);
      expect(failedWorkItemIds).toEqual([
        { id: itemFail.id, reason: "Cancellation rejected by guard" },
      ]);

      const items = await testDb.workItem.findMany({ where: { orderId: order.id } });
      const byId = new Map(items.map((wi) => [wi.id, wi]));
      expect(byId.get(itemSuccess.id)?.state).toBe("CANCELLED");
      expect(byId.get(itemFail.id)?.state).toBe("IN_DESIGN");

      const successTransitions = await testDb.workItemTransition.findMany({
        where: { workItemId: itemSuccess.id },
      });
      expect(successTransitions).toHaveLength(1);

      const failTransitions = await testDb.workItemTransition.findMany({
        where: { workItemId: itemFail.id },
      });
      expect(failTransitions).toHaveLength(0);
    } finally {
      blockedWorkItemId = null;
    }
  });
});

