// Integration test for quote() — tasks.md T014, US1.
// Quickstart scenarios 1-3: list/customer-rule resolution, expiry fallback,
// inclusive tier boundaries, tax-inclusive whole-EGP rounding, no writes.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  seedCustomer,
  seedCustomerRule,
  seedOrderWithWorkItem,
  seedPriceList,
  seedPricingUser,
  seedProductType,
} from "../../helpers/pricingSeed";
import { quote } from "~/server/pricing";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let admin: Actor;
let bannerId: string;
let roundingId: string;
let cardsId: string;
let abcId: string;
let otherId: string;
let bannerTiers: string[];
let cardTierIds: string[];

const RULE_FROM = new Date("2026-03-01T00:00:00.000Z");
const RULE_TO = new Date("2026-04-01T00:00:00.000Z");

beforeAll(async () => {
  admin = await seedPricingUser("quote-admin");
  bannerId = await seedProductType("Banner");
  roundingId = await seedProductType("BannerRounding");
  cardsId = await seedProductType("Card");
  abcId = await seedCustomer("ABC");
  otherId = await seedCustomer("Other");

  // Banner: SQUARE_METER, single open-ended tier at 100 EGP/m².
  const bannerList = await seedPriceList({
    productTypeId: bannerId,
    unit: "SQUARE_METER",
    createdById: admin.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "100" }],
  });
  bannerTiers = bannerList.tierIds;

  await seedPriceList({
    productTypeId: roundingId,
    unit: "SQUARE_METER",
    createdById: admin.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "33.33" }],
  });

  // Cards: PIECE with inclusive boundaries 1-9 / 10-49 / 50+.
  const cardList = await seedPriceList({
    productTypeId: cardsId,
    unit: "PIECE",
    createdById: admin.userId,
    tiers: [
      { minimumQuantity: 1, maximumQuantity: 9, basePrice: "10" },
      { minimumQuantity: 10, maximumQuantity: 49, basePrice: "8" },
      { minimumQuantity: 50, maximumQuantity: null, basePrice: "6" },
    ],
  });
  cardTierIds = cardList.tierIds;

  // Customer ABC: fixed 90 EGP/m² for a bounded period only.
  await seedCustomerRule({
    customerId: abcId,
    productTypeId: bannerId,
    unit: "SQUARE_METER",
    createdById: admin.userId,
    kind: "FIXED",
    fixedPrice: "90",
    effectiveFrom: RULE_FROM,
    effectiveTo: RULE_TO,
  });
});

async function bannerWorkItem(quantity: number): Promise<string> {
  const { workItemId } = await seedOrderWithWorkItem({
    customerId: abcId,
    createdById: admin.userId,
    productTypeId: bannerId,
    quantity,
    widthValue: 100,
    heightValue: 100,
    dimensionUnit: "CM",
  });
  return workItemId;
}

describe("quote (integration, US1)", () => {
  it("quotes customer ABC at the fixed customer-rule rate while the rule is active", async () => {
    const workItemId = await bannerWorkItem(9);
    const result = await quote({ workItemId, customerId: abcId, asOf: new Date("2026-03-15T00:00:00.000Z") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 1 m² x 9 pieces = 9 m² at the 90 EGP/m² customer rule.
    expect(result.value.amount).toBe("810");
    expect(result.value.currency).toBe("EGP");
    expect(result.value.breakdown.customerRuleId).toBeTruthy();
    expect(result.value.breakdown.priceListId).toBeTruthy();
    expect(result.value.breakdown.tierId).toBe(bannerTiers[0]);
    expect(result.value.breakdown.baseAmount).toBe("900");
    expect(result.value.breakdown.adjustmentAmount).toBe("-90");
    expect(result.value.breakdown.totalArea).toBe("9");
    expect(result.value.breakdown.taxIncluded).toBe(true);
  });

  it("quotes other customers from the price list while ABC's rule is active", async () => {
    const { workItemId } = await seedOrderWithWorkItem({
      customerId: otherId,
      createdById: admin.userId,
      productTypeId: bannerId,
      quantity: 9,
      widthValue: 100,
      heightValue: 100,
      dimensionUnit: "CM",
    });
    const result = await quote({ workItemId, customerId: otherId, asOf: new Date("2026-03-15T00:00:00.000Z") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amount).toBe("900");
    expect(result.value.breakdown.customerRuleId).toBeUndefined();
    expect(result.value.breakdown.adjustmentAmount).toBe("0");
  });

  it("falls back to the list price for ABC after the customer rule expires", async () => {
    const workItemId = await bannerWorkItem(9);
    const result = await quote({ workItemId, customerId: abcId, asOf: new Date("2026-05-01T00:00:00.000Z") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amount).toBe("900");
    expect(result.value.breakdown.customerRuleId).toBeUndefined();
    expect(result.value.breakdown.priceListId).toBeTruthy();
  });

  it.each([
    [9, "90", 0],
    [10, "80", 1],
    [49, "392", 1],
    [50, "300", 2],
  ])("selects the inclusive tier for quantity %i -> %s EGP", async (quantity, expected, tierIndex) => {
    const { workItemId } = await seedOrderWithWorkItem({
      customerId: otherId,
      createdById: admin.userId,
      productTypeId: cardsId,
      quantity,
      dimensionUnit: "CM",
    });
    const result = await quote({ workItemId, customerId: otherId, asOf: new Date("2026-03-15T00:00:00.000Z") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amount).toBe(expected);
    expect(result.value.breakdown.tierId).toBe(cardTierIds[tierIndex]);
  });

  it("keeps Decimal precision through area math and rounds only the final amount to whole EGP", async () => {
    const { workItemId } = await seedOrderWithWorkItem({
      customerId: otherId,
      createdById: admin.userId,
      productTypeId: roundingId,
      quantity: 3,
      widthValue: 250,
      heightValue: 120,
      dimensionUnit: "CM",
    });
    const result = await quote({ workItemId, customerId: otherId, asOf: new Date("2026-03-15T00:00:00.000Z") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2.5 m x 1.2 m x 3 = 9.00 m²; 33.33 x 9 = 299.97 -> 300 EGP.
    expect(result.value.breakdown.totalArea).toBe("9");
    expect(result.value.breakdown.baseAmount).toBe("299.97");
    expect(result.value.amount).toBe("300");
    expect(result.value.breakdown.finalAmount).toBe("300");
    expect(result.value.breakdown.rounding).toBe("NEAREST_EGP");
  });

  it("rejects a customer that does not own the work item", async () => {
    const workItemId = await bannerWorkItem(1);
    const result = await quote({ workItemId, customerId: otherId, asOf: new Date("2026-03-15T00:00:00.000Z") });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
  });

  it("never writes price or status rows while quoting", async () => {
    const workItemId = await bannerWorkItem(3);
    await quote({ workItemId, customerId: abcId, asOf: new Date("2026-03-15T00:00:00.000Z") });

    const prices = await testDb.workItemPrice.count({ where: { workItemId } });
    const status = await testDb.pricingStatus.count({ where: { workItemId } });
    expect(prices).toBe(0);
    expect(status).toBe(0);
  });
});
