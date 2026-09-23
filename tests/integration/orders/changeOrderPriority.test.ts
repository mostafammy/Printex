// Integration test for changeOrderPriority — tasks.md T020a, US3
// Acceptance Scenario 3, analyze-pass finding C1.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { changeOrderPriority, listReceptionQueue } from "~/server/orders";
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
  userId: unique("test-priority-actor"),
  roles: [],
  permissions: new Set<Permission>(["order.edit"]),
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

async function seedNormalOrder() {
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: actor.userId,
    },
  });
  await testDb.workItem.create({ data: { orderId: order.id, state: "NEW" } });
  return order.id;
}

describe("changeOrderPriority (integration)", () => {
  it("updates Order.priority, records one audit event with before/after, and reorders the queue", async () => {
    const orderId = await seedNormalOrder();
    const other = await seedNormalOrder();

    await changeOrderPriority(actor, orderId, "URGENT");

    const order = await testDb.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.priority).toBe("URGENT");

    const events = await testDb.auditEvent.findMany({
      where: { entityId: orderId, action: "order.priority_changed" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.before).toEqual({ priority: "NORMAL" });
    expect(events[0]?.after).toEqual({ priority: "URGENT" });

    const rows = await listReceptionQueue(actor);
    const [posOrder, posOther] = [orderId, other].map((id) => rows.findIndex((r) => r.orderId === id)) as [
      number,
      number,
    ];
    expect(posOrder).toBeLessThan(posOther);
  });

  it("is a no-op (no write, no audit) when setting the same priority again", async () => {
    const orderId = await seedNormalOrder();
    await changeOrderPriority(actor, orderId, "URGENT");

    const before = await testDb.auditEvent.count({
      where: { entityId: orderId, action: "order.priority_changed" },
    });

    await changeOrderPriority(actor, orderId, "URGENT");

    const after = await testDb.auditEvent.count({
      where: { entityId: orderId, action: "order.priority_changed" },
    });
    expect(after).toBe(before);
  });
});
