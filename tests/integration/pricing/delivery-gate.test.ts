// Integration test for the delivery pricing gate — tasks.md T026, US4.
// 015 does not exist in this tree yet, so the delivery guard is represented
// by the sanctioned test double from quickstart.md: a guard built purely on
// 051's bound PricingGatePort, registered on READY_FOR_COLLECTION -> DELIVERED
// exactly as 015's contract describes. Covers one-pending / all-priced /
// disputed / urgent / missing-provider fail-closed and
// production-before-pricing (quickstart scenario 5).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  seedCustomer,
  seedOrderWithWorkItem,
  seedPriceList,
  seedPricingPolicy,
  seedPricingUser,
  seedProductType,
} from "../../helpers/pricingSeed";
import { getFailClosedPricingGatePort, getPricingGatePort, setPrice } from "~/server/pricing";
import { asUserId, asWorkItemId, registerGuard, transitionWorkItem } from "~/server/core";
import type { Actor as CoreActor, GuardFn } from "~/server/core";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

// --- 015 stand-in: the delivery guard built on the bound port -------------
const deliveryPricingGuard: GuardFn = async (ctx) => {
  const statuses = await getPricingGatePort().getPricingStatus([ctx.workItem.id]);
  const entry = statuses.get(ctx.workItem.id);
  if (entry?.status === "RESOLVED" || entry?.status === "NOT_REQUIRED") {
    return { ok: true, value: true };
  }
  return {
    ok: false,
    error: { code: "PRICING_UNRESOLVED", message: "Pricing is unresolved for this work item." },
  };
};
registerGuard({ from: "READY_FOR_COLLECTION", to: "DELIVERED" }, deliveryPricingGuard);
// --------------------------------------------------------------------------

let pricingUser: Actor;
let coreActor: CoreActor;
let customerId: string;
let variableProductId: string;

beforeAll(async () => {
  pricingUser = await seedPricingUser("delivery-gate", [
    "pricing.use_fixed",
    "pricing.set_variable",
  ]);
  coreActor = { userId: asUserId(pricingUser.userId), roles: [], departmentIds: [] };
  customerId = await seedCustomer("Delivery");
  variableProductId = await seedProductType("DeliveryProduct");
  await seedPricingPolicy(variableProductId, "VARIABLE", pricingUser.userId);
  await seedPriceList({
    productTypeId: variableProductId,
    unit: "PIECE",
    createdById: pricingUser.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "10" }],
  });
});

async function seedPendingWorkItem(options?: {
  readonly priority?: "NORMAL" | "URGENT";
  readonly state?: "READY_FOR_PRODUCTION" | "IN_PRODUCTION";
}): Promise<string> {
  const { workItemId } = await seedOrderWithWorkItem({
    customerId,
    createdById: pricingUser.userId,
    productTypeId: variableProductId,
    quantity: 1,
    priority: options?.priority ?? "NORMAL",
    state: options?.state ?? "READY_FOR_PRODUCTION",
  });
  await testDb.pricingStatus.create({
    data: { workItemId, status: "PENDING", waitingSince: new Date("2026-03-01T00:00:00.000Z") },
  });
  return workItemId;
}

async function driveToReadyForCollection(workItemId: string): Promise<void> {
  for (const to of ["IN_PRODUCTION", "PRODUCTION_COMPLETED", "READY_FOR_COLLECTION"] as const) {
    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, { workItemId: asWorkItemId(workItemId), to, actor: coreActor }),
    );
    if (!result.ok) {
      throw new Error(`transition to ${to} failed: ${JSON.stringify(result.error)}`);
    }
  }
}

async function attemptDelivery(workItemId: string) {
  return testDb.$transaction((tx) =>
    transitionWorkItem(tx, { workItemId: asWorkItemId(workItemId), to: "DELIVERED", actor: coreActor }),
  );
}

