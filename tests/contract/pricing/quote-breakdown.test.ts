// Contract test for the quote breakdown — tasks.md T015, US1.
// Every breakdown field required by contracts/pricing-service.md and
// data-model.md's QuoteBreakdown is present when applicable, and every
// Decimal value crosses the public boundary as a canonical decimal string.

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
import type { QuoteBreakdown, QuoteResult } from "~/server/pricing";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

const CANONICAL_DECIMAL = /^-?\d+(\.\d+)?$/;
const CANONICAL_WHOLE = /^\d+$/;

let admin: Actor;
let bannerId: string;
let plainId: string;
let abcId: string;
let ruleBannerId: string;

beforeAll(async () => {
  admin = await seedPricingUser("breakdown-admin");
  bannerId = await seedProductType("BannerBreakdown");
  plainId = await seedProductType("PlainBreakdown");
  abcId = await seedCustomer("ABCBreakdown");
  ruleBannerId = await seedProductType("RuleBannerBreakdown");

  await seedPriceList({
    productTypeId: bannerId,
    unit: "SQUARE_METER",
    createdById: admin.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "41.77" }],
  });
  await seedPriceList({
    productTypeId: plainId,
    unit: "PIECE",
    createdById: admin.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "12.50" }],
  });
  await seedPriceList({
    productTypeId: ruleBannerId,
    unit: "SQUARE_METER",
    createdById: admin.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "100" }],
  });
  await seedCustomerRule({
    customerId: abcId,
    productTypeId: ruleBannerId,
    unit: "SQUARE_METER",
    createdById: admin.userId,
    kind: "PERCENT_DISCOUNT",
    discountPercent: "10",
  });
});

function expectCanonicalDecimals(breakdown: QuoteBreakdown): void {
  expect(breakdown.quantity).toMatch(CANONICAL_DECIMAL);
  expect(breakdown.baseAmount).toMatch(CANONICAL_DECIMAL);
  expect(breakdown.adjustmentAmount).toMatch(CANONICAL_DECIMAL);
  expect(breakdown.finalAmount).toMatch(CANONICAL_WHOLE);
  expect(typeof breakdown.baseAmount).toBe("string");
  expect(typeof breakdown.adjustmentAmount).toBe("string");
  expect(typeof breakdown.finalAmount).toBe("string");
}

describe("quote breakdown (contract, US1)", () => {
  it("includes every applicable field with canonical decimal strings for a dimensional quote", async () => {
    const { workItemId } = await seedOrderWithWorkItem({
      customerId: abcId,
      createdById: admin.userId,
      productTypeId: bannerId,
      quantity: 2,
      widthValue: 150,
      heightValue: 80,
      dimensionUnit: "CM",
    });
    const result = await quote({ workItemId, customerId: abcId, asOf: new Date("2026-03-15T00:00:00.000Z") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { breakdown, amount, currency } = result.value satisfies QuoteResult;

    // Always-present fields.
    expect(breakdown.unit).toBe("SQUARE_METER");
    expect(breakdown.tierId).toBeTypeOf("string");
    expect(breakdown.priceListId).toBeTypeOf("string");
    expect(breakdown.taxIncluded).toBe(true);
    expect(breakdown.rounding).toBe("NEAREST_EGP");
    expect(breakdown.adjustmentAmount).toBe("0");
    expect(breakdown.customerRuleId).toBeUndefined();
    expectCanonicalDecimals(breakdown);

    // Dimensional fields for SQUARE_METER.
    expect(breakdown.widthMeters).toBe("1.5");
    expect(breakdown.heightMeters).toBe("0.8");
    expect(breakdown.areaPerPiece).toMatch(CANONICAL_DECIMAL);
    expect(breakdown.totalArea).toBe("2.4");
    expect(breakdown.areaPerPiece).toBe("1.2");

    // Boundary payload types.
    expect(amount).toMatch(CANONICAL_WHOLE);
    expect(currency).toBe("EGP");
    expect(JSON.parse(JSON.stringify(breakdown))).toEqual(breakdown);
  });

  it("omits dimensional fields and includes customerRuleId for a non-dimensional customer-rule quote", async () => {
    const { workItemId } = await seedOrderWithWorkItem({
      customerId: abcId,
      createdById: admin.userId,
      productTypeId: ruleBannerId,
      quantity: 1,
      widthValue: 100,
      heightValue: 100,
      dimensionUnit: "CM",
    });
    const result = await quote({ workItemId, customerId: abcId, asOf: new Date("2026-03-15T00:00:00.000Z") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const breakdown = result.value.breakdown;

    expect(breakdown.customerRuleId).toBeTypeOf("string");
    expect(breakdown.adjustmentAmount).toMatch(/^-/);
    // 10% discount on 100 EGP/m² -> adjustment -10 per m².
    expect(breakdown.adjustmentAmount).toBe("-10");
    expectCanonicalDecimals(breakdown);
  });

  it("keeps quantity-only breakdowns free of area fields", async () => {
    const { workItemId } = await seedOrderWithWorkItem({
      customerId: abcId,
      createdById: admin.userId,
      productTypeId: plainId,
      quantity: 4,
      dimensionUnit: "CM",
    });
    const result = await quote({ workItemId, customerId: abcId, asOf: new Date("2026-03-15T00:00:00.000Z") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const breakdown = result.value.breakdown;

    expect(breakdown.unit).toBe("PIECE");
    expect(breakdown.quantity).toBe("4");
    expect(breakdown.totalArea).toBeUndefined();
    expect(breakdown.areaPerPiece).toBeUndefined();
    expect(breakdown.widthMeters).toBeUndefined();
    expect(breakdown.heightMeters).toBeUndefined();
    expectCanonicalDecimals(breakdown);
  });
});
