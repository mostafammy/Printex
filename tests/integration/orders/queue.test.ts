// Integration test for listReceptionQueue — tasks.md T020, US3.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { listReceptionQueue } from "~/server/orders";
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
  userId: unique("test-queue-actor"),
  roles: [],
  permissions: new Set<Permission>(),
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

async function seedOrderWithWorkItem(opts: {
  priority: "NORMAL" | "URGENT";
  complete: boolean;
  createdAt?: Date;
}) {
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: opts.priority,
      mode: "SEPARATE",
      createdById: actor.userId,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
  await testDb.workItem.create({
    data: opts.complete
      ? {
          orderId: order.id,
          state: "NEW",
          quantity: 1,
          widthValue: 1,
          heightValue: 1,
          dimensionUnit: "CM",
          departmentId: (await testDb.department.create({ data: { name: unique("QueueDept") } })).id,
        }
      : { orderId: order.id, state: "NEW", description: "incomplete item" },
  });
  return order.id;
}

describe("listReceptionQueue (integration)", () => {
  it("sorts urgent orders first, then the rest oldest-first, and flags incomplete orders", async () => {
    const old = new Date(Date.now() - 60_000);
    const older = new Date(Date.now() - 120_000);

    const normalOld = await seedOrderWithWorkItem({ priority: "NORMAL", complete: false, createdAt: old });
    const normalOlder = await seedOrderWithWorkItem({ priority: "NORMAL", complete: true, createdAt: older });
    const urgent = await seedOrderWithWorkItem({ priority: "URGENT", complete: false });

    const rows = await listReceptionQueue(actor);
    const ids = [urgent, normalOld, normalOlder];
    const [posUrgent, posNormalOld, posNormalOlder] = ids.map(
      (id) => rows.findIndex((r) => r.orderId === id),
    ) as [number, number, number];

    // Urgent must come before both normals; normalOlder (created earlier)
    // must come before normalOld among the NORMAL bucket.
    expect(posUrgent).toBeLessThan(posNormalOld);
    expect(posUrgent).toBeLessThan(posNormalOlder);
    expect(posNormalOlder).toBeLessThan(posNormalOld);

    const urgentRow = rows.find((r) => r.orderId === urgent);
    expect(urgentRow?.isComplete).toBe(false);

    const completeRow = rows.find((r) => r.orderId === normalOlder);
    expect(completeRow?.isComplete).toBe(true);
  });

  it("returns correctly when no delayed-Work-Item signal is supplied (053 optional)", async () => {
    const rows = await listReceptionQueue(actor);
    expect(rows.every((r) => r.delayed === false)).toBe(true);
  });
});
