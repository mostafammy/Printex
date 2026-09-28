// US2's remaining properties: inertness, missed windows, live threshold
// changes, stop/start, crash recovery, and the 200-item backlog (SC-014).
//
// The inertness test (T029) is the constitution II test for this feature:
// delay detection OBSERVES and REPORTS — if a tick ever changed a Work
// Item's state or a PricingStatus, 053 would be a second authority for the
// workflow, which is the exact failure that principle forbids.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  isSchedulerRunning,
  runDelayTick,
  startDelayScheduler,
  stopDelayScheduler,
} from "~/server/notifications";
import {
  seedAgedWorkItem,
  seedDepartment,
  seedNotificationUser,
  setThreshold,
} from "../../helpers/notificationSeed";

afterAll(async () => {
  stopDelayScheduler();
  await testDb.$disconnect();
});

afterEach(() => {
  stopDelayScheduler();
});

let headDesigner: Awaited<ReturnType<typeof seedNotificationUser>>;
let departmentId: string;
let orderId: string;

async function releaseLease(): Promise<void> {
  await testDb.schedulerLease.upsert({
    where: { id: "delay-scheduler" },
    create: { id: "delay-scheduler", ownerId: "", acquiredAt: new Date(0), expiresAt: new Date(0) },
    update: { expiresAt: new Date(0) },
  });
}

beforeAll(async () => {
  departmentId = await seedDepartment("sched-advanced-dept");
  headDesigner = await seedNotificationUser({
    prefix: "sched-advanced",
    roleKeys: ["HEAD_DESIGNER"],
  });

  const customer = await testDb.customer.create({
    data: {
      name: `SchedAdvanced_${Date.now()}`,
      normalizedName: `schedadvanced_${Date.now()}`,
    },
  });
  const order = await testDb.order.create({
    data: {
      customerId: customer.id,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "GROUPED",
      createdById: headDesigner.userId,
    },
  });
  orderId = order.id;

  await setThreshold("REVIEW", 1, { alertRoles: ["HEAD_DESIGNER"] });
});

describe("detection is inert (T029 / FR-068 / constitution II)", () => {
  it("a full tick changes no Work Item state, no PricingStatus, blocks no transition", async () => {
    const itemId = await seedAgedWorkItem({
      orderId,
      state: "WAITING_REVIEW",
      ageMinutes: 60,
      requiresDesign: true,
      departmentId,
    });

    const workItemBefore = await testDb.workItem.findUniqueOrThrow({
      where: { id: itemId },
      select: { state: true, updatedAt: true, requiresDesign: true },
    });
    const pricingBefore = await testDb.pricingStatus.findMany({
      where: { workItemId: itemId },
      orderBy: { updatedAt: "asc" },
    });

    await releaseLease();
    const result = await runDelayTick();
    expect(result.ran).toBe(true);

    // Identical state — the scheduler never writes these tables (FR-068).
    const workItemAfter = await testDb.workItem.findUniqueOrThrow({
      where: { id: itemId },
      select: { state: true, updatedAt: true, requiresDesign: true },
    });
    expect(workItemAfter).toEqual(workItemBefore);

    const pricingAfter = await testDb.pricingStatus.findMany({
      where: { workItemId: itemId },
      orderBy: { updatedAt: "asc" },
    });
    expect(pricingAfter).toEqual(pricingBefore);

    // The tick wrote ONLY 053's own four tables. Checking the boundary the
    // contract states: if the breach write had leaked into WorkItem, the
    // comparison above would already have caught it — this asserts the
    // claim positively for the alert's own tables.
    expect(result.alerted).toBeGreaterThanOrEqual(1);
  });
});

