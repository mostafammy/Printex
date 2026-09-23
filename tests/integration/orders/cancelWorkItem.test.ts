// Integration test for cancelWorkItem — tasks.md T033, US6.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { cancelWorkItem, WorkItemTransitionError } from "~/server/orders";
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
  userId: unique("test-cancel-wi-actor"),
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

async function seedOrder() {
  return testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: actor.userId,
    },
  });
}

describe("cancelWorkItem (integration)", () => {
  it("rejects a non-empty reason requirement before any write (empty/whitespace reason)", async () => {
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({ data: { orderId: order.id, state: "NEW" } });

    await expect(cancelWorkItem(actor, workItem.id, "   ")).rejects.toBeTruthy();

    const unchanged = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(unchanged.state).toBe("NEW");
  });

  it("transitions a non-terminal Work Item to CANCELLED with exactly one transition/audit entry", async () => {
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({ data: { orderId: order.id, state: "NEW" } });

    await cancelWorkItem(actor, workItem.id, "customer cancelled the job");

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.state).toBe("CANCELLED");

    const transitions = await testDb.workItemTransition.findMany({ where: { workItemId: workItem.id } });
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.reason).toBe("customer cancelled the job");
  });

  it("refuses to cancel a Work Item already in a terminal state", async () => {
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({ data: { orderId: order.id, state: "DELIVERED" } });

    await expect(cancelWorkItem(actor, workItem.id, "too late")).rejects.toBeInstanceOf(
      WorkItemTransitionError,
    );
  });
});
