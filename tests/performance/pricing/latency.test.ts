import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { Prisma } from "../../../generated/prisma";
import { calculateQuote, type QuantityTier } from "~/server/pricing/calculation";

const tier: QuantityTier = {
  id: "tier-1",
  minimumQuantity: 1,
  maximumQuantity: null,
  basePrice: new Prisma.Decimal("100"),
};

describe("pricing calculation latency", () => {
  it("keeps repeated pure calculations within the p95 target", () => {
    const durations: number[] = [];
    for (let index = 0; index < 200; index += 1) {
      const started = performance.now();
      calculateQuote({ unit: "SQUARE_METER", quantity: 3, width: new Prisma.Decimal("250"), height: new Prisma.Decimal("120"), dimensionUnit: "CM", tier });
      durations.push(performance.now() - started);
    }
    durations.sort((left, right) => left - right);
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? Number.POSITIVE_INFINITY;
    expect(p95).toBeLessThan(50);
  });
});