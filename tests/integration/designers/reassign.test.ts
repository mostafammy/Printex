// Integration test for assignDesigner's reassignment branch — tasks.md
// T015, US2 Acceptance Scenarios 1-3.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { assignDesigner, DomainDesignerError } from "~/server/designers";
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
  userId: unique("test-reassign-actor"),
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

describe("assignDesigner reassignment branch (integration, US2)", () => {
  it("throws REASON_REQUIRED when reassigning without a (non-empty) reason, and leaves assigneeId unchanged", async () => {
    const designerA = await createUser("test-reassign-a", "Designer A");
    const designerB = await createUser("test-reassign-b", "Designer B");
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "ASSIGNED", assigneeId: designerA },
    });

    await expect(assignDesigner(actor, workItem.id, designerB)).rejects.toMatchObject({
      code: "REASON_REQUIRED",
    });
    await expect(assignDesigner(actor, workItem.id, designerB, "   ")).rejects.toBeInstanceOf(
      DomainDesignerError,
    );

    const unchanged = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(unchanged.assigneeId).toBe(designerA);
  });

  it("updates assigneeId directly (no transitionWorkItem call — state unchanged) and records audit.record with before/after/reason", async () => {
    const designerA = await createUser("test-reassign-c", "Designer C");
    const designerB = await createUser("test-reassign-d", "Designer D");
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "ASSIGNED", assigneeId: designerA },
    });

    await assignDesigner(actor, workItem.id, designerB, "workload rebalance");

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.assigneeId).toBe(designerB);
    expect(updated.state).toBe("ASSIGNED"); // unchanged by reassignment

    const transitions = await testDb.workItemTransition.findMany({ where: { workItemId: workItem.id } });
    expect(transitions).toHaveLength(0); // no transitionWorkItem call on reassignment

    const auditEvents = await testDb.auditEvent.findMany({
      where: { entityId: workItem.id, action: "workitem.reassigned" },
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]?.reason).toBe("workload rebalance");
    expect(auditEvents[0]?.before).toMatchObject({ assigneeId: designerA });
    expect(auditEvents[0]?.after).toMatchObject({ assigneeId: designerB });

    const notifications = await testDb.notificationEvent.findMany({
      where: { entityId: workItem.id, type: "workitem.assigned" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.recipientUserIds).toContain(designerB);
  });

  it("closes an open ACTIVE PhaseTiming segment when reassigning an IN_DESIGN Work Item, preserving the previous designer's recorded time", async () => {
    const designerA = await createUser("test-reassign-e", "Designer E");
    const designerB = await createUser("test-reassign-f", "Designer F");
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "IN_DESIGN", assigneeId: designerA },
    });

    const startedAt = new Date(Date.now() - 60_000);
    const segment = await testDb.phaseTiming.create({
      data: {
        workItemId: workItem.id,
        phase: "IN_DESIGN",
        kind: "ACTIVE",
        userId: designerA,
        startedAt,
        endedAt: null,
      },
    });

    await assignDesigner(actor, workItem.id, designerB, "designer unavailable");

    const closedSegment = await testDb.phaseTiming.findUniqueOrThrow({ where: { id: segment.id } });
    expect(closedSegment.endedAt).not.toBeNull();
    // Previous designer's recorded time is preserved, not deleted or reattributed.
    expect(closedSegment.userId).toBe(designerA);
    expect(closedSegment.startedAt.getTime()).toBe(startedAt.getTime());

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.assigneeId).toBe(designerB);
    expect(updated.state).toBe("IN_DESIGN");
  });

  it("is a no-op on PhaseTiming when reassigning a Work Item with no open ACTIVE segment", async () => {
    const designerA = await createUser("test-reassign-g", "Designer G");
    const designerB = await createUser("test-reassign-h", "Designer H");
    const order = await seedOrder();
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "ASSIGNED", assigneeId: designerA },
    });

    await assignDesigner(actor, workItem.id, designerB, "reassign, never started");

    const segments = await testDb.phaseTiming.findMany({ where: { workItemId: workItem.id } });
    expect(segments).toHaveLength(0);
  });
});
