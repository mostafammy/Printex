// tests/integration/changes/lateCancellation.test.ts
// User Story 6: late cancellation. tasks.md T062, spec FR-024–026.

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedUser } from "../../helpers/seed";
import type { WorkItemState } from "~/server/core";
import {
  cancelAfterProductionStarted,
  createChangeRequest,
  setDirectCostPort,
  type LateCancellationCost,
} from "~/server/changes";
import { __resetDirectCostPortForTests } from "~/server/changes/ports";
import { __resetSpecChangeListenersForTests } from "~/server/changes/events";
import {
  approverActor,
  createProductionItem,
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

afterEach(() => {
  __resetDirectCostPortForTests();
});

function spyPort() {
  const calls: LateCancellationCost[] = [];
  setDirectCostPort({
    async recordLateCancellationCost(_tx, cost) {
      calls.push(cost);
    },
  });
  return calls;
}

async function stateOf(workItemId: string): Promise<WorkItemState> {
  return (await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } })).state;
}

const LATE_STATES = ["IN_PRODUCTION", "PRODUCTION_COMPLETED", "READY_FOR_COLLECTION"] as const;

describe("T062 — cancelAfterProductionStarted", () => {
  for (const state of LATE_STATES) {
    it(`cancels from ${state}, records the loss, and hands it to the port once (US6-1)`, async () => {
      const calls = spyPort();
      const item = await createProductionItem({ state, timerRunning: true });
      const actorId = await seedUser();

      const res = await cancelAfterProductionStarted(receptionActor(actorId), {
        workItemId: item.workItemId,
        reason: "customer withdrew",
        costIncurred: "350",
        producedQuantitySoFar: 120,
        costNote: "ink and vinyl",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const { lateCancellationId } = res.data;

      expect(await stateOf(item.workItemId)).toBe("CANCELLED");

      const row = await testDb.lateCancellation.findUniqueOrThrow({ where: { id: lateCancellationId } });
      expect(row.costIncurred.toFixed(2)).toBe("350.00");
      expect(row.currency).toBe("EGP");
      expect(row.reason).toBe("customer withdrew");
      expect(row.stateAtCancellation).toBe(state);
      expect(row.producedQuantitySoFar).toBe(120);
      expect(row.costNote).toBe("ink and vinyl");
      expect(row.createdById).toBe(actorId);

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        lateCancellationId,
        workItemId: item.workItemId,
        orderId: item.orderId,
        amount: "350.00",
        currency: "EGP",
        reason: "customer withdrew",
        recordedById: actorId,
        recordedAt: row.createdAt,
      });

      expect(await openActiveSegments(item.workItemId)).toBe(0);

      const transition = await testDb.workItemTransition.findFirstOrThrow({
        where: { workItemId: item.workItemId, to: "CANCELLED" },
      });
      expect(transition.from).toBe(state);
      expect(transition.meta).toEqual({ changeControl: "LATE_CANCELLATION", lateCancellationId });

      const audit = await testDb.auditEvent.findFirstOrThrow({
        where: { action: "workitem.late_cancelled", entityId: item.workItemId },
      });
      expect(audit.actorId).toBe(actorId);
      expect(audit.before).toEqual({ state });

      const notification = await testDb.notificationEvent.findFirstOrThrow({
        where: { type: "work_item.late_cancelled", entityId: item.workItemId },
      });
      expect(notification.recipientUserIds).toEqual([item.creatorId]);
      expect(notification.recipientDepartmentIds).toEqual([item.departmentId]);
    });
  }

  it.each([
    ["missing reason", { reason: "", costIncurred: "10" }],
    ["missing cost", { reason: "r" }],
    ["negative cost", { reason: "r", costIncurred: "-5" }],
    ["three decimals", { reason: "r", costIncurred: "1.234" }],
  ])("%s → VALIDATION, Work Item unchanged (US6-2)", async (_label, patch) => {
    const calls = spyPort();
    const item = await createProductionItem();

    const res = await cancelAfterProductionStarted(receptionActor(await seedUser()), {
      workItemId: item.workItemId,
      ...patch,
    } as Parameters<typeof cancelAfterProductionStarted>[1]);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
    expect(await stateOf(item.workItemId)).toBe("IN_PRODUCTION");
    expect(await testDb.lateCancellation.count({ where: { workItemId: item.workItemId } })).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it.each(["NEW", "READY_FOR_PRODUCTION", "DELIVERED", "CANCELLED"] as const)(
    "%s → LATE_CANCEL_NOT_APPLICABLE (US6-5)",
    async (state) => {
      const calls = spyPort();
      const item = await createProductionItem({ state });

      const res = await cancelAfterProductionStarted(receptionActor(await seedUser()), {
        workItemId: item.workItemId,
        reason: "r",
        costIncurred: "1.00",
      });

      expect(res).toEqual({ ok: false, error: { code: "LATE_CANCEL_NOT_APPLICABLE" } });
      expect(await stateOf(item.workItemId)).toBe(state);
      expect(await testDb.lateCancellation.count({ where: { workItemId: item.workItemId } })).toBe(0);
      expect(calls).toHaveLength(0);
    },
  );

  it("closes a pending change request as CLOSED_BY_CANCELLATION and audits it (US6-4)", async () => {
    const item = await createProductionItem();
    const created = await createChangeRequest(receptionActor(await seedUser()), {
      workItemId: item.workItemId,
      patch: { quantity: 900 },
      reason: "customer called",
    });
    if (!created.ok) throw new Error(`create failed: ${created.error.code}`);
    const crId = created.data.changeRequestId;

    const res = await cancelAfterProductionStarted(receptionActor(await seedUser()), {
      workItemId: item.workItemId,
      reason: "customer withdrew",
      costIncurred: "0",
    });
    expect(res.ok).toBe(true);

    const cr = await testDb.changeRequest.findUniqueOrThrow({ where: { id: crId } });
    expect(cr.status).toBe("CLOSED_BY_CANCELLATION");
    expect(cr.decidedAt).not.toBeNull();
    expect(
      await testDb.auditEvent.count({
        where: { action: "change_request.closed_by_cancellation", entityId: crId },
      }),
    ).toBe(1);
    expect(await stateOf(item.workItemId)).toBe("CANCELLED");
  });

  it("rolls everything back when the port throws", async () => {
    setDirectCostPort({
      async recordLateCancellationCost() {
        throw new Error("finance unavailable");
      },
    });
    const item = await createProductionItem({ timerRunning: true });
    const created = await createChangeRequest(receptionActor(await seedUser()), {
      workItemId: item.workItemId,
      patch: { quantity: 900 },
      reason: "customer called",
    });
    if (!created.ok) throw new Error(`create failed: ${created.error.code}`);

    await expect(
      cancelAfterProductionStarted(receptionActor(await seedUser()), {
        workItemId: item.workItemId,
        reason: "customer withdrew",
        costIncurred: "350",
      }),
    ).rejects.toThrow("finance unavailable");

    expect(await stateOf(item.workItemId)).toBe("IN_PRODUCTION");
    expect(await testDb.lateCancellation.count({ where: { workItemId: item.workItemId } })).toBe(0);
    const cr = await testDb.changeRequest.findUniqueOrThrow({
      where: { id: created.data.changeRequestId },
    });
    expect(cr.status).toBe("PENDING");
    expect(
      await testDb.auditEvent.count({
        where: { action: "workitem.late_cancelled", entityId: item.workItemId },
      }),
    ).toBe(0);
    expect(
      await testDb.workItemTransition.count({ where: { workItemId: item.workItemId, to: "CANCELLED" } }),
    ).toBe(0);
  });

  it("refuses PRODUCTION_OPERATOR and HEAD_DESIGNER (no order.cancel)", async () => {
    const calls = spyPort();
    const item = await createProductionItem();
    const input = { workItemId: item.workItemId, reason: "r", costIncurred: "1" };

    const operator = await cancelAfterProductionStarted(
      operatorActor(await seedUser(), item.departmentId),
      input,
    );
    const designer = await cancelAfterProductionStarted(approverActor(await seedUser()), input);

    expect(operator).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
    expect(designer).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await stateOf(item.workItemId)).toBe("IN_PRODUCTION");
    expect(calls).toHaveLength(0);
  });
});
