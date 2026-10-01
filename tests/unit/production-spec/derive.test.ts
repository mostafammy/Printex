// Unit tests — the shared derivation (093 FR-002…FR-010, spec SC-002).
//
// `deriveProductionSpec` is the ONE sequence of checks and arithmetic behind
// both the frozen specification on a work item and the live price in the
// reception form. It used to live inside the server module and be reached from
// the browser over a server action per keystroke; it now lives in
// `src/lib/production/derive.ts` and is called directly by both. These tests
// exist to pin the two things that a move like that can quietly break:
//
//   1. the numbers — the spec's worked example, asserted literally, exactly as
//      `quote.test.ts` does for the arithmetic underneath;
//   2. the ORDER of the refusals. A 400 cm width with a 5 m height and a rate of
//      zero must be reported as the width problem, not the rate problem, and
//      that is a property of the sequence rather than of any one check.
//
// Pure: no database, no configuration lookup. The constraints the server would
// have read from `ProductionWidthRule` are passed in as an argument.

import { Prisma } from "../../../generated/prisma";
import { describe, expect, it } from "vitest";
import { deriveProductionSpec, type DeriveConstraints, type DeriveInput } from "~/lib/production/derive";
import { DomainProductionSpecError } from "~/lib/production/errors";
import { assertWidthLadder } from "~/lib/production/widths";
import type { FinishingRate } from "~/lib/production/quote";

const dec = (value: string) => new Prisma.Decimal(value);

const SULFAN: FinishingRate = {
  finishingServiceId: "fin_sulfan",
  code: "SULFAN",
  labelAr: "سلوفان",
  ratePerSqm: dec("90"),
};

const CONSTRAINTS: DeriveConstraints = {
  ladder: assertWidthLadder([60, 90, 120, 150, 210, 270, 320]),
  maxHeightM: dec("3.5"),
  minRatePerSqm: dec("80"),
  maxRatePerSqm: dec("120"),
};

function input(overrides: Partial<DeriveInput> = {}): DeriveInput {
  return {
    customerWidthCm: dec("145"),
    heightCm: dec("200"),
    quantity: 1,
    baseRatePerSqm: dec("100"),
    finishingRates: [],
    // No work item exists yet at pre-creation time, so no width exception can.
    exception: null,
    ...overrides,
  };
}

/** The refusal code a derivation produces, or `null` when it succeeds. */
function refusalCode(params: Partial<DeriveInput> = {}): string | null {
  try {
    deriveProductionSpec(input(params), CONSTRAINTS);
    return null;
  } catch (error) {
    if (error instanceof DomainProductionSpecError) return error.code;
    throw error;
  }
}

describe("deriveProductionSpec — the spec's worked example (SC-002)", () => {
  it("reproduces 145 cm -> 150 cm, 3 m², 300 + 270 Sulfan = 570 EGP", () => {
    const { snapshot } = deriveProductionSpec(
      input({ finishingRates: [SULFAN] }),
      CONSTRAINTS,
    );

    expect(snapshot.customerWidthCm).toBe("145");
    expect(snapshot.productionWidthCm).toBe("150");
    expect(snapshot.roundedUp).toBe(true);
    expect(snapshot.areaSqm).toBe("3");
    expect(snapshot.baseTotal).toBe("300");
    expect(snapshot.finishingTotal).toBe("270");
    expect(snapshot.total).toBe("570");
    expect(snapshot.currency).toBe("EGP");
  });

  it("prices without finishings just as well", () => {
    const { snapshot } = deriveProductionSpec(input(), CONSTRAINTS);

    expect(snapshot.finishings).toHaveLength(0);
    expect(snapshot.finishingTotal).toBe("0");
    expect(snapshot.total).toBe("300");
  });

  it("multiplies the whole quote by quantity, once, at the end", () => {
    const one = deriveProductionSpec(input({ finishingRates: [SULFAN] }), CONSTRAINTS).snapshot;
    const three = deriveProductionSpec(
      input({ finishingRates: [SULFAN], quantity: 3 }),
      CONSTRAINTS,
    ).snapshot;

    expect(three.areaSqm).toBe("9");
    expect(three.baseTotal).toBe("900");
    expect(three.finishingTotal).toBe("810");
    expect(three.total).toBe(dec(one.total).mul(3).toString());
  });

  it("carries the ceiling the receptionist needs to explain a refusal", () => {
    const { snapshot } = deriveProductionSpec(input(), CONSTRAINTS);

    expect(snapshot.maxWidthCm).toBe("320");
    expect(snapshot.maxHeightM).toBe("3.5");
    expect(snapshot.widthException).toBeNull();
  });
});

