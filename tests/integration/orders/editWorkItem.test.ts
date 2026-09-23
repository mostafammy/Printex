// Integration test for editWorkItem — tasks.md T043, US8.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { editWorkItem } from "~/server/orders";
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
  userId: unique("test-edit-wi-actor"),
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

describe("editWorkItem (integration)", () => {
  it("succeeds on a NEW/ASSIGNED Work Item's quantity/dimensions/material/notes with a before/after audit entry", async () => {
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "ASSIGNED", quantity: 5, material: "Vinyl" },
    });

    await editWorkItem(actor, workItem.id, { quantity: 20, material: "Coated paper" });

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.quantity).toBe(20);
    expect(updated.material).toBe("Coated paper");

    const events = await testDb.auditEvent.findMany({
      where: { entityId: workItem.id, action: "workitem.edited" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.before).toMatchObject({ quantity: 5, material: "Vinyl" });
    expect(events[0]?.after).toMatchObject({ quantity: 20, material: "Coated paper" });
  });

  it("refuses to edit a Work Item that has entered design or later with DomainOrderError(PAST_EDIT_WINDOW)", async () => {
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "IN_DESIGN", quantity: 5 },
    });

    await expect(editWorkItem(actor, workItem.id, { quantity: 99 })).rejects.toMatchObject({
      code: "PAST_EDIT_WINDOW",
    });

    const unchanged = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(unchanged.quantity).toBe(5);
  });
});
