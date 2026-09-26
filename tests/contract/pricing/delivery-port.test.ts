// Contract test for the 015 delivery port binding — tasks.md T027, US4.
// 051 binds 015's PricingGatePort at barrel load and does NOT register a
// second guard on READY_FOR_COLLECTION -> DELIVERED (015 owns that edge).

import { afterAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  getFailClosedPricingGatePort,
  getPricingGatePort,
  pricingGateProvider,
} from "~/server/pricing";
import { asOrderId, asUserId, asWorkItemId, runGuards } from "~/server/core";
import type { GuardContext } from "~/server/core";

afterAll(async () => {
  await testDb.$disconnect();
});

const deliveryContext: GuardContext = {
  workItem: {
    id: asWorkItemId("wi_contract_delivery"),
    orderId: asOrderId("order_contract_delivery"),
    productTypeId: null,
    departmentId: null,
    state: "READY_FOR_COLLECTION",
    requiresDesign: false,
    requiresReview: false,
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  actor: { userId: asUserId("actor_contract_delivery"), roles: [], departmentIds: [] },
};

describe("PricingGatePort binding (contract, US4)", () => {
  it("binds the 051 provider as the active pricing gate port at barrel load", () => {
    expect(getPricingGatePort()).toBe(pricingGateProvider);
  });

  it("does not register a duplicate READY_FOR_COLLECTION -> DELIVERED guard", async () => {
    // 015 owns that edge. If 051 had registered its own guard, the registry
    // would reject or fail this run; no guard exists yet, so it passes.
    const result = await runGuards("READY_FOR_COLLECTION", "DELIVERED", deliveryContext);
    expect(result.ok).toBe(true);
  });

  it("exposes a fail-closed port for the unbound case", async () => {
    const failClosed = getFailClosedPricingGatePort();
    expect(failClosed).not.toBe(pricingGateProvider);

    const statuses = await failClosed.getPricingStatus(["any-work-item"]);
    expect(statuses.get("any-work-item")).toEqual({
      status: "PENDING",
      waitingSince: null,
      responsible: { label: "Pricing review required", userIds: [] },
    });
  });

  it("returns an entry for every requested id, batched", async () => {
    const statuses = await getPricingGatePort().getPricingStatus([
      "missing_a",
      "missing_b",
      "missing_a",
    ]);
    expect([...statuses.keys()].sort()).toEqual(["missing_a", "missing_b"]);
    for (const value of statuses.values()) expect(value.status).toBe("PENDING");
  });
});