describe("deriveProductionSpec — the width round-up (FR-002/FR-003)", () => {
  it("leaves an exact ladder hit alone", () => {
    const { snapshot } = deriveProductionSpec(input({ customerWidthCm: dec("150") }), CONSTRAINTS);

    expect(snapshot.productionWidthCm).toBe("150");
    expect(snapshot.roundedUp).toBe(false);
  });

  it("rounds UP to the next step, never down", () => {
    const { snapshot } = deriveProductionSpec(input({ customerWidthCm: dec("151") }), CONSTRAINTS);

    expect(snapshot.productionWidthCm).toBe("210");
    expect(snapshot.customerWidthCm).toBe("151");
  });

  it("refuses a width past the ceiling rather than clamping it", () => {
    expect(refusalCode({ customerWidthCm: dec("330") })).toBe("WIDTH_ABOVE_MAXIMUM");
  });

  it("refuses a fractional width that only CEILING rounding pushes over", () => {
    // 320.1 cm is a hair over a 320 cm machine. Half-up rounding would turn it
    // into 320 cm and silently hand the customer a smaller banner; the
    // production width is never rounded DOWN (FR-003).
    expect(refusalCode({ customerWidthCm: dec("320.1") })).toBe("WIDTH_ABOVE_MAXIMUM");
  });

  it("accepts an over-ceiling width ONLY behind an approved exception", () => {
    const approved = deriveProductionSpec(
      input({
        customerWidthCm: dec("330"),
        exception: { id: "we_1", reason: "拼接 work approved by the manager" },
      }),
      CONSTRAINTS,
    );

    // Recorded at the width the customer actually asked for, not at the ceiling.
    expect(approved.snapshot.productionWidthCm).toBe("330");
    expect(approved.snapshot.widthException?.id).toBe("we_1");
    expect(approved.exceptionId).toBe("we_1");
  });
});

describe("deriveProductionSpec — refusals, in order", () => {
  it("reports a nonsense height before anything else", () => {
    expect(refusalCode({ heightCm: dec("0") })).toBe("INVALID_DIMENSIONS");
  });

  it("reports a height above the ceiling", () => {
    expect(refusalCode({ heightCm: dec("400") })).toBe("HEIGHT_ABOVE_MAXIMUM");
  });

  it("reports a non-integer quantity as a dimension problem", () => {
    expect(refusalCode({ quantity: 1.5 })).toBe("INVALID_DIMENSIONS");
    expect(refusalCode({ quantity: 0 })).toBe("INVALID_DIMENSIONS");
  });

  it("reports a rate outside the band", () => {
    expect(refusalCode({ baseRatePerSqm: dec("50") })).toBe("RATE_OUT_OF_BAND");
    expect(refusalCode({ baseRatePerSqm: dec("500") })).toBe("RATE_OUT_OF_BAND");
  });

  it("checks the height BEFORE the width and the width BEFORE the rate", () => {
    // Every one of these is wrong at the same time. Which refusal the
    // receptionist is shown depends entirely on the order of the sequence, and
    // this is the assertion that pins it.
    expect(
      refusalCode({ heightCm: dec("400"), customerWidthCm: dec("330"), baseRatePerSqm: dec("1") }),
    ).toBe("HEIGHT_ABOVE_MAXIMUM");
    expect(
      refusalCode({ customerWidthCm: dec("330"), baseRatePerSqm: dec("1") }),
    ).toBe("WIDTH_ABOVE_MAXIMUM");
  });

  it("accepts both ends of the configured rate band", () => {
    expect(refusalCode({ baseRatePerSqm: dec("80") })).toBeNull();
    expect(refusalCode({ baseRatePerSqm: dec("120") })).toBeNull();
  });
});

describe("deriveProductionSpec — finishings (FR-009/FR-010)", () => {
  it("freezes the label and the rate it priced with", () => {
    const { snapshot } = deriveProductionSpec(input({ finishingRates: [SULFAN] }), CONSTRAINTS);

    expect(snapshot.finishings).toEqual([
      {
        finishingServiceId: "fin_sulfan",
        code: "SULFAN",
        labelAr: "سلوفان",
        ratePerSqm: "90",
        amount: "270",
      },
    ]);
  });

  it("adds each finishing to the total, not just the first", () => {
    const eyelet: FinishingRate = {
      finishingServiceId: "fin_eyelet",
      code: "EYELET",
      labelAr: " eyelets",
      ratePerSqm: dec("10"),
    };
    const { snapshot } = deriveProductionSpec(
      input({ finishingRates: [SULFAN, eyelet] }),
      CONSTRAINTS,
    );

    expect(snapshot.finishingTotal).toBe("300");
    expect(snapshot.total).toBe("600");
  });

  it("refuses a negative finishing rate rather than subtracting from the quote", () => {
    const bad: FinishingRate = { ...SULFAN, ratePerSqm: dec("-5") };
    expect(refusalCode({ finishingRates: [bad] })).toBe("FINISHING_UNAVAILABLE");
  });
});
