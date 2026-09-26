// tests/integration/changes/changeRequest.test.ts
// User Story 3: change requests during production. tasks.md T039, T041, T042,
// contracts/change-control.md §createChangeRequest … §withdrawChangeRequest.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedUser } from "../../helpers/seed";
import { WORK_ITEM_STATES } from "~/server/core";
import {
  applySpecChangeInTx,
  approveChangeRequest,
  createChangeRequest,
  getSpecHistory,
  rejectChangeRequest,
  runInTxScope,
  withdrawChangeRequest,
} from "~/server/changes";
import { __resetSpecChangeListenersForTests } from "~/server/changes/events";
import {
  approverActor,
  createProductionItem,
  makeActor,
  openActiveSegments,
  operatorActor,
  receptionActor,
} from "./productionFactory";

afterAll(async () => {
  await testDb.$disconnect();
});

beforeEach(() => {
  __resetSpecChangeListenersForTests();
});

async function newReception() {
  return receptionActor(await seedUser());
}

async function newApprover() {
  return approverActor(await seedUser());
}

describe("T039 — record a change request", () => {
  it("stores PENDING against the current version, pauses the running timer, notifies and audits (US3-1)", async () => {
    const item = await createProductionItem({ timerRunning: true });
    const reception = await newReception();

    const res = await createChangeRequest(reception, {
      workItemId: item.workItemId,
      patch: { quantity: 800 },
      reason: "customer called",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cr = await testDb.changeRequest.findUniqueOrThrow({
      where: { id: res.data.changeRequestId },
    });
    const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: item.workItemId } });
    expect(cr.status).toBe("PENDING");
    expect(cr.baseSpecVersionId).toBe(wi.currentSpecVersionId);
    expect(cr.pausedRunningTimerAt).not.toBeNull();
    expect(cr.requestedById).toBe(reception.userId);
    expect(await openActiveSegments(item.workItemId)).toBe(0);

    // Spec columns untouched until approval.
    expect(wi.quantity).toBe(500);

    const notification = await testDb.notificationEvent.findFirst({
      where: { type: "work_item.change_requested", entityId: item.workItemId },
    });
    expect(notification).not.toBeNull();
    expect(notification?.recipientDepartmentIds).toContain(item.departmentId);

    const audit = await testDb.auditEvent.findFirst({
      where: { action: "change_request.created", entityId: cr.id },
    });
    expect(audit?.actorId).toBe(reception.userId);
    expect(audit?.reason).toBe("customer called");
  });

  it("leaves pausedRunningTimerAt null when no timer was running", async () => {
    const item = await createProductionItem({ timerRunning: false });
    const res = await createChangeRequest(await newReception(), {
      workItemId: item.workItemId,
      patch: { quantity: 800 },
      reason: "r",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const cr = await testDb.changeRequest.findUniqueOrThrow({
      where: { id: res.data.changeRequestId },
    });
    expect(cr.pausedRunningTimerAt).toBeNull();
  });

  it("refuses a second request with CHANGE_REQUEST_PENDING (US3-3)", async () => {
    const item = await createProductionItem();
    const reception = await newReception();
    const first = await createChangeRequest(reception, {
      workItemId: item.workItemId,
      patch: { quantity: 800 },
      reason: "r1",
    });
    expect(first.ok).toBe(true);

    const second = await createChangeRequest(reception, {
      workItemId: item.workItemId,
      patch: { quantity: 900 },
      reason: "r2",
    });
    expect(second).toEqual({ ok: false, error: { code: "CHANGE_REQUEST_PENDING" } });
  });

  it("two concurrent creates leave exactly one row", async () => {
    const item = await createProductionItem();
    const reception = await newReception();
    const results = await Promise.all([
      createChangeRequest(reception, { workItemId: item.workItemId, patch: { quantity: 800 }, reason: "a" }),
      createChangeRequest(reception, { workItemId: item.workItemId, patch: { quantity: 900 }, reason: "b" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok);
    expect(failed && !failed.ok && failed.error.code).toBe("CHANGE_REQUEST_PENDING");
    expect(await testDb.changeRequest.count({ where: { workItemId: item.workItemId } })).toBe(1);
  });

  it("refuses a no-op with NO_CHANGES", async () => {
    const item = await createProductionItem();
    const res = await createChangeRequest(await newReception(), {
      workItemId: item.workItemId,
      patch: { quantity: 500 },
      reason: "same",
    });
    expect(res).toEqual({ ok: false, error: { code: "NO_CHANGES" } });
  });

  it.each(WORK_ITEM_STATES.filter((s) => s !== "IN_PRODUCTION"))(
    "refuses in %s with NOT_IN_PRODUCTION",
    async (state) => {
      const item = await createProductionItem({ state });
      const res = await createChangeRequest(await newReception(), {
        workItemId: item.workItemId,
        patch: { quantity: 800 },
        reason: "r",
      });
      expect(res).toEqual({ ok: false, error: { code: "NOT_IN_PRODUCTION" } });
    },
  );
});

describe("T041 — approve", () => {
  it("CONTINUE_PRODUCTION makes v2 current, keeps v1, stays IN_PRODUCTION (acceptance criterion 2, US3-4)", async () => {
    const item = await createProductionItem();
    const reception = await newReception();
    const approver = await newApprover();
    const created = await createChangeRequest(reception, {
      workItemId: item.workItemId,
      patch: { quantity: 800 },
      reason: "customer called",
    });
    if (!created.ok) throw new Error("create failed");

    const res = await approveChangeRequest(approver, {
      changeRequestId: created.data.changeRequestId,
      outcome: "CONTINUE_PRODUCTION",
    });
    expect(res).toEqual({ ok: true, data: { version: 2, outcome: "CONTINUE_PRODUCTION" } });

    const wi = await testDb.workItem.findUniqueOrThrow({
      where: { id: item.workItemId },
      include: { currentSpecVersion: true },
    });
    expect(wi.state).toBe("IN_PRODUCTION");
    expect(wi.quantity).toBe(800);
    expect(wi.currentSpecVersion?.version).toBe(2);
    expect(wi.currentSpecVersion?.origin).toBe("CHANGE_REQUEST");

    const cr = await testDb.changeRequest.findUniqueOrThrow({
      where: { id: created.data.changeRequestId },
    });
    expect(cr.status).toBe("APPROVED");
    expect(cr.resultingSpecVersionId).toBe(wi.currentSpecVersionId);
    expect(cr.decidedById).toBe(approver.userId);

    const history = await getSpecHistory(reception, { workItemId: item.workItemId });
    if (!history.ok) throw new Error("history failed");
    expect(history.data.versions.map((v) => v.snapshot.quantity)).toEqual([500, 800]);
    expect(history.data.diffs[0]?.changes).toEqual([
      { field: "quantity", kind: "CHANGED", before: 500, after: 800 },
    ]);

    expect(
      await testDb.notificationEvent.count({
        where: { type: "work_item.revised_instruction", entityId: item.workItemId },
      }),
    ).toBe(1);
    expect(
      await testDb.auditEvent.count({
        where: { action: "change_request.approved", entityId: cr.id },
      }),
    ).toBe(1);
    expect(
      await testDb.auditEvent.count({
        where: { action: "spec_version.created", entityId: wi.currentSpecVersionId ?? "" },
      }),
    ).toBe(1);
  });

  it("REDESIGN sends the item back with CUSTOMER_CHANGE and a Return from production (US3-5, FR-015)", async () => {
    const item = await createProductionItem({ timerRunning: true });
    const created = await createChangeRequest(await newReception(), {
      workItemId: item.workItemId,
      patch: { material: "Paper" },
      reason: "new material",
    });
    if (!created.ok) throw new Error("create failed");

    const res = await approveChangeRequest(await newApprover(), {
      changeRequestId: created.data.changeRequestId,
      outcome: "REDESIGN",
    });
    expect(res.ok).toBe(true);

    const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: item.workItemId } });
    expect(wi.state).toBe("REWORK_REQUIRED");

    const transition = await testDb.workItemTransition.findFirst({
      where: { workItemId: item.workItemId, to: "REWORK_REQUIRED" },
      orderBy: { at: "desc" },
    });
    expect(transition?.rejectionCategory).toBe("CUSTOMER_CHANGE");

    const cr = await testDb.changeRequest.findUniqueOrThrow({
      where: { id: created.data.changeRequestId },
      include: { return: true },
    });
    expect(cr.returnId).not.toBeNull();
    expect(cr.return?.category).toBe("CUSTOMER_CHANGE");
    expect(cr.return?.originDepartmentId).toBe(item.departmentId);
    expect(await openActiveSegments(item.workItemId)).toBe(0);

    expect(
      await testDb.notificationEvent.count({
        where: { type: "work_item.customer_change_returned", entityId: item.workItemId },
      }),
    ).toBe(1);
  });

  it.each([
    { label: "requiresDesign = false", requiresDesign: false, withAssignee: true },
    { label: "no assignee", requiresDesign: true, withAssignee: false },
  ])("REDESIGN with $label → REDESIGN_NOT_ALLOWED", async ({ requiresDesign, withAssignee }) => {
    const item = await createProductionItem({ requiresDesign, withAssignee });
    const created = await createChangeRequest(await newReception(), {
      workItemId: item.workItemId,
      patch: { quantity: 800 },
      reason: "r",
    });
    if (!created.ok) throw new Error("create failed");

    const res = await approveChangeRequest(await newApprover(), {
      changeRequestId: created.data.changeRequestId,
      outcome: "REDESIGN",
    });
    expect(res).toEqual({ ok: false, error: { code: "REDESIGN_NOT_ALLOWED" } });
    const cr = await testDb.changeRequest.findUniqueOrThrow({
      where: { id: created.data.changeRequestId },
    });
    expect(cr.status).toBe("PENDING");
  });
});

describe("T042 — permissions, decisions, races", () => {
  async function pendingRequest() {
    const item = await createProductionItem();
    const reception = await newReception();
    const created = await createChangeRequest(reception, {
      workItemId: item.workItemId,
      patch: { quantity: 800 },
      reason: "r",
    });
    if (!created.ok) throw new Error("create failed");
    return { item, reception, changeRequestId: created.data.changeRequestId };
  }

  it("RECEPTION cannot approve or reject (US3-7)", async () => {
    const { reception, changeRequestId } = await pendingRequest();
    expect(
      await approveChangeRequest(reception, { changeRequestId, outcome: "CONTINUE_PRODUCTION" }),
    ).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await rejectChangeRequest(reception, { changeRequestId, reason: "no" })).toEqual({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("PRODUCTION_OPERATOR can do none of create/approve/reject/withdraw (FR-018)", async () => {
    const { item, changeRequestId } = await pendingRequest();
    const operator = operatorActor(await seedUser(), item.departmentId);
    const forbidden = { ok: false, error: { code: "FORBIDDEN" } };
    expect(
      await createChangeRequest(operator, { workItemId: item.workItemId, patch: { quantity: 1 }, reason: "r" }),
    ).toEqual(forbidden);
    expect(
      await approveChangeRequest(operator, { changeRequestId, outcome: "CONTINUE_PRODUCTION" }),
    ).toEqual(forbidden);
    expect(await rejectChangeRequest(operator, { changeRequestId, reason: "r" })).toEqual(forbidden);
    expect(await withdrawChangeRequest(operator, { changeRequestId, reason: "r" })).toEqual(forbidden);
  });

  it("HEAD_DESIGNER cannot create (no order.edit)", async () => {
    const item = await createProductionItem();
    expect(
      await createChangeRequest(await newApprover(), {
        workItemId: item.workItemId,
        patch: { quantity: 800 },
        reason: "r",
      }),
    ).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("reject and withdraw need a reason", async () => {
    const { reception, changeRequestId } = await pendingRequest();
    const rej = await rejectChangeRequest(await newApprover(), { changeRequestId, reason: "  " });
    expect(!rej.ok && rej.error.code).toBe("VALIDATION");
    const wd = await withdrawChangeRequest(reception, { changeRequestId, reason: "" });
    expect(!wd.ok && wd.error.code).toBe("VALIDATION");
  });

  it.each(["reject", "withdraw"] as const)(
    "%s writes no version and notifies requester and department (US3-6, FR-016)",
    async (kind) => {
      const { item, reception, changeRequestId } = await pendingRequest();
      const res =
        kind === "reject"
          ? await rejectChangeRequest(await newApprover(), { changeRequestId, reason: "too late" })
          : await withdrawChangeRequest(reception, { changeRequestId, reason: "customer relented" });
      expect(res).toEqual({ ok: true, data: null });

      const cr = await testDb.changeRequest.findUniqueOrThrow({ where: { id: changeRequestId } });
      expect(cr.status).toBe(kind === "reject" ? "REJECTED" : "WITHDRAWN");
      expect(await testDb.specVersion.count({ where: { workItemId: item.workItemId } })).toBe(1);

      const note = await testDb.notificationEvent.findFirst({
        where: {
          type: kind === "reject" ? "work_item.change_rejected" : "work_item.change_withdrawn",
          entityId: item.workItemId,
        },
      });
      expect(note?.recipientUserIds).toContain(reception.userId);
      expect(note?.recipientDepartmentIds).toContain(item.departmentId);
    },
  );

  it("concurrent double approve: one wins, the other is CHANGE_REQUEST_ALREADY_DECIDED", async () => {
    const { changeRequestId } = await pendingRequest();
    const [a, b] = [await newApprover(), await newApprover()];
    const results = await Promise.all([
      approveChangeRequest(a, { changeRequestId, outcome: "CONTINUE_PRODUCTION" }),
      approveChangeRequest(b, { changeRequestId, outcome: "CONTINUE_PRODUCTION" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok);
    expect(loser && !loser.ok && loser.error.code).toBe("CHANGE_REQUEST_ALREADY_DECIDED");
  });

  it("approving a decided request → CHANGE_REQUEST_ALREADY_DECIDED", async () => {
    const { changeRequestId } = await pendingRequest();
    const approver = await newApprover();
    await rejectChangeRequest(approver, { changeRequestId, reason: "no" });
    expect(
      await approveChangeRequest(approver, { changeRequestId, outcome: "CONTINUE_PRODUCTION" }),
    ).toEqual({ ok: false, error: { code: "CHANGE_REQUEST_ALREADY_DECIDED" } });
  });

  it("approving after the item left IN_PRODUCTION → WORK_ITEM_LEFT_PRODUCTION", async () => {
    const { item, changeRequestId } = await pendingRequest();
    await testDb.workItem.update({
      where: { id: item.workItemId },
      data: { state: "PRODUCTION_COMPLETED" },
    });
    expect(
      await approveChangeRequest(await newApprover(), { changeRequestId, outcome: "CONTINUE_PRODUCTION" }),
    ).toEqual({ ok: false, error: { code: "WORK_ITEM_LEFT_PRODUCTION" } });
  });

  it("approving when the base is no longer current → STALE_SPEC_VERSION, nothing written (US3-8)", async () => {
    const { item, changeRequestId } = await pendingRequest();
    const admin = makeActor(await seedUser(), ["ADMIN_OWNER"], ["admin.override"]);
    await runInTxScope(testDb, (scope) =>
      applySpecChangeInTx(scope, {
        workItemId: item.workItemId,
        actorId: admin.userId,
        origin: "ADMIN_OVERRIDE",
        patch: { material: "Paper" },
        expected: { version: 1 },
        reason: "moved on",
        ifUnchanged: "fail",
      }),
    );
    const versionsBefore = await testDb.specVersion.count({ where: { workItemId: item.workItemId } });

    const res = await approveChangeRequest(await newApprover(), {
      changeRequestId,
      outcome: "CONTINUE_PRODUCTION",
    });
    expect(!res.ok && res.error.code).toBe("STALE_SPEC_VERSION");
    expect(await testDb.specVersion.count({ where: { workItemId: item.workItemId } })).toBe(versionsBefore);
    const cr = await testDb.changeRequest.findUniqueOrThrow({ where: { id: changeRequestId } });
    expect(cr.status).toBe("PENDING");
  });
});
