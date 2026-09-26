// tests/integration/changes/adminOverride.test.ts
// User Story 7: admin override with a reason. tasks.md T068,
// contracts/change-control.md §adminOverrideSpec, spec FR-027–028.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedUser } from "../../helpers/seed";
import {
  acknowledgeSpecRevision,
  adminOverrideSpec,
  approveChangeRequest,
  createChangeRequest,
  getProductionHold,
} from "~/server/changes";
import { __resetSpecChangeListenersForTests } from "~/server/changes/events";
import { DomainProductionError, resumeProduction } from "~/server/production";
import {
  adminActor,
  approverActor,
  createProductionItem,
  openActiveSegments,
  operatorActor,
  receptionActor,
  type ProductionItem,
} from "./productionFactory";

afterAll(async () => {
  await testDb.$disconnect();
});

beforeEach(() => {
  __resetSpecChangeListenersForTests();
});

async function newAdmin() {
  return adminActor(await seedUser());
}

async function requestChange(item: ProductionItem): Promise<string> {
  const res = await createChangeRequest(receptionActor(await seedUser()), {
    workItemId: item.workItemId,
    patch: { quantity: 800 },
    reason: "customer called",
  });
  if (!res.ok) throw new Error(`create failed: ${res.error.code}`);
  return res.data.changeRequestId;
}

/** resumeProduction's refusal code, or "ok". */
async function tryResume(item: ProductionItem): Promise<string> {
  try {
    await resumeProduction(
      operatorActor(await seedUser(), item.departmentId),
      item.workItemId,
    );
    return "ok";
  } catch (e) {
    if (e instanceof DomainProductionError) return e.code;
    const guardCode = (e as { error?: { details?: { guardCode?: string } } })
      .error?.details?.guardCode;
    return guardCode ?? String(e);
  }
}

describe("T068 — admin override after production (US7-1)", () => {
  it.each(["PRODUCTION_COMPLETED", "DELIVERED", "COMPLETED"] as const)(
    "%s → ADMIN_OVERRIDE version, prior version untouched, audited with the reason, no state change",
    async (state) => {
      const item = await createProductionItem({ state });
      const v1Before = await testDb.specVersion.findFirstOrThrow({
        where: { workItemId: item.workItemId, version: 1 },
      });
      const admin = await newAdmin();

      const res = await adminOverrideSpec(admin, {
        workItemId: item.workItemId,
        expectedVersion: 1,
        patch: { quantity: 450 },
        reason: "invoice correction",
      });
      expect(res).toEqual({
        ok: true,
        data: { version: 2, changeRequestId: null },
      });

      const wi = await testDb.workItem.findUniqueOrThrow({
        where: { id: item.workItemId },
        include: { currentSpecVersion: true },
      });
      expect(wi.state).toBe(state);
      expect(wi.quantity).toBe(450);
      expect(wi.currentSpecVersion?.origin).toBe("ADMIN_OVERRIDE");
      expect(wi.currentSpecVersion?.reason).toBe("invoice correction");
      expect(wi.currentSpecVersion?.createdById).toBe(admin.userId);

      const v1After = await testDb.specVersion.findUniqueOrThrow({
        where: { id: v1Before.id },
      });
      expect(v1After).toEqual(v1Before);

      const audit = await testDb.auditEvent.findFirst({
        where: { action: "spec.admin_override", entityId: item.workItemId },
      });
      expect(audit?.actorId).toBe(admin.userId);
      expect(audit?.reason).toBe("invoice correction");
      expect(audit?.before).toEqual({ quantity: 500 });
      expect(audit?.after).toEqual({ quantity: 450 });

      expect(
        await testDb.changeRequest.count({
          where: { workItemId: item.workItemId },
        }),
      ).toBe(0);
    },
  );

  it("refuses REDESIGN after production with REDESIGN_NOT_ALLOWED", async () => {
    const item = await createProductionItem({ state: "DELIVERED" });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 450 },
      reason: "r",
      designChoice: "REDESIGN",
    });
    expect(res).toEqual({ ok: false, error: { code: "REDESIGN_NOT_ALLOWED" } });
  });
});

