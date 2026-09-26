// SC-003 / issue acceptance #3: a threshold breach alerts ONCE, not once per
// tick (FR-042/043/044).
//
// This is the one acceptance criterion that is a DATA-INTEGRITY requirement
// rather than a timing one, so the test drives ten ticks and asserts the row
// count rather than measuring latency. A scheduler that only alerted on a
// state transition would need somewhere to record "already announced", and the
// `@@unique([workItemId, phase, breachSequence])` triple is that place.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getDelayedWorkItemIds, runDelayTick } from "~/server/notifications";
import {
  holdSchedulerLease,
  releaseSchedulerLease,
  recordOutboxEvent,
  seedAgedWorkItem,
  seedDepartment,
  seedNotificationUser,
  setThreshold,
  unique,
} from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let headDesigner: Awaited<ReturnType<typeof seedNotificationUser>>;
let departmentId: string;

beforeAll(async () => {
  // The threshold addresses the phase at the HEAD_DESIGNER role, so the
  // fixture user must actually HOLD that role. A user with no role would make
  // recipient resolution correctly return nobody — the test would then assert
  // zero notifications and pass for entirely the wrong reason.
  headDesigner = await seedNotificationUser({
    prefix: "notif-once-head",
    roleKeys: ["HEAD_DESIGNER"],
  });
  departmentId = await seedDepartment("notif-once-dept");
});

beforeEach(async () => {
  // Release any lease a previous test's tick is holding, and set the review
  // threshold to something a fixture can exceed deterministically.
  await releaseSchedulerLease();
  await setThreshold("REVIEW", 1, { alertRoles: ["HEAD_DESIGNER"] });
});

describe("once per breach (T018 / SC-003 / acceptance #3)", () => {
  it("alerts once across ten ticks, and again only after a re-breach", async () => {
    // A real customer so the order's FK holds.
    const customer = await testDb.customer.create({
      data: { name: unique("OncePerBreach"), normalizedName: unique("onceperbreach") },
      select: { id: true },
    });
    const order = await testDb.order.create({
      data: {
        customerId: customer.id,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "GROUPED",
        createdById: headDesigner.userId,
      },
      select: { id: true },
    });
    const orderId = order.id;

    // Parked in WAITING_REVIEW for 10 minutes against a 1-minute threshold.
    const workItemId = await seedAgedWorkItem({
      orderId: orderId,
      state: "WAITING_REVIEW",
      ageMinutes: 10,
      departmentId,
    });

    // --- ten ticks -------------------------------------------------------
    const tickAlerts: number[] = [];
    for (let tick = 0; tick < 10; tick += 1) {
      const result = await runDelayTick();
      // Release the lease so the next tick can acquire it (a real scheduler
      // would simply wait for the lease to expire).
      await releaseSchedulerLease();
      tickAlerts.push(result.alerted);
    }
    const firstAlertCount = tickAlerts[0] ?? 0;

    // Exactly one breach row for this (workItem, phase).
    const breaches = await testDb.delayBreach.findMany({
      where: { workItemId, phase: "REVIEW" },
    });
    expect(breaches).toHaveLength(1);
    expect(breaches[0]!.breachSequence).toBe(1);

    // And exactly one notification for THIS recipient, not one per tick. The
    // database is shared, so other seeded HEAD_DESIGNERs and other test files'
    // Work Items legitimately receive this alert too; the property under test
    // is per (work item, recipient), so the query is scoped to exactly that.
    const notifications = await testDb.notification.findMany({
      where: {
        entityId: workItemId,
        type: "work_item.phase_delayed",
        userId: headDesigner.userId,
      },
    });
    expect(notifications).toHaveLength(1);
    // The first tick alerted somebody; the next nine alerted nobody new. The
    // count is a TOTAL over all breaching Work Items in the shared database,
    // so it may exceed 1 — what must not happen is a second alert for this
    // recipient, which the assertion above already rules out.
    expect(firstAlertCount).toBeGreaterThanOrEqual(1);
    for (const alerted of tickAlerts.slice(1)) {
      expect(alerted).toBe(0);
    }

    // --- the Work Item is still flagged delayed the whole time ----------
    expect(await getDelayedWorkItemIds()).toContain(workItemId);

    // --- re-breach: leave the phase and come back (FR-044) ---------------
    await testDb.workItem.update({ where: { id: workItemId }, data: { state: "IN_DESIGN" } });
    await testDb.phaseTiming.updateMany({
      where: { workItemId, endedAt: null },
      data: { endedAt: new Date() },
    });

    // The Work Item recovers: it leaves REVIEW and its open segment closes.
    await testDb.workItem.update({ where: { id: workItemId }, data: { state: "IN_DESIGN" } });
    await testDb.phaseTiming.updateMany({
      where: { workItemId, endedAt: null },
      data: { endedAt: new Date() },
    });

    // Back-date the FIRST breach so the re-breach below is unambiguously a
    // different waiting period. The scheduler decides "same delay" vs "new
    // delay" by comparing the current waiting anchor against the newest
    // breach's `detectedAt` — a comparison of two timestamps, so the fixture
    // has to make them tell a true story. Without this, a re-breach segment
    // that starts "now" would be within milliseconds of the first breach and
    // the two would be indistinguishable.
    await testDb.delayBreach.updateMany({
      where: { workItemId, phase: "REVIEW" },
      data: { detectedAt: new Date(Date.now() - 60 * 60_000) },
    });

    // A tick while recovered must find nothing — a Work Item that left the
    // phase is not late any more (FR-039, and the derived-not-stored property
    // FR-059: no column had to be cleared).
    await releaseSchedulerLease();
    const whileRecovered = await runDelayTick();
    expect(whileRecovered.flagged).toBe(0);
    expect(
      await testDb.delayBreach.count({ where: { workItemId, phase: "REVIEW" } }),
    ).toBe(1);

    // It goes back into REVIEW and ages past the threshold again: a genuine
    // new breach, which must alert again (FR-044).
    await testDb.workItem.update({ where: { id: workItemId }, data: { state: "WAITING_REVIEW" } });
    await testDb.phaseTiming.create({
      data: {
        workItemId,
        phase: "WAITING_REVIEW",
        kind: "QUEUE",
        startedAt: new Date(Date.now() - 10 * 60_000),
      },
    });
    await releaseSchedulerLease();
    await runDelayTick();

    const afterRebreach = await testDb.delayBreach.findMany({
      where: { workItemId, phase: "REVIEW" },
      orderBy: { breachSequence: "asc" },
    });
    expect(afterRebreach).toHaveLength(2);
    expect(afterRebreach[1]!.breachSequence).toBe(2);

    // The OLD breach row is retained (constitution III).
    expect(afterRebreach[0]!.id).toBe(breaches[0]!.id);

    // A second alert was delivered, on a DIFFERENT outbox row — so the
    // (sourceEventId, userId) pair does not collide with the first.
    const notificationsAfter = await testDb.notification.findMany({
      where: { entityId: workItemId, type: "work_item.phase_delayed", userId: headDesigner.userId },
    });
    expect(notificationsAfter).toHaveLength(2);
    expect(new Set(notificationsAfter.map((n) => n.sourceEventId)).size).toBe(2);
  });

  it("skips the tick when another instance holds the lease (FR-050)", async () => {
    // A live lease owned by a different process.
    await holdSchedulerLease("other-process:999", 60);

    const result = await runDelayTick();
    expect(result.ran).toBe(false);

    await releaseSchedulerLease();
  });
});
