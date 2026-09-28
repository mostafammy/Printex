// tests/integration/changes/audit.test.ts
// Acceptance criterion 4: every FR-029 step leaves its audit event(s), and a
// refused or rolled-back command leaves none. tasks.md T071, SC-007.
//
// Each step runs through its server entry point. The assertion is on the
// 016-owned actions only (core's own transition bookkeeping is not ours to
// pin down here), scoped to the rows the step touched and written after it began.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedUser } from "../../helpers/seed";
import {
  acknowledgeSpecRevision,
  adminOverrideSpec,
  approveChangeRequest,
  cancelAfterProductionStarted,
  createChangeRequest,
  editSpec,
  rejectChangeRequest,
  withdrawChangeRequest,
} from "~/server/changes";
import { __resetSpecChangeListenersForTests, registerSpecChangeListener } from "~/server/changes/events";
import {
  adminActor,
  approverActor,
  createProductionItem,
  operatorActor,
  receptionActor,
  type ProductionItem,
} from "./productionFactory";

const CHANGE_ACTIONS = [
  "spec_version.created",
  "spec.edited",
  "spec.admin_override",
  "workitem.returned_for_customer_change",
  "workitem.late_cancelled",
  "change_request.created",
  "change_request.approved",
  "change_request.rejected",
  "change_request.withdrawn",
  "change_request.closed_by_cancellation",
  "change_request.acknowledged",
];

type Row = {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
};

afterAll(async () => {
  await testDb.$disconnect();
});

beforeEach(() => {
  __resetSpecChangeListenersForTests();
});

