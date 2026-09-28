// US6 / SC-005 / SC-011: the delayed-work query, its scope, and its shape.
//
// The security property here is unusual enough to restate: scoping happens
// BEFORE counting, so `total` cannot reveal the existence of out-of-scope
// work. A Banner operator must not learn that a Digital job is late merely
// by reading a count (SC-005, US6 scenario 3) — which is why the test
// asserts on `total` rather than only on the row list.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  getDelayedWorkItemIds,
  getDelayedWorkItems,
} from "~/server/notifications";
import {
  seedAgedWorkItem,
  seedCustomer,
  seedDepartment,
  seedNotificationUser,
  setThreshold,
} from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let operator: Awaited<ReturnType<typeof seedNotificationUser>>;
let headDesigner: Awaited<ReturnType<typeof seedNotificationUser>>;
let digitalDept: string;
let bannerDept: string;
let orderId: string;

beforeAll(async () => {
  digitalDept = await seedDepartment("digital-prod");
  bannerDept = await seedDepartment("banner-prod");

  headDesigner = await seedNotificationUser({
    prefix: "delayed-head",
    roleKeys: ["HEAD_DESIGNER"],
  });
  operator = await seedNotificationUser({
    prefix: "delayed-banner-op",
    roleKeys: ["PRODUCTION_OPERATOR"],
    departmentIds: [bannerDept],
  });

  // A real user for `Order.createdById`: it is a FK to `user`, so a bare
  // string would violate it. Users and departments come first; the order
  // they reference follows.
  // `seedCustomer` rather than a fixed string: Customer.normalizedName is
  // unique in some schemas, and a fixed name would fail on the second run
  // against an unreset database.
  const customerId = await seedCustomer("DelayedQuery");
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "GROUPED",
      createdById: headDesigner.userId,
    },
  });
  orderId = order.id;

  // Tight thresholds so fixtures can exceed them with age rather than with
  // a waiting-room marathon.
  await setThreshold("REVIEW", 1, { alertRoles: ["HEAD_DESIGNER"] });
  await setThreshold("PRODUCTION", 1, {
    alertRoles: ["PRODUCTION_OPERATOR"],
    alertDepartmentIds: [digitalDept],
  });
  await setThreshold("DESIGN", 1, { alertRoles: ["HEAD_DESIGNER"] });
});

describe("delayed query scope (T058 / SC-005 / US6 scenario 3)", () => {
  it("shows neither the rows NOR a count that reveals out-of-scope work", async () => {
    // A Digital-production job, aged well past its 1-minute threshold.
    const digitalItemId = await seedAgedWorkItem({
      orderId,
      state: "IN_PRODUCTION",
      ageMinutes: 60,
      departmentId: digitalDept,
      requiresDesign: false,
    });

    // Phase-scoped + max page: the shared DB holds aged items from earlier
    // runs, and the default 50-row page would otherwise make containment a
    // statement about pagination rather than about scope.
    const bannerView = await getDelayedWorkItems(operator, { phase: "PRODUCTION", pageSize: 200 });
    const headView = await getDelayedWorkItems(headDesigner, { phase: "PRODUCTION", pageSize: 200 });

    // Head designer sees the shop.
    expect(headView.rows.some((r) => r.workItemId === digitalItemId)).toBe(true);
    // The Banner operator's query correctly derives PRODUCTION scope from
    // `departmentId ∈ actor.departmentIds` — Digital is not one — and the
    // count is filtered by the same predicate, not computed globally:
    // `total` must equal `rows.length` for an unfiltered page of the same
    // set, so the number itself leaks nothing.
    expect(bannerView.rows.some((r) => r.workItemId === digitalItemId)).toBe(false);
    expect(bannerView.total).toBe(bannerView.rows.length);
    expect(bannerView.rows.every((r) => r.responsibleDepartmentId !== digitalDept)).toBe(true);

    // The unscoped seam (011's membership test) still contains it: it runs
    // inside 011's OWN already-authorized query, so scoping is the caller's
    // job there — contract §getDelayedWorkItemIds.
    expect(await getDelayedWorkItemIds()).toContain(digitalItemId);
  });

  it("an operator's department jobs DO appear for that operator", async () => {
    const bannerItem = await seedAgedWorkItem({
      orderId,
      state: "IN_PRODUCTION",
      ageMinutes: 60,
      departmentId: bannerDept,
      requiresDesign: false,
    });

    const view = await getDelayedWorkItems(operator, {
      departmentId: bannerDept,
      phase: "PRODUCTION",
      pageSize: 200,
    });
    expect(view.rows.some((r) => r.workItemId === bannerItem)).toBe(true);
  });
});

