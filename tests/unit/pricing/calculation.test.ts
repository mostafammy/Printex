import { Prisma } from "../../../generated/prisma";
import { describe, expect, it } from "vitest";
import {
  calculateQuote,
  selectQuantityTier,
  toMeters,
  validateQuantityTiers,
  type QuantityTier,
} from "~/server/pricing/calculation";
import { DomainPricingError } from "~/server/pricing/errors";

const tiers: [QuantityTier, QuantityTier, QuantityTier] = [
  { id: "tier-1", minimumQuantity: 1, maximumQuantity: 9, basePrice: new Prisma.Decimal("100") },
  { id: "tier-2", minimumQuantity: 10, maximumQuantity: 49, basePrice: new Prisma.Decimal("90") },
  { id: "tier-3", minimumQuantity: 50, maximumQuantity: null, basePrice: new Prisma.Decimal("80") },
];

describe("pricing calculation", () => {
  it("converts centimetres to metres with Decimal precision", () => {
    expect(toMeters(new Prisma.Decimal("250.5"), "CM").toString()).toBe("2.505");
  });

  it.each([
    [9, "tier-1"],
    [10, "tier-2"],
    [50, "tier-3"],
  ])("selects the correct inclusive tier at quantity %s", (quantity, expectedTier) => {
    expect(selectQuantityTier(tiers, quantity).id).toBe(expectedTier);
  });

  it("calculates square metres from centimetre dimensions without float drift", () => {
    const result = calculateQuote({
      unit: "SQUARE_METER",
      quantity: 3,
      width: new Prisma.Decimal("250.5"),
      height: new Prisma.Decimal("120"),
      dimensionUnit: "CM",
      tier: tiers[0],
    });

    expect(result.areaPerPiece?.toString()).toBe("3.006");
    expect(result.totalArea?.toString()).toBe("9.018");
    expect(result.finalAmount.toString()).toBe("902");
  });

  it("applies a fixed customer price per billable unit", () => {
    const result = calculateQuote({
      unit: "LINEAR_METER",
      quantity: 3,
      width: new Prisma.Decimal("1"),
      dimensionUnit: "M",
      tier: tiers[0],
      customerAdjustment: {
        kind: "FIXED",
        amount: new Prisma.Decimal("90"),
        ruleId: "customer-abc",
      },
    });

    expect(result.finalAmount.toString()).toBe("270");
    expect(result.customerRuleId).toBe("customer-abc");
  });

  it("rounds the final amount to the nearest whole EGP", () => {
    const result = calculateQuote({
      unit: "PIECE",
      quantity: 1,
      tier: { ...tiers[0], basePrice: new Prisma.Decimal("100.49") },
    });

    expect(result.finalAmount.toString()).toBe("100");
  });

  it("rejects overlapping or invalid tiers", () => {
    expect(() => validateQuantityTiers([
      tiers[0],
      { ...tiers[1], minimumQuantity: 9 },
    ])).toThrowError(DomainPricingError);
  });
});
