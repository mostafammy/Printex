// Integration test for startProduction/pauseProduction/resumeProduction —
// specs/014-production/tasks.md T017 (US3). Covers starting a timer, pausing,
// resuming, multiple ACTIVE PhaseTiming segments, summed duration calculation,
// independence from paused gap duration, refusing resume on pending file
// revision (FR-013), and safe no-op pausing.
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  startProduction,
  pauseProduction,
  resumeProduction,
  acknowledgeFileRevision,
} from "~/server/production/timer";
import { calculatePhaseDurationMs } from "~/server/core";
import type { Actor, Permission } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

let customerId: string;
let department: { id: string };

function actorFor(departmentIds: string[]): Actor {
  return {
    userId: unique("test-integration-timer-actor"),
    roles: [],
    permissions: new Set<Permission>(["production.operate"]),
    departmentIds,
  };
}

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  department = await testDb.department.create({ data: { name: unique("Dept-Production") } });
});

async function seedActorUser(actor: Actor) {
  await testDb.user.create({
    data: {
      id: actor.userId,
      name: "Test Operator",
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
}

async function seedReadyWorkItem(actor: Actor, deptId: string = department.id) {
  const order = await testDb.order.create({
    data: {
      number: Number(process.hrtime.bigint() % 1_000_000_000n),
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: actor.userId,
    },
  });
  return testDb.workItem.create({
    data: {
      orderId: order.id,
      state: "READY_FOR_PRODUCTION",
      departmentId: deptId,
    },
  });
}

describe("startProduction, pauseProduction, resumeProduction (integration, US3)", () => {
  it("records multiple ACTIVE segments across pause and resume, with total active duration matching the sum of active intervals and independent of the paused gap", async () => {
    const actor = actorFor([department.id]);
    await seedActorUser(actor);

    const workItem = await seedReadyWorkItem(actor);

    // 1. Start production: transitions to IN_PRODUCTION and opens segment 1
    await startProduction(actor, workItem.id);

    const afterStart = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(afterStart?.state).toBe("IN_PRODUCTION");

    const firstOpen = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItem.id, phase: "IN_PRODUCTION", kind: "ACTIVE", endedAt: null },
    });
    expect(firstOpen).not.toBeNull();
    expect(firstOpen?.userId).toBe(actor.userId);

    // Simulate 20 minutes (1,200,000 ms) of active work for segment 1:
    // 08:00 -> 08:20
    const seg1Start = new Date("2026-09-01T08:00:00.000Z");
    const seg1End = new Date("2026-09-01T08:20:00.000Z");
    await testDb.phaseTiming.update({
      where: { id: firstOpen!.id },
      data: { startedAt: seg1Start },
    });

    // 2. Pause production: closes segment 1
    await pauseProduction(actor, workItem.id);

    // Pin endedAt to 08:20 for exact duration assertion
    await testDb.phaseTiming.update({
      where: { id: firstOpen!.id },
      data: { endedAt: seg1End },
    });

    const seg1 = await testDb.phaseTiming.findUnique({ where: { id: firstOpen!.id } });
    expect(seg1?.endedAt).toEqual(seg1End);

    // State remains IN_PRODUCTION
    const afterPause = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(afterPause?.state).toBe("IN_PRODUCTION");

    // 3. Resume production after a 2-hour paused gap:
    // Gap: 08:20 -> 10:20 (120 minutes)
    // Segment 2 active: 10:20 -> 10:35 (15 minutes, 900,000 ms)
    const seg2Start = new Date("2026-09-01T10:20:00.000Z");
    const seg2End = new Date("2026-09-01T10:35:00.000Z");

    await resumeProduction(actor, workItem.id);

    const secondOpen = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItem.id, phase: "IN_PRODUCTION", kind: "ACTIVE", endedAt: null },
    });
    expect(secondOpen).not.toBeNull();
    expect(secondOpen?.id).not.toBe(firstOpen?.id);
    expect(secondOpen?.userId).toBe(actor.userId);

    await testDb.phaseTiming.update({
      where: { id: secondOpen!.id },
      data: { startedAt: seg2Start },
    });

    // 4. Pause production again: closes segment 2
    await pauseProduction(actor, workItem.id);

    // Pin endedAt to 10:35
    await testDb.phaseTiming.update({
      where: { id: secondOpen!.id },
      data: { endedAt: seg2End },
    });

    // Retrieve both ACTIVE PhaseTiming segments
    const activeSegments = await testDb.phaseTiming.findMany({
      where: { workItemId: workItem.id, phase: "IN_PRODUCTION", kind: "ACTIVE" },
      orderBy: { startedAt: "asc" },
    });
    expect(activeSegments).toHaveLength(2);
    expect(activeSegments[0]?.endedAt).toEqual(seg1End);
    expect(activeSegments[1]?.endedAt).toEqual(seg2End);

    // Verify individual segment durations
    const dur1 = activeSegments[0]!.endedAt!.getTime() - activeSegments[0]!.startedAt.getTime();
    const dur2 = activeSegments[1]!.endedAt!.getTime() - activeSegments[1]!.startedAt.getTime();
    expect(dur1).toBe(20 * 60 * 1000); // 20 minutes
    expect(dur2).toBe(15 * 60 * 1000); // 15 minutes

    const totalActiveDurationMs = dur1 + dur2;
    expect(totalActiveDurationMs).toBe(35 * 60 * 1000); // 35 minutes

    // Summed active duration calculated via core helper
    const calculatedDurationMs = calculatePhaseDurationMs(activeSegments);
    expect(calculatedDurationMs).toBe(totalActiveDurationMs);

    // Independence of paused gap:
    // Wall-clock time spans 155 minutes (08:00 to 10:35)
    // Paused gap is 120 minutes (08:20 to 10:20)
    const pauseGapMs = activeSegments[1]!.startedAt.getTime() - activeSegments[0]!.endedAt!.getTime();
    const wallClockSpanMs = activeSegments[1]!.endedAt!.getTime() - activeSegments[0]!.startedAt.getTime();

    expect(pauseGapMs).toBe(120 * 60 * 1000);
    expect(wallClockSpanMs).toBe(155 * 60 * 1000);
    expect(wallClockSpanMs).toBe(totalActiveDurationMs + pauseGapMs);
    expect(calculatedDurationMs).not.toBe(wallClockSpanMs);
    expect(calculatedDurationMs).toBe(totalActiveDurationMs);

    // Verify audit log entries for all lifecycle events
    const startedAudit = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItem.id, action: "workitem.production_started" },
    });
    expect(startedAudit).not.toBeNull();
    expect(startedAudit?.actorId).toBe(actor.userId);

    const pausedAudits = await testDb.auditEvent.findMany({
      where: { entityType: "WorkItem", entityId: workItem.id, action: "workitem.production_paused" },
    });
    expect(pausedAudits).toHaveLength(2);

    const resumedAudit = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItem.id, action: "workitem.production_resumed" },
    });
    expect(resumedAudit).not.toBeNull();
    expect(resumedAudit?.actorId).toBe(actor.userId);
  });

  it("refuses resumeProduction with PENDING_FILE_REVISION when WorkItem.pendingFileRevisionAt is non-null (FR-013)", async () => {
    const actor = actorFor([department.id]);
    await seedActorUser(actor);

    const workItem = await seedReadyWorkItem(actor);
    await startProduction(actor, workItem.id);
    await pauseProduction(actor, workItem.id);

    // Simulate arrival of a newer approved file revision while production is paused
    const revisionTimestamp = new Date();
    await testDb.workItem.update({
      where: { id: workItem.id },
      data: { pendingFileRevisionAt: revisionTimestamp },
    });

    // resumeProduction must refuse with PENDING_FILE_REVISION
    await expect(resumeProduction(actor, workItem.id)).rejects.toMatchObject({
      code: "PENDING_FILE_REVISION",
    });

    // Confirm no new open ACTIVE segment was created
    const openSegment = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItem.id, phase: "IN_PRODUCTION", kind: "ACTIVE", endedAt: null },
    });
    expect(openSegment).toBeNull();

    // Acknowledging the file revision clears pendingFileRevisionAt
    await acknowledgeFileRevision(actor, workItem.id);

    const refreshed = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(refreshed?.pendingFileRevisionAt).toBeNull();

    // After acknowledgment, resumeProduction succeeds
    await resumeProduction(actor, workItem.id);

    const resumedSegment = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItem.id, phase: "IN_PRODUCTION", kind: "ACTIVE", endedAt: null },
    });
    expect(resumedSegment).not.toBeNull();
    expect(resumedSegment?.userId).toBe(actor.userId);
  });

  it("treats pauseProduction as a safe no-op when there is no open ACTIVE segment to close", async () => {
    const actor = actorFor([department.id]);
    await seedActorUser(actor);

    const order = await testDb.order.create({
      data: {
        number: Number(process.hrtime.bigint() % 1_000_000_000n),
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "IN_PRODUCTION",
        departmentId: department.id,
      },
    });

    const countBefore = await testDb.phaseTiming.count({
      where: { workItemId: workItem.id, kind: "ACTIVE" },
    });
    expect(countBefore).toBe(0);

    // Safe no-op: does not throw, does not change state
    await expect(pauseProduction(actor, workItem.id)).resolves.toBeUndefined();

    const after = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(after?.state).toBe("IN_PRODUCTION");

    const countAfter = await testDb.phaseTiming.count({
      where: { workItemId: workItem.id, kind: "ACTIVE" },
    });
    expect(countAfter).toBe(0);
  });

  it("allows multiple consecutive pauseProduction calls without error", async () => {
    const actor = actorFor([department.id]);
    await seedActorUser(actor);

    const workItem = await seedReadyWorkItem(actor);
    await startProduction(actor, workItem.id);

    // First pause closes the open active segment
    await expect(pauseProduction(actor, workItem.id)).resolves.toBeUndefined();

    // Second pause is a safe no-op
    await expect(pauseProduction(actor, workItem.id)).resolves.toBeUndefined();

    const segments = await testDb.phaseTiming.findMany({
      where: { workItemId: workItem.id, kind: "ACTIVE" },
    });
    expect(segments).toHaveLength(1);
    expect(segments[0]?.endedAt).not.toBeNull();
  });

  it("falls back to ProductType.defaultDepartmentId when WorkItem.departmentId is null", async () => {
    const actor = actorFor([department.id]);
    await seedActorUser(actor);

    const productType = await testDb.productType.create({
      data: { name: unique("ProductType"), defaultDepartmentId: department.id },
    });

    const order = await testDb.order.create({
      data: {
        number: Number(process.hrtime.bigint() % 1_000_000_000n),
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "READY_FOR_PRODUCTION",
        productTypeId: productType.id,
        departmentId: null,
      },
    });

    // Department resolved via ProductType.defaultDepartmentId allows actor to start production
    await expect(startProduction(actor, workItem.id)).resolves.toBeUndefined();

    const updated = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(updated?.state).toBe("IN_PRODUCTION");
  });
});
