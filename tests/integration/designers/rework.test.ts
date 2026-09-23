// Integration test for the REWORK_REQUIRED re-entry path — tasks.md T036,
// US5. Covers US5 Acceptance Scenarios 1-2 (contracts/designer-assignment.md,
// FR-019/FR-020). Places a Work Item directly into REWORK_REQUIRED
// (simulating what 013's review feature will eventually do) via a
// WorkItemTransition row, matching quickstart.md Scenario 6's steps.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getMyQueue, startTimer, phaseDurations } from "~/server/designers";
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
  userId: unique("test-rework-designer"),
  roles: [],
  permissions: new Set<Permission>(["design.work"]),
  departmentIds: [],
};

let customerId: string;

beforeAll(async () => {
  await testDb.user.create({
    data: {
      id: designer.userId,
      name: "Test Designer",
      email: `${designer.userId}@local.invalid`,
      username: designer.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedReworkWorkItem() {
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: designer.userId,
    },
  });
  const workItem = await testDb.workItem.create({
    data: { orderId: order.id, state: "REWORK_REQUIRED", assigneeId: designer.userId },
  });
  // Prior recorded active time from the original (now-rejected) design pass —
  // proves T038's "accumulates on top of" requirement below, not a fresh phase.
  await testDb.phaseTiming.create({
    data: {
      workItemId: workItem.id,
      phase: "IN_DESIGN",
      kind: "ACTIVE",
      userId: designer.userId,
      startedAt: new Date(Date.now() - 60_000),
      endedAt: new Date(Date.now() - 30_000),
    },
  });
  // The WorkItemTransition landing in REWORK_REQUIRED that getMyQueue reads
  // rejectionDetails from (queue.ts) — simulates 013's rejection action.
  await testDb.workItemTransition.create({
    data: {
      workItemId: workItem.id,
      from: "WAITING_REVIEW",
      to: "REWORK_REQUIRED",
      actorId: designer.userId,
      reason: "Logo size does not match the brief",
      rejectionCategory: "DESIGN_ISSUE",
    },
  });
  await testDb.phaseTiming.create({
    data: { workItemId: workItem.id, phase: "REWORK_REQUIRED", kind: "QUEUE", startedAt: new Date() },
  });
  return workItem;
}

describe("US5: rework re-entry", () => {
  it("reappears in the designer's My queue with isRework and rejectionDetails populated (Acceptance Scenario 1)", async () => {
    const workItem = await seedReworkWorkItem();

    const rows = await getMyQueue(designer);
    const row = rows.find((r) => r.workItemId === workItem.id);

    expect(row).toBeDefined();
    expect(row?.state).toBe("REWORK_REQUIRED");
    expect(row?.isRework).toBe(true);
    expect(row?.rejectionDetails).toEqual({
      category: "DESIGN_ISSUE",
      explanation: "Logo size does not match the brief",
    });
  });

  it("starting the timer transitions to IN_DESIGN and accumulates on top of prior recorded active time, not resetting it (Acceptance Scenario 2)", async () => {
    const workItem = await seedReworkWorkItem();

    const before = await phaseDurations(designer, workItem.id);
    expect(before.activeTimeMs).toBeGreaterThan(0);

    await startTimer(designer, workItem.id);

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.state).toBe("IN_DESIGN");

    const openSegment = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItem.id, kind: "ACTIVE", endedAt: null },
    });
    expect(openSegment).not.toBeNull();

    const after = await phaseDurations(designer, workItem.id);
    // The new open segment adds on top of the prior closed one — never less
    // than what was already recorded before this rework pass started.
    expect(after.activeTimeMs).toBeGreaterThanOrEqual(before.activeTimeMs);
  });
});
