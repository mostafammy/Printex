// Integration test for assignDesigner (initial-assignment branch) and
// getEligibleDesigners — tasks.md T009, US1.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getEligibleDesigners, assignDesigner } from "~/server/designers";
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
  userId: unique("test-assign-actor"),
  roles: [],
  permissions: new Set<Permission>(["workitem.assign_designer"]),
  departmentIds: [],
};

let customerId: string;

async function createUser(idPrefix: string, name: string): Promise<string> {
  const id = unique(idPrefix);
  await testDb.user.create({
    data: { id, name, email: `${id}@local.invalid`, username: id, isActive: true, failedLoginAttempts: 0 },
  });
  return id;
}

async function grantDesignWork(userId: string): Promise<void> {
  await testDb.userPermission.create({
    data: { userId, permission: "design.work", grantedById: actor.userId },
  });
}

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
    data: { customerId, channel: "WALK_IN", priority: "NORMAL", mode: "SEPARATE", createdById: actor.userId },
  });
}

describe("assignDesigner + getEligibleDesigners (integration, US1)", () => {
  it("assignDesigner transitions a NEW Work Item to ASSIGNED, records a WorkItemTransition, and notifies the designer", async () => {
    const designerId = await createUser("test-assign-designer", "Designer One");
    await grantDesignWork(designerId);

    const order = await seedOrder();
    const workItem = await testDb.workItem.create({ data: { orderId: order.id, state: "NEW" } });

    await assignDesigner(actor, workItem.id, designerId);

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.state).toBe("ASSIGNED");
    expect(updated.assigneeId).toBe(designerId);

    const transitions = await testDb.workItemTransition.findMany({ where: { workItemId: workItem.id } });
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.from).toBe("NEW");
    expect(transitions[0]?.to).toBe("ASSIGNED");

    const notifications = await testDb.notificationEvent.findMany({
      where: { entityId: workItem.id, type: "workitem.assigned" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.recipientUserIds).toContain(designerId);

    const auditEvents = await testDb.auditEvent.findMany({
      where: { entityId: workItem.id, action: "workitem.assigned" },
    });
    expect(auditEvents).toHaveLength(1);
  });

  it("getEligibleDesigners returns only active design.work holders with correct workload/customer-history counts and exactly one isSuggested", async () => {
    const lightDesignerId = await createUser("test-assign-light", "Light Designer");
    const busyDesignerId = await createUser("test-assign-busy", "Busy Designer");
    const inactiveDesignerId = await createUser("test-assign-inactive", "Inactive Designer");
    await grantDesignWork(lightDesignerId);
    await grantDesignWork(busyDesignerId);
    await grantDesignWork(inactiveDesignerId);
    await testDb.user.update({ where: { id: inactiveDesignerId }, data: { isActive: false } });

    const order = await seedOrder();
    // Busy designer already has 2 non-terminal active Work Items.
    await testDb.workItem.create({ data: { orderId: order.id, state: "ASSIGNED", assigneeId: busyDesignerId } });
    await testDb.workItem.create({ data: { orderId: order.id, state: "IN_DESIGN", assigneeId: busyDesignerId } });
    // A past completed job for this same customer, done by the light designer.
    const pastOrder = await seedOrder();
    await testDb.workItem.create({
      data: { orderId: pastOrder.id, state: "DELIVERED", assigneeId: lightDesignerId },
    });

    const targetWorkItem = await testDb.workItem.create({ data: { orderId: order.id, state: "NEW" } });

    const eligible = await getEligibleDesigners(actor, targetWorkItem.id);

    const eligibleIds = eligible.map((d) => d.userId);
    expect(eligibleIds).toContain(lightDesignerId);
    expect(eligibleIds).toContain(busyDesignerId);
    expect(eligibleIds).not.toContain(inactiveDesignerId);

    const light = eligible.find((d) => d.userId === lightDesignerId);
    const busy = eligible.find((d) => d.userId === busyDesignerId);
    expect(light?.activeWorkItemCount).toBe(0);
    expect(busy?.activeWorkItemCount).toBe(2);
    expect(light?.pastJobsForCustomer).toBe(1);
    expect(busy?.pastJobsForCustomer).toBe(0);

    // The shared test DB holds other zero-load design.work holders (seed
    // admin, other test files), so assert the rule rather than a winner.
    const suggested = eligible.filter((d) => d.isSuggested);
    expect(suggested).toHaveLength(1);
    const minLoad = Math.min(...eligible.map((d) => d.activeWorkItemCount));
    expect(suggested[0]?.activeWorkItemCount).toBe(minLoad);
    expect(suggested[0]?.userId).not.toBe(busyDesignerId);
  });

  it("throws NOT_ASSIGNABLE for a Work Item in a non-assignable state", async () => {
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({ data: { orderId: order.id, state: "DELIVERED" } });

    await expect(getEligibleDesigners(actor, workItem.id)).rejects.toMatchObject({ code: "NOT_ASSIGNABLE" });
  });
});
