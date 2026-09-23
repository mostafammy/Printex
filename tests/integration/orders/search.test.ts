// Integration test for searchOrders — tasks.md T029, US5.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { searchOrders } from "~/server/orders";
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
  userId: unique("test-search-actor"),
  roles: [],
  permissions: new Set<Permission>(),
  departmentIds: [],
};

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
});

describe("searchOrders (integration)", () => {
  it("exact orderNumber match returns exactly that order", async () => {
    const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
    const order = await testDb.order.create({
      data: {
        customerId: customer.id,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });

    const results = await searchOrders(actor, { orderNumber: order.number });
    expect(results).toHaveLength(1);
    expect(results[0]?.orderId).toBe(order.id);
  });

  it("partial customerName match (case-insensitive) returns all matches", async () => {
    const name = unique("Zebra Print Shop");
    const customer = await testDb.customer.create({ data: { name } });
    await testDb.order.create({
      data: {
        customerId: customer.id,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });

    const results = await searchOrders(actor, { customerName: name.slice(0, 5).toLowerCase() });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => r.customerName.toLowerCase().includes(name.slice(0, 5).toLowerCase()))).toBe(
      true,
    );
  });

  it("succeeds without a phone clause when Customer.phone does not exist in this schema (research.md §5's guard)", async () => {
    await expect(searchOrders(actor, { phone: "0100000000" })).resolves.toEqual([]);
  });
});
