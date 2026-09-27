// tests/integration/changes/productionHold.test.ts
// User Story 3: the production hold. tasks.md T040, spec FR-012, FR-014, SC-004.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedUser } from "../../helpers/seed";
import { asUserId, asWorkItemId, transitionWorkItem } from "~/server/core";
import {
  acknowledgeSpecRevision,
  approveChangeRequest,
  createChangeRequest,
  getProductionHold,
  rejectChangeRequest,
  withdrawChangeRequest,
} from "~/server/changes";
import { __resetSpecChangeListenersForTests } from "~/server/changes/events";
import {
  completeProduction,
  resumeProduction,
  sendBackToDesign,
  DomainProductionError,
} from "~/server/production";
import {
  approverActor,
  createProductionItem,
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

async function requestChange(item: ProductionItem, quantity = 800): Promise<string> {
  const res = await createChangeRequest(receptionActor(await seedUser()), {
    workItemId: item.workItemId,
    patch: { quantity },
    reason: "customer called",
  });
  if (!res.ok) throw new Error(`create failed: ${res.error.code}`);
  return res.data.changeRequestId;
}

async function approveContinue(changeRequestId: string): Promise<void> {
  const res = await approveChangeRequest(approverActor(await seedUser()), {
    changeRequestId,
    outcome: "CONTINUE_PRODUCTION",
  });
  if (!res.ok) throw new Error(`approve failed: ${res.error.code}`);
}

/** The three floor actions a hold must block, each reporting how it was refused. */
async function floorActions(item: ProductionItem, operatorId: string) {
  const operator = operatorActor(operatorId, item.departmentId);
  const settle = async (p: Promise<unknown>) => {
    try {
      await p;
      return "ok";
    } catch (e) {
      if (e instanceof DomainProductionError) return e.code;
      const guardCode = (e as { error?: { details?: { guardCode?: string } } }).error?.details
        ?.guardCode;
      return guardCode ?? String(e);
    }
  };
  return {
    resume: await settle(resumeProduction(operator, item.workItemId)),
    complete: await settle(completeProduction(operator, item.workItemId, { producedQuantity: 1 })),
    sendBack: await settle(sendBackToDesign(operator, item.workItemId, { reason: "fix" })),
  };
}

const ALL_HELD = { resume: "CHANGE_HOLD", complete: "CHANGE_HOLD", sendBack: "CHANGE_HOLD" };

describe("T040 — production hold", () => {
  it("while PENDING, resume/complete/send-back are all refused (US3-2, FR-012, SC-004)", async () => {
    const item = await createProductionItem();
    const crId = await requestChange(item);

    expect(await getProductionHold(testDb, item.workItemId)).toEqual({
      kind: "CHANGE_PENDING",
      changeRequestId: crId,
    });
    expect(await floorActions(item, await seedUser())).toEqual(ALL_HELD);
    expect((await testDb.workItem.findUniqueOrThrow({ where: { id: item.workItemId } })).state).toBe(
      "IN_PRODUCTION",
    );
  });

  it("after CONTINUE_PRODUCTION the hold stays until acknowledged, then resume and complete work (US3-4, FR-014)", async () => {
    const item = await createProductionItem();
    const crId = await requestChange(item);
    await approveContinue(crId);

    expect(await getProductionHold(testDb, item.workItemId)).toEqual({
      kind: "REVISION_UNACKNOWLEDGED",
      changeRequestId: crId,
    });
    expect(await floorActions(item, await seedUser())).toEqual(ALL_HELD);

    const operatorId = await seedUser();
    const ack = await acknowledgeSpecRevision(operatorActor(operatorId, item.departmentId), {
      workItemId: item.workItemId,
    });
    expect(ack).toEqual({ ok: true, data: null });
    expect(await getProductionHold(testDb, item.workItemId)).toBeNull();

    const cr = await testDb.changeRequest.findUniqueOrThrow({ where: { id: crId } });
    expect(cr.productionAcknowledgedById).toBe(operatorId);
    expect(
      await testDb.auditEvent.count({ where: { action: "change_request.acknowledged", entityId: crId } }),
    ).toBe(1);

    const operator = operatorActor(operatorId, item.departmentId);
    await resumeProduction(operator, item.workItemId);
    await completeProduction(operator, item.workItemId, { producedQuantity: 800 });
    expect((await testDb.workItem.findUniqueOrThrow({ where: { id: item.workItemId } })).state).toBe(
      "PRODUCTION_COMPLETED",
    );
  });

  it("an operator of another department cannot acknowledge", async () => {
    const item = await createProductionItem();
    await approveContinue(await requestChange(item));
    const otherDept = await testDb.department.create({ data: { name: `Other_${Date.now()}` } });

    const res = await acknowledgeSpecRevision(operatorActor(await seedUser(), otherDept.id), {
      workItemId: item.workItemId,
    });
    expect(res).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("nothing to acknowledge: no revision, or a CHANGE_PENDING hold that stays", async () => {
    const item = await createProductionItem();
    const operator = operatorActor(await seedUser(), item.departmentId);
    expect(await acknowledgeSpecRevision(operator, { workItemId: item.workItemId })).toEqual({
      ok: false,
      error: { code: "NOTHING_TO_ACKNOWLEDGE" },
    });

    const crId = await requestChange(item);
    expect(await acknowledgeSpecRevision(operator, { workItemId: item.workItemId })).toEqual({
      ok: false,
      error: { code: "NOTHING_TO_ACKNOWLEDGE" },
    });
    expect(await getProductionHold(testDb, item.workItemId)).toEqual({
      kind: "CHANGE_PENDING",
      changeRequestId: crId,
    });
  });

  it("two unacknowledged approvals are cleared by one acknowledgment (two audits)", async () => {
    const item = await createProductionItem();
    const first = await requestChange(item, 800);
    await approveContinue(first);
    const second = await requestChange(item, 900);
    await approveContinue(second);

    const res = await acknowledgeSpecRevision(operatorActor(await seedUser(), item.departmentId), {
      workItemId: item.workItemId,
    });
    expect(res.ok).toBe(true);
    expect(await getProductionHold(testDb, item.workItemId)).toBeNull();
    expect(
      await testDb.auditEvent.count({
        where: { action: "change_request.acknowledged", entityId: { in: [first, second] } },
      }),
    ).toBe(2);
  });

  it.each(["reject", "withdraw"] as const)(
    "after %s, resume succeeds with no acknowledgment (US3-6)",
    async (kind) => {
      const item = await createProductionItem();
      const crId = await requestChange(item);
      const res =
        kind === "reject"
          ? await rejectChangeRequest(approverActor(await seedUser()), { changeRequestId: crId, reason: "no" })
          : await withdrawChangeRequest(receptionActor(await seedUser()), {
              changeRequestId: crId,
              reason: "never mind",
            });
      expect(res.ok).toBe(true);
      expect(await getProductionHold(testDb, item.workItemId)).toBeNull();
      await expect(
        resumeProduction(operatorActor(await seedUser(), item.departmentId), item.workItemId),
      ).resolves.toBeUndefined();
    },
  );

  it("a raw transition to REWORK_REQUIRED with another request's id is GUARD_FAILED", async () => {
    const item = await createProductionItem();
    await requestChange(item);
    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, {
        workItemId: asWorkItemId(item.workItemId),
        to: "REWORK_REQUIRED",
        actor: { userId: asUserId(item.creatorId), roles: [], departmentIds: [] },
        reason: "sneaky",
        rejectionCategory: "CUSTOMER_CHANGE",
        meta: { changeControl: "CHANGE_REQUEST_APPROVAL", changeRequestId: "not-the-pending-one" },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("GUARD_FAILED");
    expect(result.error.details).toMatchObject({ guardCode: "CHANGE_HOLD" });
  });
});
