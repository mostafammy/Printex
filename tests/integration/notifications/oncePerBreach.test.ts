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
  headDesigner = await seedNotificationUser({ prefix: "notif-once-head" });
  departmentId = await seedDepartment("notif-once-dept");
});

beforeEach(async () => {
  // Release any lease a previous test's tick is holding, and set the review
  // threshold to something a fixture can exceed deterministically.
  await testDb.schedulerLease.update({
    where: { id: "delay-scheduler" },
    data: { expiresAt: new Date(0) },
  });
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
    let firstAlertCount = 0;
    for (let tick = 0; tick < 10; tick += 1) {
      const result = await runDelayTick();
      // Release the lease so the next tick can acquire it (a real scheduler
      // would simply wait for the lease to expire).
      await testDb.schedulerLease.update({
        where: { id: "delay-scheduler" },
        data: { expiresAt: new Date(0) },
      });
      if (tick === 0) firstAlertCount = result.alerted;
      else expect(result.alerted).toBe(0);
    }

    // Exactly one breach row for this (workItem, phase).
    const breaches = await testDb.delayBreach.findMany({
      where: { workItemId, phase: "REVIEW" },
    });
    expect(breaches).toHaveLength(1);
    expect(breaches[0]!.breachSequence).toBe(1);

    // And exactly one notification per configured recipient, not one per tick.
    const notifications = await testDb.notification.findMany({
      where: { entityId: workItemId, type: "work_item.phase_delayed" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.userId).toBe(headDesigner.userId);
    expect(firstAlertCount).toBe(1);

    // --- the Work Item is still flagged delayed the whole time ----------
    expect(await getDelayedWorkItemIds()).toContain(workItemId);

    // --- re-breach: leave the phase and come back (FR-044) ---------------
    await testDb.workItem.update({ where: { id: workItemId }, data: { state: "IN_DESIGN" } });
    await testDb.phaseTiming.updateMany({
      where: { workItemId, endedAt: null },
      data: { endedAt: new Date() },
    });

    // Back into review, with a NEW open segment — a fresh waiting period.
    await testDb.workItem.update({ where: { id: workItemId }, data: { state: "WAITING_REVIEW" } });
    await testDb.phaseTiming.create({
      data: {
        workItemId,
        phase: "WAITING_REVIEW",
        kind: "QUEUE",
        startedAt: new Date(Date.now() - 10 * 60_000),
      },
    });
    await testDb.schedulerLease.update({
      where: { id: "delay-scheduler" },
      data: { expiresAt: new Date(0) },
    });

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
      where: { entityId: workItemId, type: "work_item.phase_delayed" },
    });
    expect(notificationsAfter).toHaveLength(2);
    expect(new Set(notificationsAfter.map((n) => n.sourceEventId)).size).toBe(2);
  });

  it("skips the tick when another instance holds the lease (FR-050)", async () => {
    // A live lease owned by a different process.
    await testDb.schedulerLease.update({
      where: { id: "delay-scheduler" },
      data: { ownerId: "other-process:999", expiresAt: new Date(Date.now() + 60_000) },
    });

    const result = await runDelayTick();
    expect(result.ran).toBe(false);

    await testDb.schedulerLease.update({
      where: { id: "delay-scheduler" },
      data: { expiresAt: new Date(0) },
    });
  });
});
