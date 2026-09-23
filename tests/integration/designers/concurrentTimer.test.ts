// Integration test for the "one active timer per designer" rule and the
// NOT_ASSIGNEE guard — tasks.md T020, US3. Covers FR-012/FR-013, US3
// Acceptance Scenario 5 (contracts/designer-assignment.md).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { startTimer, pauseTimer, DomainDesignerError } from "~/server/designers";
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

const designer: Actor = {
  userId: unique("test-concurrent-designer"),
  roles: [],
  permissions: new Set<Permission>(["design.work"]),
  departmentIds: [],
};

const otherDesigner: Actor = {
  userId: unique("test-concurrent-other-designer"),
  roles: [],
  permissions: new Set<Permission>(["design.work"]),
  departmentIds: [],
};

let customerId: string;

beforeAll(async () => {
  await testDb.user.createMany({
    data: [designer, otherDesigner].map((actor) => ({
      id: actor.userId,
      name: "Test Designer",
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    })),
  });
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedAssignedWorkItem(assigneeId: string) {
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: assigneeId,
    },
  });
  const workItem = await testDb.workItem.create({
    data: { orderId: order.id, state: "ASSIGNED", assigneeId },
  });
  await testDb.phaseTiming.create({
    data: { workItemId: workItem.id, phase: "ASSIGNED", kind: "QUEUE", startedAt: new Date() },
  });
  return workItem.id;
}

describe("startTimer concurrency + assignee guards (integration)", () => {
  it("starting a timer on Work Item Y while the designer has an open ACTIVE segment on X auto-closes X first", async () => {
    const workItemX = await seedAssignedWorkItem(designer.userId);
    const workItemY = await seedAssignedWorkItem(designer.userId);

    await startTimer(designer, workItemX);
    const xOpenBefore = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItemX, kind: "ACTIVE", endedAt: null },
    });
    expect(xOpenBefore).not.toBeNull();

    await startTimer(designer, workItemY);

    const xOpenAfter = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItemX, kind: "ACTIVE", endedAt: null },
    });
    expect(xOpenAfter).toBeNull();

    const yOpenAfter = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItemY, kind: "ACTIVE", endedAt: null },
    });
    expect(yOpenAfter).not.toBeNull();

    // Only one open ACTIVE segment exists for this designer at any time.
    const allOpenForDesigner = await testDb.phaseTiming.findMany({
      where: { userId: designer.userId, kind: "ACTIVE", endedAt: null },
    });
    expect(allOpenForDesigner).toHaveLength(1);
  });

  it("starting a timer as a user who is not the Work Item's assignee throws DomainDesignerError(NOT_ASSIGNEE)", async () => {
    const workItemId = await seedAssignedWorkItem(designer.userId);

    await expect(startTimer(otherDesigner, workItemId)).rejects.toMatchObject({
      code: "NOT_ASSIGNEE",
    });
    await expect(startTimer(otherDesigner, workItemId)).rejects.toBeInstanceOf(DomainDesignerError);
  });

  it("pausing a timer as a user who is not the Work Item's assignee throws DomainDesignerError(NOT_ASSIGNEE)", async () => {
    const workItemId = await seedAssignedWorkItem(designer.userId);
    await startTimer(designer, workItemId);

    await expect(pauseTimer(otherDesigner, workItemId)).rejects.toMatchObject({
      code: "NOT_ASSIGNEE",
    });
  });
});
