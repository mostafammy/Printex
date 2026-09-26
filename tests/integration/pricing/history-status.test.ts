// Integration test for status/history queries — tasks.md T022, US3.
// Pricing status is independent of workflow state, DISPUTED stays
// unresolved, waitingSince persists while unresolved, and history is
// readable with actor/reason/source data (quickstart scenarios 4 and 6).

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
import { getCurrentPrice, getPriceHistory, pendingSince, setPrice, status } from "~/server/pricing";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let setter: Actor;
let customerId: string;
let productId: string;

beforeAll(async () => {
  setter = await seedPricingUser("history-status", ["pricing.set_variable"]);
  customerId = await seedCustomer("Status");
  productId = await seedProductType("StatusProduct");
  await seedPricingPolicy(productId, "VARIABLE", setter.userId);
  await seedPriceList({
    productTypeId: productId,
    unit: "PIECE",
    createdById: setter.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "10" }],
  });
});

async function workItem(state?: "NEW" | "IN_PRODUCTION"): Promise<{ workItemId: string; orderId: string }> {
  return seedOrderWithWorkItem({
    customerId,
    createdById: setter.userId,
    productTypeId: productId,
    quantity: 3,
    state,
  });
}

describe("pricing status and history (integration, US3)", () => {
  it("keeps pricing status independent from workflow state during IN_PRODUCTION", async () => {
    const { workItemId } = await workItem("IN_PRODUCTION");
    await testDb.pricingStatus.create({
      data: { workItemId, status: "PENDING", waitingSince: new Date() },
    });

    const item = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(item.state).toBe("IN_PRODUCTION");

    const result = await status(workItemId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PENDING");
    expect(result.value.waitingSince).not.toBeNull();
  });

  it("reports DISPUTED as unresolved with its reason and waiting timestamp", async () => {
    const { workItemId } = await workItem();
    const waitingSince = new Date("2026-03-01T09:30:00.000Z");
    await testDb.pricingStatus.create({
      data: {
        workItemId,
        status: "DISPUTED",
        waitingSince,
        disputeReason: "Customer says the quoted area is wrong",
      },
    });

    const result = await status(workItemId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("DISPUTED");
    expect(result.value.disputeReason).toBe("Customer says the quoted area is wrong");
    expect(result.value.waitingSince?.toISOString()).toBe(waitingSince.toISOString());

    // Unresolved statuses keep exposing their waiting timestamp to 053.
    const pending = await pendingSince(workItemId);
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;
    expect(pending.value?.toISOString()).toBe(waitingSince.toISOString());
  });

  it("clears waitingSince once priced and reports no pending age", async () => {
    const { workItemId } = await workItem();
    await testDb.pricingStatus.create({
      data: { workItemId, status: "PENDING", waitingSince: new Date("2026-02-01T00:00:00.000Z") },
    });

    await setPrice(setter, { workItemId, kind: "VARIABLE", amount: "30", reason: "priced now" });

    const result = await status(workItemId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PRICED");
    expect(result.value.waitingSince).toBeNull();

    const pending = await pendingSince(workItemId);
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;
    expect(pending.value).toBeNull();
  });

  it("fails closed to PENDING when the current price association is stale", async () => {
    const { workItemId } = await workItem();
    await setPrice(setter, { workItemId, kind: "VARIABLE", amount: "30", reason: "first" });
    // Simulate a stale current-price pointer (e.g. after out-of-band loss).
    await testDb.pricingStatus.update({
      where: { workItemId },
      data: { currentPriceId: "missing_price_row" },
    });

    const result = await status(workItemId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PENDING");
    expect(result.value.currentPriceId).toBeNull();
  });

  it("returns PRICE_NOT_FOUND for an unknown work item", async () => {
    const result = await status("does_not_exist");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PRICE_NOT_FOUND");
  });

  it("renders readable history with actor, reason, source, and current price", async () => {
    const { workItemId } = await workItem();
    const first = await setPrice(setter, {
      workItemId,
      kind: "VARIABLE",
      amount: "10",
      reason: "first decision",
    });
    const second = await setPrice(setter, {
      workItemId,
      kind: "VARIABLE",
      amount: "12",
      reason: "second decision",
    });

    const history = await getPriceHistory(workItemId);
    expect(history).toHaveLength(2);
    expect(history[0]?.id).toBe(second.id);
    expect(history[0]?.reason).toBe("second decision");
    expect(history[1]?.reason).toBe("first decision");
    expect(history[1]?.setByName).toBe("Test history-status");
    expect(history[1]?.setById).toBe(setter.userId);
    expect(history[1]?.setAt).toBeInstanceOf(Date);

    const current = await getCurrentPrice(workItemId);
    expect(current?.id).toBe(second.id);
    expect(Number(current?.amount)).toBe(12);
  });
});