/** Every 016 audit row about this Work Item, its versions, or its requests, since `since`. */
async function auditsFor(workItemId: string, since: Date): Promise<Row[]> {
  const [versions, requests] = await Promise.all([
    testDb.specVersion.findMany({ where: { workItemId }, select: { id: true } }),
    testDb.changeRequest.findMany({ where: { workItemId }, select: { id: true } }),
  ]);
  const ids = [workItemId, ...versions.map((v) => v.id), ...requests.map((r) => r.id)];
  return testDb.auditEvent.findMany({
    where: { entityId: { in: ids }, action: { in: CHANGE_ACTIONS }, createdAt: { gte: since } },
    select: {
      action: true,
      entityType: true,
      entityId: true,
      actorId: true,
      before: true,
      after: true,
      reason: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

const actions = (rows: Row[]) => rows.map((r) => r.action).sort();
const byAction = (rows: Row[], action: string) => rows.filter((r) => r.action === action);

async function pending(item: ProductionItem, reason = "customer called"): Promise<string> {
  const res = await createChangeRequest(receptionActor(await seedUser()), {
    workItemId: item.workItemId,
    patch: { quantity: 800 },
    reason,
  });
  if (!res.ok) throw new Error(`create failed: ${res.error.code}`);
  return res.data.changeRequestId;
}

/** Runs `step` and returns the audit rows it wrote. */
async function audited(item: ProductionItem, step: () => Promise<unknown>): Promise<Row[]> {
  // DB clock vs. test clock: step back a little so "since" is never late.
  const since = new Date(Date.now() - 1_000);
  const before = await auditsFor(item.workItemId, since);
  await step();
  const after = await auditsFor(item.workItemId, since);
  return after.slice(before.length);
}

function ok<T extends { ok: boolean }>(res: T): T {
  if (!res.ok) throw new Error(JSON.stringify(res));
  return res;
}

describe("T071 — every FR-029 step is audited", () => {
  it("version created (v1)", async () => {
    const since = new Date(Date.now() - 1_000);
    const item = await createProductionItem({ state: "NEW" });
    const rows = await auditsFor(item.workItemId, since);
    expect(actions(rows)).toEqual(["spec_version.created"]);
    expect(rows[0]).toMatchObject({ entityType: "SpecVersion", actorId: item.creatorId });
    expect(rows[0]?.after).toMatchObject({ quantity: 500, material: "Vinyl" });
  });

  it("direct edit", async () => {
    const item = await createProductionItem({ state: "NEW" });
    const actor = receptionActor(await seedUser());
    const rows = await audited(item, async () =>
      ok(
        await editSpec(actor, {
          workItemId: item.workItemId,
          expectedVersion: 1,
          patch: { quantity: 650 },
          reason: "typo",
        }),
      ),
    );
    expect(actions(rows)).toEqual(["spec.edited", "spec_version.created"]);
    const [edited] = byAction(rows, "spec.edited");
    expect(edited).toMatchObject({
      entityType: "WorkItem",
      entityId: item.workItemId,
      actorId: actor.userId,
      reason: "typo",
    });
    expect(edited?.before).toMatchObject({ quantity: 500 });
    expect(edited?.after).toMatchObject({ quantity: 650 });
  });

  it("change request recorded", async () => {
    const item = await createProductionItem();
    let crId = "";
    const rows = await audited(item, async () => {
      crId = await pending(item, "bigger run");
    });
    expect(actions(rows)).toEqual(["change_request.created"]);
    expect(rows[0]).toMatchObject({ entityType: "ChangeRequest", entityId: crId, reason: "bigger run" });
    expect(rows[0]?.after).toMatchObject({ changedFields: ["quantity"] });
  });

  it.each(["CONTINUE_PRODUCTION", "REDESIGN"] as const)("approved (%s)", async (outcome) => {
    const item = await createProductionItem();
    const crId = await pending(item);
    const approver = approverActor(await seedUser());
    const rows = await audited(item, async () =>
      ok(await approveChangeRequest(approver, { changeRequestId: crId, outcome })),
    );
    expect(byAction(rows, "change_request.approved")).toHaveLength(1);
    expect(byAction(rows, "spec_version.created")).toHaveLength(1);
    const [approved] = byAction(rows, "change_request.approved");
    expect(approved).toMatchObject({ entityType: "ChangeRequest", entityId: crId, actorId: approver.userId });
    expect(approved?.before).toEqual({ status: "PENDING" });
    expect(approved?.after).toMatchObject({ status: "APPROVED", outcome });
  });

  it.each(["rejected", "withdrawn"] as const)("%s", async (kind) => {
    const item = await createProductionItem();
    const crId = await pending(item);
    const actor =
      kind === "rejected" ? approverActor(await seedUser()) : receptionActor(await seedUser());
    const rows = await audited(item, async () =>
      ok(
        kind === "rejected"
          ? await rejectChangeRequest(actor, { changeRequestId: crId, reason: "no" })
          : await withdrawChangeRequest(actor, { changeRequestId: crId, reason: "no" }),
      ),
    );
    expect(actions(rows)).toEqual([`change_request.${kind}`]);
    expect(rows[0]).toMatchObject({
      entityType: "ChangeRequest",
      entityId: crId,
      actorId: actor.userId,
      reason: "no",
    });
  });

  it("late cancellation, which also closes the pending request by cancellation", async () => {
    const item = await createProductionItem();
    const crId = await pending(item);
    const actor = receptionActor(await seedUser());
    const rows = await audited(item, async () =>
      ok(
        await cancelAfterProductionStarted(actor, {
          workItemId: item.workItemId,
          reason: "customer went elsewhere",
          costIncurred: "125.50",
        }),
      ),
    );
    expect(actions(rows)).toEqual(["change_request.closed_by_cancellation", "workitem.late_cancelled"]);
    expect(byAction(rows, "change_request.closed_by_cancellation")[0]).toMatchObject({
      entityId: crId,
      actorId: actor.userId,
      reason: "customer went elsewhere",
    });
    const [late] = byAction(rows, "workitem.late_cancelled");
    expect(late).toMatchObject({ entityType: "WorkItem", entityId: item.workItemId, actorId: actor.userId });
    expect(late?.before).toEqual({ state: "IN_PRODUCTION" });
    expect(late?.after).toMatchObject({ state: "CANCELLED" });
  });

  it("acknowledged", async () => {
    const item = await createProductionItem();
    const crId = await pending(item);
    ok(
      await approveChangeRequest(approverActor(await seedUser()), {
        changeRequestId: crId,
        outcome: "CONTINUE_PRODUCTION",
      }),
    );
    const operator = operatorActor(await seedUser(), item.departmentId);
    const rows = await audited(item, async () =>
      ok(await acknowledgeSpecRevision(operator, { workItemId: item.workItemId })),
    );
    expect(actions(rows)).toEqual(["change_request.acknowledged"]);
    expect(rows[0]).toMatchObject({ entityId: crId, actorId: operator.userId });
  });

  it("admin override", async () => {
    const item = await createProductionItem({ state: "PRODUCTION_COMPLETED" });
    const admin = adminActor(await seedUser());
    const rows = await audited(item, async () =>
      ok(
        await adminOverrideSpec(admin, {
          workItemId: item.workItemId,
          expectedVersion: 1,
          patch: { quantity: 480 },
          reason: "counted wrong",
        }),
      ),
    );
    expect(actions(rows)).toEqual(["spec.admin_override", "spec_version.created"]);
    const [override] = byAction(rows, "spec.admin_override");
    expect(override).toMatchObject({ entityId: item.workItemId, actorId: admin.userId, reason: "counted wrong" });
    expect(override?.before).toMatchObject({ quantity: 500 });
    expect(override?.after).toMatchObject({ quantity: 480 });
  });
});

describe("T071 — refused or rolled back means no audit (SC-007)", () => {
  it("a refused command writes nothing", async () => {
    const item = await createProductionItem({ state: "NEW" });
    const rows = await audited(item, async () => {
      const res = await editSpec(receptionActor(await seedUser()), {
        workItemId: item.workItemId,
        expectedVersion: 9,
        patch: { quantity: 650 },
      });
      expect(!res.ok && res.error.code).toBe("STALE_SPEC_VERSION");
    });
    expect(rows).toEqual([]);
  });

  it("a forbidden command writes nothing", async () => {
    const item = await createProductionItem();
    const crId = await pending(item);
    const rows = await audited(item, async () => {
      const res = await approveChangeRequest(receptionActor(await seedUser()), {
        changeRequestId: crId,
        outcome: "CONTINUE_PRODUCTION",
      });
      expect(res).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
    });
    expect(rows).toEqual([]);
  });

  it("a rolled-back approval (listener throws) writes nothing", async () => {
    const item = await createProductionItem();
    const crId = await pending(item);
    registerSpecChangeListener("test.boom", async () => {
      throw new Error("boom");
    });
    const rows = await audited(item, async () => {
      await expect(
        approveChangeRequest(approverActor(await seedUser()), {
          changeRequestId: crId,
          outcome: "CONTINUE_PRODUCTION",
        }),
      ).rejects.toThrow("boom");
    });
    expect(rows).toEqual([]);
  });
});
