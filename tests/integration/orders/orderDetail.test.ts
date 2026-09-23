// Integration test for getOrderDetail — tasks.md T024, US4.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getOrderDetail } from "~/server/orders";
import { transitionWorkItem, asUserId, asWorkItemId } from "~/server/core";
import type { Actor as CoreActor } from "~/server/core";
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
  userId: unique("test-detail-actor"),
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

describe("getOrderDetail (integration)", () => {
  it("returns a chronologically-ordered timeline covering every transition, including a cancellation, with nothing omitted", async () => {
    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({ data: { orderId: order.id, state: "NEW" } });

    const coreActor: CoreActor = { userId: asUserId(actor.userId), roles: [], departmentIds: [] };

    const r1 = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, { workItemId: asWorkItemId(workItem.id), to: "ASSIGNED", actor: coreActor }),
    );
    expect(r1.ok).toBe(true);

    const r2 = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, {
        workItemId: asWorkItemId(workItem.id),
        to: "CANCELLED",
        actor: coreActor,
        reason: "customer changed their mind",
      }),
    );
    expect(r2.ok).toBe(true);

    const detail = await getOrderDetail(actor, order.id);

    expect(detail.timeline).toHaveLength(2);
    expect(detail.timeline[0]?.to).toBe("ASSIGNED");
    expect(detail.timeline[1]?.to).toBe("CANCELLED");
    expect(detail.timeline[1]?.reason).toBe("customer changed their mind");
    expect(detail.timeline[0]!.at.getTime()).toBeLessThanOrEqual(detail.timeline[1]!.at.getTime());
    for (const entry of detail.timeline) {
      expect(entry.actorId).toBe(actor.userId);
    }
  });
});
