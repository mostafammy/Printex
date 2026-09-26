// tests/integration/changes/cancelPaths.test.ts
// User Story 6: ordinary cancel paths cannot cancel after production started.
// tasks.md T063, spec FR-026.

import { afterAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedUser, seedWorkItem } from "../../helpers/seed";
import { asOrderId, asUserId, asWorkItemId, transitionWorkItem, type WorkItemState } from "~/server/core";
import { cancelOrder, cancelWorkItem, WorkItemTransitionError } from "~/server/orders";
import { createProductionItem, receptionActor } from "./productionFactory";

afterAll(async () => {
  await testDb.$disconnect();
});

async function stateOf(workItemId: string): Promise<WorkItemState> {
  return (await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } })).state;
}

async function cancelError(workItemId: string): Promise<unknown> {
  try {
    await cancelWorkItem(receptionActor(await seedUser()), workItemId, "customer cancelled");
    return null;
  } catch (e) {
    return e;
  }
}

describe("T063 — ordinary cancel paths", () => {
  it.each(["IN_PRODUCTION", "PRODUCTION_COMPLETED", "READY_FOR_COLLECTION"] as const)(
    "cancelWorkItem on %s → LATE_CANCELLATION_REQUIRED, state unchanged (US6-3)",
    async (state) => {
      const item = await createProductionItem({ state });

      const e = await cancelError(item.workItemId);

      expect(e).toBeInstanceOf(WorkItemTransitionError);
      expect((e as WorkItemTransitionError).error).toMatchObject({
        code: "GUARD_FAILED",
        details: { guardCode: "LATE_CANCELLATION_REQUIRED" },
      });
      expect(await stateOf(item.workItemId)).toBe(state);
    },
  );

  it("cancelOrder on a mixed order cancels NEW and lists the in-production item", async () => {
    const item = await createProductionItem({ state: "IN_PRODUCTION" });
    const newItemId = await seedWorkItem({ orderId: asOrderId(item.orderId), state: "NEW" });

    const result = await cancelOrder(receptionActor(await seedUser()), item.orderId, "customer left");

    expect(result.cancelledWorkItemIds).toEqual([newItemId]);
    expect(result.requiresLateCancellation).toEqual([item.workItemId]);
    expect(await stateOf(newItemId)).toBe("CANCELLED");
    expect(await stateOf(item.workItemId)).toBe("IN_PRODUCTION");
  });

  it("a raw transition IN_PRODUCTION → CANCELLED without the marker fails its guard", async () => {
    const item = await createProductionItem({ state: "IN_PRODUCTION" });

    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, {
        workItemId: asWorkItemId(item.workItemId),
        to: "CANCELLED",
        actor: { userId: asUserId(item.creatorId), roles: [], departmentIds: [] },
        reason: "raw",
        meta: { note: "no marker" },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("GUARD_FAILED");
      expect(result.error.details).toEqual({ guardCode: "LATE_CANCELLATION_REQUIRED" });
    }
    expect(await stateOf(item.workItemId)).toBe("IN_PRODUCTION");
  });

  it.each(["NEW", "IN_DESIGN", "READY_FOR_PRODUCTION"] as const)(
    "regression: cancelWorkItem on %s still succeeds",
    async (state) => {
      const item = await createProductionItem({ state });

      expect(await cancelError(item.workItemId)).toBeNull();
      expect(await stateOf(item.workItemId)).toBe("CANCELLED");
    },
  );
});
