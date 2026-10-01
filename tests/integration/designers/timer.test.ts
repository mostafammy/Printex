// Integration test for startTimer/pauseTimer/phaseDurations — tasks.md T019,
// US3. Covers US3 Acceptance Scenarios 1-4 (contracts/designer-assignment.md).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { startTimer, pauseTimer, phaseDurations } from "~/server/designers";
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
  userId: unique("test-timer-designer"),
  roles: [],
  permissions: new Set<Permission>(["design.work"]),
  departmentIds: [],
};

const admin: Actor = {
  userId: unique("test-timer-admin"),
  roles: ["ADMIN_OWNER"],
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
  await testDb.user.create({
    data: {
      id: admin.userId,
      name: "Test Admin",
      email: `${admin.userId}@local.invalid`,
      username: admin.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedAssignedWorkItem() {
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
    data: { orderId: order.id, state: "ASSIGNED", assigneeId: designer.userId },
  });
  // Mirror transitionWorkItem's own bookkeeping: a QUEUE segment for the
  // ASSIGNED phase, matching what a real assignDesigner() call would have
  // opened (research.md §2).
  await testDb.phaseTiming.create({
    data: { workItemId: workItem.id, phase: "ASSIGNED", kind: "QUEUE", startedAt: new Date() },
  });
  return workItem.id;
}

describe("startTimer/pauseTimer/phaseDurations (integration)", () => {
  it("startTimer on an ASSIGNED Work Item transitions it to IN_DESIGN and opens an ACTIVE segment", async () => {
    const workItemId = await seedAssignedWorkItem();

    await startTimer(designer, workItemId);

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("IN_DESIGN");

    const openActive = await testDb.phaseTiming.findFirst({
      where: { workItemId, kind: "ACTIVE", endedAt: null },
    });
    expect(openActive).not.toBeNull();
    expect(openActive?.userId).toBe(designer.userId);

    // The outgoing ASSIGNED-phase QUEUE segment must be closed by
    // transitionWorkItem's own step 5 — not left open (FR-014).
    const openAssignedQueue = await testDb.phaseTiming.findFirst({
      where: { workItemId, phase: "ASSIGNED", kind: "QUEUE", endedAt: null },
    });
    expect(openAssignedQueue).toBeNull();
  });

  it("pauseTimer closes the open ACTIVE segment without changing state", async () => {
    const workItemId = await seedAssignedWorkItem();
    await startTimer(designer, workItemId);

    await pauseTimer(designer, workItemId);

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("IN_DESIGN");

    const openActive = await testDb.phaseTiming.findFirst({
      where: { workItemId, kind: "ACTIVE", endedAt: null },
    });
    expect(openActive).toBeNull();
  });

  it("a second startTimer (resume) opens a new ACTIVE segment without a redundant transition", async () => {
    const workItemId = await seedAssignedWorkItem();
    await startTimer(designer, workItemId);
    await pauseTimer(designer, workItemId);

    await startTimer(designer, workItemId);

    const segments = await testDb.phaseTiming.findMany({
      where: { workItemId, kind: "ACTIVE" },
      orderBy: { startedAt: "asc" },
    });
    expect(segments).toHaveLength(2);
    expect(segments[1]?.endedAt).toBeNull();

    const transitions = await testDb.workItemTransition.findMany({ where: { workItemId } });
    // Exactly one ASSIGNED -> IN_DESIGN transition, not two (the second
    // startTimer call is a resume, not a redundant transition).
    expect(transitions.filter((t) => t.to === "IN_DESIGN")).toHaveLength(1);
  });

  it("phaseDurations re-derives identical durations from persisted timestamps across two independent reads ('restart')", async () => {
    const workItemId = await seedAssignedWorkItem();
    await startTimer(designer, workItemId);
    await pauseTimer(designer, workItemId);

    // No segment is open at this point, so both reads are fully determined
    // by closed segments' timestamps — no wall-clock flakiness (SC-004).
    const first = await phaseDurations(designer, workItemId);
    const second = await phaseDurations(designer, workItemId);

    expect(second).toEqual(first);
    expect(first.activeTimeMs).toBeGreaterThanOrEqual(0);
    expect(first.queueTimeMs).toBeGreaterThanOrEqual(0);
    expect(first.totalPhaseDurationMs).toBeNull(); // not yet DESIGN_COMPLETED
  });

  it("admin override starts anyone's timer when a design file exists", async () => {
    const workItemId = await seedAssignedWorkItem();
    await testDb.designVersion.create({
      data: {
        workItemId,
        version: 1,
        storageKey: unique("storage-key"),
        fileName: "source.png",
        sizeBytes: 1,
        sha256: unique("sha"),
        uploadedById: designer.userId,
      },
    });

    await startTimer(admin, workItemId);

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("IN_DESIGN");
  });

  it("admin override starts work with no design file attached", async () => {
    // Starting work must NOT require a finished design file: a designer opens
    // the item to BEGIN the design, so demanding the output up front blocks the
    // first step of the pipeline. The file requirement belongs to the transition
    // INTO DESIGN_COMPLETED (guards.ts, DESIGN_FILE_REQUIRED), which is what
    // refuses "تعذّر النقل: يجب رفع ملف التصميم قبل إنهاء مرحلة التصميم".
    const workItemId = await seedAssignedWorkItem();

    await startTimer(admin, workItemId);

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("IN_DESIGN");
  });

  it("admin override pauses anyone's open timer", async () => {
    const workItemId = await seedAssignedWorkItem();
    await startTimer(designer, workItemId);

    await pauseTimer(admin, workItemId);

    const openActive = await testDb.phaseTiming.findFirst({
      where: { workItemId, kind: "ACTIVE", endedAt: null },
    });
    expect(openActive).toBeNull();
  });
});