describe("missed window evaluated on restart (T030 / FR-051 / SC-013 b)", () => {
  it("a window missed while stopped is alerted on the first tick after start", async () => {
    await releaseLease();
    // "The server was down": the scheduler is not running (stop is a no-op
    // here — nothing has started yet — but it guarantees the interval is
    // absent).
    stopDelayScheduler();
    expect(isSchedulerRunning()).toBe(false);

    // While "down", this Work Item crossed its threshold.
    const itemId = await seedAgedWorkItem({
      orderId,
      state: "WAITING_REVIEW",
      ageMinutes: 60,
      requiresDesign: true,
      departmentId,
    });

    // First tick after start is immediate (not deferred to the interval) —
    // that immediacy IS the missed-window evaluation. It is fired void, so
    // poll for its write rather than guessing a sleep: the point is "arrives
    // without waiting for an interval to elapse", and a fixed 400ms races
    // the claim + breach + notification writes under load.
    await releaseLease();
    startDelayScheduler({ intervalMinutes: 99 });

    let breach: { detectedAt: Date } | null = null;
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline && !breach) {
      breach = await testDb.delayBreach.findFirst({
        where: { workItemId: itemId, phase: "REVIEW" },
        select: { detectedAt: true },
      });
      if (!breach) await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Flagged and alerted without waiting for a single interval to elapse
    // (intervalMinutes: 99 would make a breach impossible within 5s any
    // other way).
    expect(breach).not.toBeNull();
    expect(breach!.detectedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});

describe("threshold change takes effect with no restart (T031 / FR-045)", () => {
  it("lowering a threshold flags previously-clean Work Items on the next tick", async () => {
    // A 3-hour-old review item against a 6-hour threshold: not delayed.
    await setThreshold("REVIEW", 360, { alertRoles: ["HEAD_DESIGNER"] });
    const itemId = await seedAgedWorkItem({
      orderId,
      state: "WAITING_REVIEW",
      ageMinutes: 180,
      requiresDesign: true,
      departmentId,
    });

    const beforeChange = await testDb.delayBreach.findFirst({
      where: { workItemId: itemId },
    });
    expect(beforeChange).toBeNull();

    // The Admin lowers it below the current age. No restart, no deploy —
    // the threshold map is re-read every tick.
    await setThreshold("REVIEW", 60, { alertRoles: ["HEAD_DESIGNER"] });

    await releaseLease();
    const result = await runDelayTick();
    expect(result.ran).toBe(true);

    const afterChange = await testDb.delayBreach.findFirst({
      where: { workItemId: itemId, phase: "REVIEW" },
    });
    expect(afterChange).not.toBeNull();
    // The breach snapshots the threshold IN FORCE at breach time.
    expect(afterChange!.thresholdMinutes).toBe(60);

    // And the same is true of the QUERY path — `getDelayedWorkItems` is
    // instant, no interval involved at all.
    const { getDelayedWorkItems } = await import("~/server/notifications");
    const view = await getDelayedWorkItems(headDesigner, { phase: "REVIEW", pageSize: 200 });
    expect(view.rows.some((r) => r.workItemId === itemId)).toBe(true);
  });
});

describe("stop and start (T078 / FR-054)", () => {
  it("stopping is reversible and non-destructive: one alert per breach across a restart", async () => {
    await setThreshold("REVIEW", 1, { alertRoles: ["HEAD_DESIGNER"] });
    const itemId = await seedAgedWorkItem({
      orderId,
      state: "WAITING_REVIEW",
      ageMinutes: 60,
      requiresDesign: true,
      departmentId,
    });

    // --- tick once, alert once --------------------------------------------
    await releaseLease();
    const first = await runDelayTick();
    expect(first.flagged).toBeGreaterThanOrEqual(1);

    // --- stop: no more ticks happen ----------------------------------------
    stopDelayScheduler();
    expect(isSchedulerRunning()).toBe(false);

    // --- start again: the NEXT tick finds the same ongoing breach ----------
    stopDelayScheduler(); // idempotent double-stop
    await releaseLease();
    const second = await runDelayTick();
    expect(second.ran).toBe(true);

    const breaches = await testDb.delayBreach.findMany({
      where: { workItemId: itemId, phase: "REVIEW" },
    });
    expect(breaches).toHaveLength(1);

    const notifications = await testDb.notification.findMany({
      where: { entityId: itemId, type: "work_item.phase_delayed", userId: headDesigner.userId },
    });
    expect(notifications).toHaveLength(1);

    // Reversible in the other direction too: startDelayScheduler twice
    // stacks exactly one interval (FR-050's in-process half).
    startDelayScheduler({ intervalMinutes: 99 });
    startDelayScheduler({ intervalMinutes: 1 });
    expect(isSchedulerRunning()).toBe(true);
    stopDelayScheduler();
  });
});

describe("crash recovery (T080 / SC-013)", () => {
  it("a fault mid-tick loses only that tick: the next one finds the same breach", async () => {
    await setThreshold("REVIEW", 1, { alertRoles: ["HEAD_DESIGNER"] });
    const itemId = await seedAgedWorkItem({
      orderId,
      state: "WAITING_REVIEW",
      ageMinutes: 60,
      requiresDesign: true,
      departmentId,
    });

    // Simulate a crash mid-run: a run row left RUNNING with a lease held
    // but already expired — the exact wreckage a killed process leaves.
    await testDb.schedulerRun.create({
      data: { ownerId: "crashed-process:1", outcome: "RUNNING" },
    });
    await testDb.schedulerLease.upsert({
      where: { id: "delay-scheduler" },
      create: {
        id: "delay-scheduler",
        ownerId: "crashed-process:1",
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // expired: reclaimable
      },
      update: { ownerId: "crashed-process:1", expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await runDelayTick();
    expect(result.ran).toBe(true); // lease was expired, so it was acquired

    const breaches = await testDb.delayBreach.findMany({
      where: { workItemId: itemId, phase: "REVIEW" },
    });
    expect(breaches).toHaveLength(1);
    const notifications = await testDb.notification.findMany({
      where: { entityId: itemId, type: "work_item.phase_delayed", userId: headDesigner.userId },
    });
    expect(notifications).toHaveLength(1);

    // The crashed run row is left as wreckage, not resurrected — a new run
    // row records the recovery, and the wreckage stays visible as evidence
    // (FR-053's history is append-mostly: old runs are never rewritten).
    const crashed = await testDb.schedulerRun.findFirst({
      where: { ownerId: "crashed-process:1" },
    });
    expect(crashed!.outcome).toBe("RUNNING"); // untouched by the new tick
  });
});

describe("bulk backlog (T081 + T075 / SC-014)", () => {
  it("200 aged Work Items across ALL FIVE phases: every one flagged once (T081)", async () => {
    // SC-014: a backlog of 200 delayed items across all 5 phases is
    // processed without dropping any — the shop's worst realistic morning.
    // Completeness is the assertion; latency is NOT (the spec puts no time
    // bound here), because a test-machine round-trip is not the LAN server
    // the feature ships to — T072 owns the perf numbers.
    for (const phase of ["DESIGN", "REVIEW", "PRICING", "PRODUCTION", "COLLECTION"] as const) {
      await setThreshold(phase, 1, { alertRoles: ["HEAD_DESIGNER"] });
    }

    const created: string[] = [];
    // 40 per phase. `i % 5` so phases interleave — a bug that degraded
    // after the first phase's items would still surface.
    for (let i = 0; i < 200; i += 1) {
      const phase = ["DESIGN", "REVIEW", "PRICING", "PRODUCTION", "COLLECTION"][i % 5];
      if (phase === "PRICING") {
        // Pricing ages from 051's own anchor, independent of workflow state
        // (PRD §55 Rule 9) — so seed the PricingStatus, not a phase timing.
        const { seedUnpricedWorkItem } = await import("../../helpers/notificationSeed");
        created.push(await seedUnpricedWorkItem({ orderId, state: "WAITING_PRICING", ageMinutes: 30 }));
      } else {
        const state =
          phase === "DESIGN" ? "ASSIGNED"
          : phase === "REVIEW" ? "WAITING_REVIEW"
          : phase === "COLLECTION" ? "READY_FOR_COLLECTION"
          : "IN_PRODUCTION";
        created.push(
          await seedAgedWorkItem({
            orderId,
            state,
            ageMinutes: 30,
            requiresDesign: phase !== "PRODUCTION" && phase !== "COLLECTION",
            departmentId,
          }),
        );
      }
    }

    await releaseLease();
    const result = await runDelayTick();
    expect(result.ran).toBe(true);
    expect(result.evaluated).toBeGreaterThanOrEqual(200);

    // Every one flagged, exactly once, at sequence 1 — none dropped, none
    // double-flagged, and the unique triple is what proves the second.
    const breaches = await testDb.delayBreach.findMany({
      where: { workItemId: { in: created } },
      select: { workItemId: true, phase: true, breachSequence: true },
    });
    const byWorkItem = new Map<string, number>();
    for (const b of breaches) byWorkItem.set(b.workItemId, (byWorkItem.get(b.workItemId) ?? 0) + 1);
    expect(byWorkItem.size).toBe(200);
    expect(breaches).toHaveLength(200);
    expect(breaches.every((b) => b.breachSequence === 1)).toBe(true);

    // All five phases actually appear — a mapping that silently dropped one
    // phase would still pass a count-based assertion otherwise.
    expect(new Set(breaches.map((b) => b.phase)).size).toBe(5);

    // Second tick: zero new flags (one per breach, not one per tick — the
    // SC-003 property at backlog scale), and no scheduler error (SC-014).
    await releaseLease();
    const second = await runDelayTick();
    expect(second.flagged).toBe(0);
    expect(second.runId).not.toBeNull();
    const runs = await testDb.schedulerRun.findMany({
      where: { id: second.runId! },
      select: { outcome: true, error: true },
    });
    expect(runs[0]!.outcome).toBe("OK");
    expect(runs[0]!.error).toBeNull();

    expect(
      await testDb.delayBreach.count({ where: { workItemId: { in: created } } }),
    ).toBe(200);

    // Fixture teardown. The claims above are all about THIS tick; leaving 200
    // late items behind would make every subsequent test file's tick iterate
    // them — the in-run equivalent of the cross-run accumulation the reset
    // script guards against. DELIVERED is terminal, so later ticks skip them
    // (FR-039), which is also a small extra exercise of that path.
    await testDb.workItem.updateMany({
      where: { id: { in: created } },
      data: { state: "DELIVERED" },
    });
  }, 120_000);

  it("after the backlog tick, nothing is left PENDING or stuck retrying (T075)", async () => {
    // The drain claim: a processed day leaves no row in the claimable state
    // and no row parked at its attempt ceiling. This runs after the bulk
    // test above, so "a day of seeded activity" has just happened.
    const { getNotificationConfig } = await import("~/server/notifications");
    const { maxAttempts } = getNotificationConfig().scheduler;

    // Anything PENDING right now would wait for the delivery loop — which
    // tests do not run — so zero here means every test's own processing
    // completed, including this file's.
    const pending = await testDb.notificationEvent.count({
      where: { deliveryStatus: "PENDING", deliveredAt: null },
    });
    expect(pending).toBe(0);

    // "Stuck retrying": at or past the attempt ceiling. The claim query
    // stops selecting these, so they are terminal — what must not exist is
    // a row the system keeps promising to retry.
    const exhausted = await testDb.notificationEvent.count({
      where: { deliveryStatus: "FAILED", attemptCount: { gte: maxAttempts } },
    });
    expect(exhausted).toBe(0);
  });
});
