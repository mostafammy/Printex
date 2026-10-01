// Unit tests — 093 FR-006…FR-010, spec SC-002 (the worked example).
//
// The spec's worked example is 145 cm × 2 m @ 100 EGP/m² + Sulfan → 3 m²,
// base 300, Sulfan 270, total 570 EGP. That number is the acceptance criterion
// a shopkeeper would check, so it is asserted literally here rather than
// re-derived from the implementation.
//
// Pure: no database, no configuration. Inputs are passed in, which is what
// makes the money path testable at all — a pricing bug found in this file is
// a pricing bug, not an environment bug.

import { Prisma } from "../../../generated/prisma";
import { describe, expect, it } from "vitest";
import { computeProductionArea, formatRate, quoteRoll, type FinishingRate } from "~/server/production-spec/quote";
import { DomainProductionSpecError } from "~/server/production-spec/errors";

const dec = (value: string) => new Prisma.Decimal(value);

function area(productionWidthCm: string, heightM: string, quantity = 1) {
  return computeProductionArea({ productionWidthCm: dec(productionWidthCm), heightM: dec(heightM), quantity });
}

const SULFAN: FinishingRate = {
  finishingServiceId: "fin_sulfan",
  code: "SULFAN",
  labelAr: "سلوفان",
  ratePerSqm: dec("90"),
};

describe("computeProductionArea — FR-006", () => {
  it("bills production width, not the customer's requested width", () => {
    // 150 cm is the rounded-up production width for a 145 cm request.
    const result = area("150", "2");

    expect(result.areaSqm.toString()).toBe("3");
    expect(result.productionWidthM.toString()).toBe("1.5");
  });

  it("multiplies by quantity", () => {
    expect(area("150", "2", 4).areaSqm.toString()).toBe("12");
  });

  it("keeps four decimal places, matching the column's precision", () => {
    // 265 cm rounded up to 270 -> 2.7 m; 0.25 m tall -> 0.675 m².
    expect(area("270", "0.25").areaSqm.toString()).toBe("0.675");
    // 2.505 m x 1.19 m = 2.98095 m² -> 4 dp, not silently 2.9809 in the money.
    expect(area("250.5", "1.19").areaSqm.toString()).toBe("2.981");
  });

  it("exposes the UNROUNDED area so a display value can never move a total", () => {
    const result = area("250.5", "1.19");
    expect(result.exactAreaSqm.toString()).toBe("2.98095");
    expect(result.areaSqm.toString()).toBe("2.981");
  });

  it.each([
    ["0", "2", "zero width"],
    ["-10", "2", "negative width"],
    ["150", "0", "zero height"],
    ["150", "-2", "negative height"],
  ])("refuses width %s, height %s (%s)", (width, height) => {
    expect(() => area(width, height)).toThrow(DomainProductionSpecError);
  });

  it.each([0, -1, 1.5, 2.5])("refuses a quantity of %s", (quantity) => {
    expect(() => area("150", "2", quantity)).toThrow(/positive whole number/);
  });
});

describe("quoteRoll — the spec's worked example (SC-002)", () => {
  it("prices 145 cm x 2 m at 100 EGP/m² with Sulfan to exactly 570 EGP", () => {
    // 145 cm rounds UP to the 150 cm step, so the 3 m² the spec quotes is the
    // PRODUCTION area, not the 2.9 m² the customer asked about.
    const quote = quoteRoll({
      area: area("150", "2"),
      baseRatePerSqm: dec("100"),
      finishings: [SULFAN],
    });

    expect(quote.areaSqm.toString()).toBe("3");
    expect(quote.baseRatePerSqm.toString()).toBe("100");
    expect(quote.baseAmount.toString()).toBe("300");
    expect(quote.finishings).toHaveLength(1);
    expect(quote.finishings[0]!.code).toBe("SULFAN");
    expect(quote.finishings[0]!.amount.toString()).toBe("270");
    expect(quote.finishingTotal.toString()).toBe("270");
    expect(quote.total.toString()).toBe("570");
    expect(quote.currency).toBe("EGP");
  });

  it("sums several finishings into one total", () => {
    const quote = quoteRoll({
      area: area("150", "2"),
      baseRatePerSqm: dec("100"),
      finishings: [
        SULFAN, // 90 x 3 m² = 270
        { ...SULFAN, finishingServiceId: "fin_eyelet", code: "EYELET", ratePerSqm: dec("15") }, // 45
        { ...SULFAN, finishingServiceId: "fin_hem", code: "HEMMING", ratePerSqm: dec("25") }, // 75
      ],
    });

    expect(quote.finishingTotal.toString()).toBe("390");
    expect(quote.total.toString()).toBe("690");
  });

  it("is zero-finishing a valid quote, not a special case", () => {
    const quote = quoteRoll({ area: area("150", "2"), baseRatePerSqm: dec("100"), finishings: [] });

    expect(quote.finishingTotal.toString()).toBe("0");
    expect(quote.total.toString()).toBe("300");
  });

  it("treats any configured finishing identically — Sulfan is data, not a branch", () => {
    // Same maths for an add-on that did not exist when the code was written.
    const quote = quoteRoll({
      area: area("150", "2"),
      baseRatePerSqm: dec("100"),
      finishings: [{ ...SULFAN, code: "EMBROIDERY", ratePerSqm: dec("1000") }],
    });

    expect(quote.finishings[0]!.amount.toString()).toBe("3000");
    expect(quote.total.toString()).toBe("3300");
  });
});

