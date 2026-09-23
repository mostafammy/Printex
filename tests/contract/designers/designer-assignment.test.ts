// Contract tests for src/server/designers/** — tasks.md T021 (US3 slice).
// Asserts contracts/designer-assignment.md's frozen shapes and Authorization
// table for getMyQueue/startTimer/pauseTimer/phaseDurations. Other rows of
// the Authorization table (getEligibleDesigners, assignDesigner,
// uploadDesignVersion, markDesignComplete, getDesignerWorkload) belong to
// other tasks/phases and are covered by their own test files.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getMyQueue, startTimer, pauseTimer, phaseDurations } from "~/server/designers";
import { ForbiddenError } from "~/server/auth/authorize";
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
  userId: unique("test-contract-designer"),
  roles: [],
  permissions: new Set<Permission>(["design.work"]),
  departmentIds: [],
};

const noPermissionActor: Actor = {
  userId: unique("test-contract-no-permission"),
  roles: [],
  permissions: new Set<Permission>(),
  departmentIds: [],
};

let customerId: string;

beforeAll(async () => {
  await testDb.user.createMany({
    data: [designer, noPermissionActor].map((actor) => ({
      id: actor.userId,
      name: "Test Actor",
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
      priority: "URGENT",
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
  return { orderId: order.id, workItemId: workItem.id };
}

describe("designer-assignment contract: getMyQueue", () => {
  it("requires no permission beyond an authenticated actor, and scopes rows to actor.userId", async () => {
    const { workItemId } = await seedAssignedWorkItem(designer.userId);

    // No permission at all — still resolves, because getMyQueue has no
    // authorize() gate (contracts/designer-assignment.md's Authorization
    // table: "none (authenticated only)").
    const rows = await getMyQueue(noPermissionActor);
    expect(rows.find((r) => r.workItemId === workItemId)).toBeUndefined();

    const ownRows = await getMyQueue(designer);
    const row = ownRows.find((r) => r.workItemId === workItemId);
    expect(row).toBeDefined();
    expect(row?.state).toBe("ASSIGNED");
    expect(row?.isRework).toBe(false);
    expect(row?.rejectionDetails).toBeNull();
    expect(row?.hasOpenTimer).toBe(false);
    expect(row?.priority).toBe("URGENT");
  });
});

describe("designer-assignment contract: startTimer / pauseTimer", () => {
  it("requires design.work — FORBIDDEN without it", async () => {
    const { workItemId } = await seedAssignedWorkItem(noPermissionActor.userId);

    await expect(startTimer(noPermissionActor, workItemId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(pauseTimer(noPermissionActor, workItemId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("succeeds for the assignee holding design.work", async () => {
    const { workItemId } = await seedAssignedWorkItem(designer.userId);

    await expect(startTimer(designer, workItemId)).resolves.toBeUndefined();
    await expect(pauseTimer(designer, workItemId)).resolves.toBeUndefined();
  });
});

describe("designer-assignment contract: phaseDurations", () => {
  it("requires no permission beyond an authenticated actor, and matches the frozen PhaseDurations shape", async () => {
    const { workItemId } = await seedAssignedWorkItem(designer.userId);

    const durations = await phaseDurations(noPermissionActor, workItemId);
    expect(durations).toEqual(
      expect.objectContaining({
        queueTimeMs: expect.any(Number),
        activeTimeMs: expect.any(Number),
        totalPhaseDurationMs: null,
      }),
    );
  });
});
