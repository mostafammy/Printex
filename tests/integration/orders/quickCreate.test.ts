// Integration test for quickCreateOrder — tasks.md T011, US1.
//
// Covers quickCreateOrder against a REAL Postgres test database
// (DATABASE_URL_TEST — research.md §9). `~/server/orders` writes through
// `~/server/db`'s `db`, which points at the same instance as `testDb` in
// this environment (see tests/helpers/testDb.ts) — the same pattern used by
// tests/integration/admin-departments.test.ts.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { quickCreateOrder, isOrderComplete } from "~/server/orders";
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
  userId: unique("test-reception-quickcreate"),
  roles: [],
  permissions: new Set<Permission>(["order.create"]),
  departmentIds: [],
};

let customerId: string;

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
});

describe("quickCreateOrder (integration)", () => {
  it("creates one Order (autoincremented number) and one NEW WorkItem, records both audit events, and the result is flagged incomplete", async () => {
    const { orderId, orderNumber, workItemId } = await quickCreateOrder(receptionActor, {
      customerId,
      description: "Walk-in: 100 flyers, needs quote",
      priority: "NORMAL",
    });

    expect(typeof orderNumber).toBe("number");

    const order = await testDb.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.number).toBe(orderNumber);
    expect(order.channel).toBe("WALK_IN");
    expect(order.mode).toBe("SEPARATE");

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("NEW");
    expect(workItem.description).toBe("Walk-in: 100 flyers, needs quote");
    expect(workItem.requiresDesign).toBe(true);
    expect(workItem.requiresReview).toBe(true);

    const events = await testDb.auditEvent.findMany({
      where: { entityId: { in: [orderId, workItemId] } },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => e.action)).toEqual(["order.created", "workitem.created"]);

    expect(
      isOrderComplete({
        workItems: [
          {
            productTypeId: workItem.productTypeId,
            quantity: workItem.quantity,
            widthValue: workItem.widthValue,
            heightValue: workItem.heightValue,
            dimensionUnit: workItem.dimensionUnit,
            departmentId: workItem.departmentId,
          },
        ],
      }),
    ).toBe(false);
  });

  it("defaults channel to WALK_IN when omitted", async () => {
    const { orderId } = await quickCreateOrder(receptionActor, {
      customerId,
      description: "Phone call, no channel specified",
      priority: "URGENT",
    });
    const order = await testDb.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.channel).toBe("WALK_IN");
    expect(order.priority).toBe("URGENT");
  });
});