describe("delayed view shape (T060 / contract)", () => {
  it("carries the anchor, age, phase, threshold, and responsible department for every row", async () => {
    const headView = await getDelayedWorkItems(headDesigner, { pageSize: 200 });
    expect(headView.rows.length).toBeGreaterThan(0);

    for (const row of headView.rows) {
      // The anchor, not a computed age string: rendering belongs to the one
      // shared formatter, and a consumer (090) formats its own.
      expect(row.waitingSince).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(row.waitingAgeMinutes).toBeGreaterThan(0);
      expect(row.thresholdMinutes).toBeGreaterThan(0);
      expect(row.phase).toMatch(/^(DESIGN|REVIEW|PRICING|PRODUCTION|COLLECTION)$/);
      expect(typeof row.orderNumber).toBe("number");
      expect(row.customerName.length).toBeGreaterThan(0);
      // Either the Work Item's department, or null for a role-mapped phase
      // (review/pricing) where the threshold's recipients name the party.
      expect(
        row.responsibleDepartmentId === null || typeof row.responsibleDepartmentId === "string",
      ).toBe(true);
      expect(row.state).toBeTruthy();
    }

    // Worst first — the shop's question is "what is most late?"
    const ages = headView.rows.map((r) => r.waitingAgeMinutes);
    expect([...ages].sort((a, b) => b - a)).toEqual(ages);
  });

  it("filters by phase without changing what the phase means", async () => {
    const reviewOnly = await getDelayedWorkItems(headDesigner, { phase: "REVIEW", pageSize: 200 });
    for (const row of reviewOnly.rows) expect(row.phase).toBe("REVIEW");
    if (reviewOnly.rows.length > 0) expect(reviewOnly.total).toBe(reviewOnly.rows.length);
  });
});

describe("terminal and skipped states (T061 / SC-011)", () => {
  it("a DELIVERED Work Item disappears from the list immediately (FR-039)", async () => {
    const itemId = await seedAgedWorkItem({
      orderId,
      state: "WAITING_REVIEW",
      ageMinutes: 60,
      requiresDesign: true,
    });

    const reviewView = { phase: "REVIEW" as const, pageSize: 200 };
    expect(
      (await getDelayedWorkItems(headDesigner, reviewView)).rows.some((r) => r.workItemId === itemId),
    ).toBe(true);

    // The derivation is recomputed per query, so moving on clears it with no
    // flag to reset — the property FR-059 exists for.
    await testDb.workItem.update({ where: { id: itemId }, data: { state: "DELIVERED" } });

    expect(
      (await getDelayedWorkItems(headDesigner, reviewView)).rows.some((r) => r.workItemId === itemId),
    ).toBe(false);
    expect(await getDelayedWorkItemIds()).not.toContain(itemId);
  });

  it("a design-skipped Work Item is never design-delayed (FR-040 / SC-011 b)", async () => {
    // requiresDesign = false driven straight toward production; even sitting
    // in a design-ish state the design threshold is never evaluated.
    const noDesign = await seedAgedWorkItem({
      orderId,
      state: "ASSIGNED",
      ageMinutes: 60,
      requiresDesign: false,
    });

    const rows = (await getDelayedWorkItems(headDesigner, { pageSize: 200 })).rows;
    expect(rows.some((r) => r.workItemId === noDesign && r.phase === "DESIGN")).toBe(false);
  });

  it("an unmeasured state (NEW) never appears", async () => {
    const fresh = await testDb.workItem.create({
      data: { orderId, state: "NEW", requiresDesign: true },
    });
    // Even though it shares the order, NEW maps to no measured phase.
    await testDb.phaseTiming.create({
      data: {
        workItemId: fresh.id,
        phase: "NEW",
        kind: "QUEUE",
        startedAt: new Date(Date.now() - 60 * 60_000),
      },
    });

    const rows = (await getDelayedWorkItems(headDesigner, { pageSize: 200 })).rows;
    expect(rows.some((r) => r.workItemId === fresh.id)).toBe(false);
  });
});

describe("empty recipient list (T054 / US5 scenario 2)", () => {
  it("still flags delayed and lists, but sends NO alert (FR-041)", async () => {
    // COLLECTION with nobody addressed: a legitimate, specified case — the
    // breach must still be recorded and visible, just not notified.
    await setThreshold("COLLECTION", 1, {
      alertRoles: [],
      alertPermissions: [],
      alertDepartmentIds: [],
    });

    const itemId = await seedAgedWorkItem({
      orderId,
      state: "READY_FOR_COLLECTION",
      ageMinutes: 60,
      requiresDesign: false,
      departmentId: bannerDept,
    });

    const listed = await getDelayedWorkItems(headDesigner, { phase: "COLLECTION", pageSize: 200 });
    expect(listed.rows.some((r) => r.workItemId === itemId)).toBe(true);

    const { runDelayTick } = await import("~/server/notifications");
    // Release the lease so this tick may acquire it.
    await testDb.schedulerLease.upsert({
      where: { id: "delay-scheduler" },
      create: { id: "delay-scheduler", ownerId: "", acquiredAt: new Date(0), expiresAt: new Date(0) },
      update: { expiresAt: new Date(0) },
    });
    const result = await runDelayTick();
    expect(result.ran).toBe(true);

    // The breach exists — detection happened.
    const breach = await testDb.delayBreach.findFirst({
      where: { workItemId: itemId, phase: "COLLECTION" },
    });
    expect(breach).not.toBeNull();

    // But no notification was sent: nobody was addressed (FR-041). The
    // breach row itself records `notifiedAt` only for the tick, not per
    // recipient — what must be empty is the notification table.
    const notifications = await testDb.notification.findMany({
      where: { entityId: itemId, type: "work_item.phase_delayed" },
    });
    expect(notifications).toHaveLength(0);
  });
});