describe("T068 — validation and permission (US7-2, US7-3)", () => {
  it.each(["", "   "])(
    "reason %j → VALIDATION, nothing written",
    async (reason) => {
      const item = await createProductionItem({ state: "DELIVERED" });
      const res = await adminOverrideSpec(await newAdmin(), {
        workItemId: item.workItemId,
        expectedVersion: 1,
        patch: { quantity: 450 },
        reason,
      });
      expect(!res.ok && res.error.code).toBe("VALIDATION");
      expect(
        await testDb.specVersion.count({
          where: { workItemId: item.workItemId },
        }),
      ).toBe(1);
    },
  );

  it("a missing reason → VALIDATION", async () => {
    const item = await createProductionItem({ state: "DELIVERED" });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 450 },
    } as never);
    expect(!res.ok && res.error.code).toBe("VALIDATION");
  });

  it.each([
    { label: "RECEPTION", actor: receptionActor },
    { label: "HEAD_DESIGNER", actor: approverActor },
  ])("$label → FORBIDDEN", async ({ actor }) => {
    const item = await createProductionItem({ state: "DELIVERED" });
    const res = await adminOverrideSpec(actor(await seedUser()), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 450 },
      reason: "r",
    });
    expect(res).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("T068 — admin override in production (US7-4, FR-028)", () => {
  it("CONTINUE_PRODUCTION → an APPROVED isAdminOverride request; hold is REVISION_UNACKNOWLEDGED until acknowledged", async () => {
    const item = await createProductionItem();
    const admin = await newAdmin();

    const res = await adminOverrideSpec(admin, {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 800 },
      reason: "customer phoned the owner",
      outcome: "CONTINUE_PRODUCTION",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.version).toBe(2);
    const crId = res.data.changeRequestId;
    expect(crId).not.toBeNull();
    if (!crId) return;

    const wi = await testDb.workItem.findUniqueOrThrow({
      where: { id: item.workItemId },
      include: { currentSpecVersion: true },
    });
    expect(wi.state).toBe("IN_PRODUCTION");
    expect(wi.quantity).toBe(800);
    expect(wi.currentSpecVersion?.origin).toBe("ADMIN_OVERRIDE");

    const cr = await testDb.changeRequest.findUniqueOrThrow({
      where: { id: crId },
    });
    expect(cr).toMatchObject({
      status: "APPROVED",
      outcome: "CONTINUE_PRODUCTION",
      isAdminOverride: true,
      requestReason: "customer phoned the owner",
      requestedById: admin.userId,
      decidedById: admin.userId,
      resultingSpecVersionId: wi.currentSpecVersionId,
      productionAcknowledgedAt: null,
    });

    expect(await getProductionHold(testDb, item.workItemId)).toEqual({
      kind: "REVISION_UNACKNOWLEDGED",
      changeRequestId: crId,
    });
    expect(await tryResume(item)).toBe("CHANGE_HOLD");

    expect(
      await testDb.notificationEvent.count({
        where: {
          type: "work_item.revised_instruction",
          entityId: item.workItemId,
        },
      }),
    ).toBe(1);
    expect(
      await testDb.auditEvent.count({
        where: { action: "change_request.approved", entityId: crId },
      }),
    ).toBe(1);
    expect(
      await testDb.auditEvent.count({
        where: { action: "spec.admin_override", entityId: item.workItemId },
      }),
    ).toBe(1);

    const ack = await acknowledgeSpecRevision(
      operatorActor(await seedUser(), item.departmentId),
      {
        workItemId: item.workItemId,
      },
    );
    expect(ack).toEqual({ ok: true, data: null });
    expect(await tryResume(item)).toBe("ok");
  });

  it("REDESIGN → REWORK_REQUIRED with CUSTOMER_CHANGE and a Return", async () => {
    const item = await createProductionItem({ timerRunning: true });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { material: "Paper" },
      reason: "new material",
      outcome: "REDESIGN",
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data.changeRequestId) return;

    const wi = await testDb.workItem.findUniqueOrThrow({
      where: { id: item.workItemId },
    });
    expect(wi.state).toBe("REWORK_REQUIRED");
    expect(wi.material).toBe("Paper");

    const transition = await testDb.workItemTransition.findFirst({
      where: { workItemId: item.workItemId, to: "REWORK_REQUIRED" },
      orderBy: { at: "desc" },
    });
    expect(transition?.rejectionCategory).toBe("CUSTOMER_CHANGE");

    const cr = await testDb.changeRequest.findUniqueOrThrow({
      where: { id: res.data.changeRequestId },
      include: { return: true },
    });
    expect(cr.isAdminOverride).toBe(true);
    expect(cr.outcome).toBe("REDESIGN");
    expect(cr.return?.category).toBe("CUSTOMER_CHANGE");
    expect(cr.return?.originDepartmentId).toBe(item.departmentId);
    expect(await openActiveSegments(item.workItemId)).toBe(0);
  });

  it("REDESIGN without an assignee → REDESIGN_NOT_ALLOWED, nothing written", async () => {
    const item = await createProductionItem({ withAssignee: false });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 800 },
      reason: "r",
      outcome: "REDESIGN",
    });
    expect(res).toEqual({ ok: false, error: { code: "REDESIGN_NOT_ALLOWED" } });
    expect(
      await testDb.changeRequest.count({
        where: { workItemId: item.workItemId },
      }),
    ).toBe(0);
  });

  it("without an outcome → VALIDATION, nothing written", async () => {
    const item = await createProductionItem();
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 800 },
      reason: "r",
    });
    expect(!res.ok && res.error.code).toBe("VALIDATION");
    expect(
      await testDb.changeRequest.count({
        where: { workItemId: item.workItemId },
      }),
    ).toBe(0);
    expect(
      await testDb.specVersion.count({
        where: { workItemId: item.workItemId },
      }),
    ).toBe(1);
  });

  it("a stale expectedVersion → STALE_SPEC_VERSION and the override request rolls back", async () => {
    const item = await createProductionItem();
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 7,
      patch: { quantity: 800 },
      reason: "r",
      outcome: "CONTINUE_PRODUCTION",
    });
    expect(!res.ok && res.error.code).toBe("STALE_SPEC_VERSION");
    expect(
      await testDb.changeRequest.count({
        where: { workItemId: item.workItemId },
      }),
    ).toBe(0);
  });
});

