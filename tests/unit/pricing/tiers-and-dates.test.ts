import { Prisma } from "../../../generated/prisma";
import { describe, expect, it } from "vitest";
import { selectQuantityTier, validateQuantityTiers, type QuantityTier } from "~/server/pricing/calculation";

const tier = (id: string, minimumQuantity: number, maximumQuantity: number | null): QuantityTier => ({
  id,
  minimumQuantity,
  maximumQuantity,
  basePrice: new Prisma.Decimal("100"),
});

describe("pricing tiers", () => {
  it("accepts adjacent inclusive ranges", () => {
    expect(() => validateQuantityTiers([
      tier("one", 1, 9),
      tier("ten", 10, 49),
      tier("fifty", 50, null),
    ])).not.toThrow();
  });

  it("rejects a quantity with no matching tier", () => {
    expect(() => selectQuantityTier([tier("ten", 10, 49)], 9)).toThrow(
      "Exactly one quantity tier must match",
    );
  });
});