describe("quoteRoll — Decimal discipline and the single rounding site (FR-008)", () => {
  it("does not drift where binary floating point would", () => {
    // 0.1 + 0.2 !== 0.3 in floats. If area were a float, this total would be
    // 300.00000000000006 and the rounding step would paper over the class of
    // bug instead of fixing it.
    const quote = quoteRoll({
      area: area("100", "0.3"),
      baseRatePerSqm: dec("1000"),
      finishings: [],
    });

    expect(quote.areaSqm.toString()).toBe("0.3");
    expect(quote.exactTotal.toString()).toBe("300");
    expect(quote.total.toString()).toBe("300");
  });

  it("computes per-line amounts from the UNROUNDED area", () => {
    // 2.98095 m² x 90 = 268.2855. The 4-dp display area (2.9810) would give
    // 268.29 — a different number. The line must follow the exact area.
    const quote = quoteRoll({ area: area("250.5", "1.19"), baseRatePerSqm: dec("80"), finishings: [SULFAN] });

    expect(quote.baseAmount.toString()).toBe("238.48");
    expect(quote.finishings[0]!.amount.toString()).toBe("268.29");
  });

  it("rounds the TOTAL once, to whole EGP, half-up — matching 051's NEAREST_EGP", () => {
    // 1 x 1 m at 100.5 -> 100.5, which must land on 101, not 100.
    const up = quoteRoll({ area: area("100", "1"), baseRatePerSqm: dec("100.5"), finishings: [] });
    expect(up.total.toString()).toBe("101");

    // 1 x 1 m at 100.4 -> 100.4, which must land on 100.
    const down = quoteRoll({ area: area("100", "1"), baseRatePerSqm: dec("100.4"), finishings: [] });
    expect(down.total.toString()).toBe("100");
  });

  it("keeps the unrounded total available for audit", () => {
    const quote = quoteRoll({ area: area("100", "1"), baseRatePerSqm: dec("100.5"), finishings: [] });

    expect(quote.exactTotal.toString()).toBe("100.5");
    expect(quote.total.toString()).toBe("101");
  });
});

describe("quoteRoll — invalid money", () => {
  it.each(["0", "-1"])("refuses a base rate of %s", (rate) => {
    expect(() =>
      quoteRoll({ area: area("150", "2"), baseRatePerSqm: dec(rate), finishings: [] }),
    ).toThrow(DomainProductionSpecError);
  });

  it("refuses a negative finishing rate rather than subtracting from the quote", () => {
    expect(() =>
      quoteRoll({
        area: area("150", "2"),
        baseRatePerSqm: dec("100"),
        finishings: [{ ...SULFAN, ratePerSqm: dec("-5") }],
      }),
    ).toThrow(DomainProductionSpecError);
  });
});

describe("formatRate", () => {
  it("renders a fractional EGP/m² rate at two decimal places", () => {
    expect(formatRate(dec("90"))).toBe("90");
    expect(formatRate(dec("87.5"))).toBe("87.5");
    expect(formatRate(dec("87.456"))).toBe("87.46");
  });
});