describe("delivery pricing gate (integration, US4)", () => {
  it("keeps production available while pricing is still PENDING", async () => {
    const workItemId = await seedPendingWorkItem({ state: "READY_FOR_PRODUCTION" });

    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, { workItemId: asWorkItemId(workItemId), to: "IN_PRODUCTION", actor: coreActor }),
    );

    expect(result.ok).toBe(true);
    const item = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(item.state).toBe("IN_PRODUCTION");
    const pricing = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId } });
    expect(pricing.status).toBe("PENDING");
  });

  it("blocks delivery of one PENDING item without changing workflow state", async () => {
    const workItemId = await seedPendingWorkItem();
    await driveToReadyForCollection(workItemId);

    const result = await attemptDelivery(workItemId);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("GUARD_FAILED");
    expect(result.error.details).toMatchObject({ guardCode: "PRICING_UNRESOLVED" });

    const item = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(item.state).toBe("READY_FOR_COLLECTION");
    const delivered = await testDb.workItemTransition.count({
      where: { workItemId, to: "DELIVERED" },
    });
    expect(delivered).toBe(0);
  });

  it("blocks delivery of an URGENT job while pricing is pending", async () => {
    const workItemId = await seedPendingWorkItem({ priority: "URGENT" });
    await driveToReadyForCollection(workItemId);

    const result = await attemptDelivery(workItemId);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toMatchObject({ guardCode: "PRICING_UNRESOLVED" });
  });

  it("maps DISPUTED pricing to unresolved PENDING with waitingSince and responsible users", async () => {
    const workItemId = await seedPendingWorkItem();
    const waitingSince = new Date("2026-03-02T08:00:00.000Z");
    await testDb.pricingStatus.update({
      where: { workItemId },
      data: { status: "DISPUTED", waitingSince, disputeReason: "Wrong area billed" },
    });
    await driveToReadyForCollection(workItemId);

    const statuses = await getPricingGatePort().getPricingStatus([workItemId]);
    const entry = statuses.get(workItemId);
    expect(entry?.status).toBe("PENDING");
    if (entry?.status !== "PENDING") return;
    expect(entry.waitingSince?.toISOString()).toBe(waitingSince.toISOString());
    expect(entry.responsible.userIds).toContain(pricingUser.userId);

    const result = await attemptDelivery(workItemId);
    expect(result.ok).toBe(false);
  });

  it("reports every priced item as RESOLVED in one batched read", async () => {
    const pricedIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const { workItemId } = await seedOrderWithWorkItem({
        customerId,
        createdById: pricingUser.userId,
        productTypeId: variableProductId,
        quantity: 1,
      });
      await setPrice(pricingUser, {
        workItemId,
        kind: "VARIABLE",
        amount: "10",
        reason: `priced batch ${index}`,
      });
      pricedIds.push(workItemId);
    }

    const statuses = await getPricingGatePort().getPricingStatus(pricedIds);
    expect(statuses.size).toBe(pricedIds.length);
    for (const workItemId of pricedIds) {
      expect(statuses.get(workItemId)).toEqual({ status: "RESOLVED" });
    }
  });

  it("fails closed for missing provider data, on both ports", async () => {
    const statuses = await getPricingGatePort().getPricingStatus(["no_status_row"]);
    const missing = statuses.get("no_status_row");
    expect(missing).toMatchObject({ status: "PENDING", waitingSince: null });
    if (missing?.status !== "PENDING") return;
    expect(missing.responsible.userIds).toContain(pricingUser.userId);

    const failClosed = await getFailClosedPricingGatePort().getPricingStatus(["no_status_row"]);
    expect(failClosed.get("no_status_row")?.status).toBe("PENDING");
  });

  it("permits the existing delivery transition once the item is priced", async () => {
    const workItemId = await seedPendingWorkItem();
    await driveToReadyForCollection(workItemId);

    const blocked = await attemptDelivery(workItemId);
    expect(blocked.ok).toBe(false);

    await setPrice(pricingUser, {
      workItemId,
      kind: "VARIABLE",
      amount: "15",
      reason: "priced after dispute window",
    });

    const delivered = await attemptDelivery(workItemId);
    expect(delivered.ok).toBe(true);
    if (!delivered.ok) return;
    expect(delivered.value.state).toBe("DELIVERED");
  });
});