describe("T068 — refusals (US7-5, US7-6)", () => {
  it("a pending request → CHANGE_REQUEST_PENDING", async () => {
    const item = await createProductionItem();
    await requestChange(item);
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 900 },
      reason: "r",
      outcome: "CONTINUE_PRODUCTION",
    });
    expect(res).toEqual({
      ok: false,
      error: { code: "CHANGE_REQUEST_PENDING" },
    });
  });

  it("an unacknowledged CONTINUE_PRODUCTION approval → REVISION_UNACKNOWLEDGED", async () => {
    const item = await createProductionItem();
    const crId = await requestChange(item);
    const approved = await approveChangeRequest(
      approverActor(await seedUser()),
      {
        changeRequestId: crId,
        outcome: "CONTINUE_PRODUCTION",
      },
    );
    expect(approved.ok).toBe(true);

    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 2,
      patch: { quantity: 900 },
      reason: "r",
      outcome: "REDESIGN",
    });
    expect(res).toEqual({
      ok: false,
      error: { code: "REVISION_UNACKNOWLEDGED" },
    });
  });

  it("CANCELLED → WORK_ITEM_LOCKED", async () => {
    const item = await createProductionItem({ state: "CANCELLED" });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 900 },
      reason: "r",
    });
    expect(res).toEqual({ ok: false, error: { code: "WORK_ITEM_LOCKED" } });
  });

  it("a stale expectedVersion after production → STALE_SPEC_VERSION", async () => {
    const item = await createProductionItem({ state: "COMPLETED" });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 2,
      patch: { quantity: 900 },
      reason: "r",
    });
    expect(res).toEqual({
      ok: false,
      error: { code: "STALE_SPEC_VERSION", currentVersion: 1 },
    });
  });

  it("an outcome outside production → VALIDATION", async () => {
    const item = await createProductionItem({ state: "DELIVERED" });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 900 },
      reason: "r",
      outcome: "CONTINUE_PRODUCTION",
    });
    expect(!res.ok && res.error.code).toBe("VALIDATION");
  });
});

describe("T068 — before production follows editSpec's designChoice rule", () => {
  it("APPROVED + requiresDesign without designChoice → REDESIGN_CHOICE_REQUIRED", async () => {
    const item = await createProductionItem({ state: "APPROVED" });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 900 },
      reason: "r",
    });
    expect(res).toEqual({
      ok: false,
      error: { code: "REDESIGN_CHOICE_REQUIRED" },
    });
  });

  it("APPROVED + KEEP_DESIGN → new version, state kept", async () => {
    const item = await createProductionItem({ state: "APPROVED" });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 900 },
      reason: "r",
      designChoice: "KEEP_DESIGN",
    });
    expect(res).toEqual({
      ok: true,
      data: { version: 2, changeRequestId: null },
    });
    const wi = await testDb.workItem.findUniqueOrThrow({
      where: { id: item.workItemId },
    });
    expect(wi.state).toBe("APPROVED");
  });

  it("APPROVED + REDESIGN → REWORK_REQUIRED with a CUSTOMER_CHANGE Return", async () => {
    const item = await createProductionItem({ state: "APPROVED" });
    const res = await adminOverrideSpec(await newAdmin(), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { material: "Paper" },
      reason: "customer change",
      designChoice: "REDESIGN",
    });
    expect(res.ok).toBe(true);
    const wi = await testDb.workItem.findUniqueOrThrow({
      where: { id: item.workItemId },
    });
    expect(wi.state).toBe("REWORK_REQUIRED");
    const transition = await testDb.workItemTransition.findFirst({
      where: { workItemId: item.workItemId, to: "REWORK_REQUIRED" },
      orderBy: { at: "desc" },
    });
    expect(transition?.rejectionCategory).toBe("CUSTOMER_CHANGE");
    expect(
      await testDb.auditEvent.count({
        where: {
          action: "workitem.returned_for_customer_change",
          entityId: item.workItemId,
        },
      }),
    ).toBe(1);
  });
});
