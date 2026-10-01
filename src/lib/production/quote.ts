// quote.ts — production-area money math for the roll class (093 FR-006…FR-010).
//
// Single Responsibility: given already-validated inputs, produce the exact
// area, the base amount, each finishing amount and the final total. No I/O, no
// configuration lookup, no rounding decisions made anywhere else. That
// separation is what lets the spec's worked example (145 cm × 2 m @ 100
// EGP/m² + Sulfan -> 3 m², 300, 270, 570) be pinned by a unit test that
// touches no database (SC-002).
//
// Decimal discipline (FR-024, constitution "Money"):
//   * every intermediate is Prisma.Decimal — a JS float never multiplies a
//     price, because 1.5 × 100 in binary floating point is not 150;
//   * rounding happens ONCE, on the final total, to whole EGP — matching
//     051's `NEAREST_EGP` contract, so the two pricing paths cannot disagree
//     about what a customer is charged;
//   * `area` is kept to 4 decimal places (the column is DECIMAL(12,4)) but the
//     *per-line* amounts are computed from the UNROUNDED area, so the stored
//     area column is a display/reconciliation value and never silently
//     changes a total.
//
// Client-safe, deliberately: the `Prisma` import is TYPE-ONLY, and the one
// value that needed it (the zero seed for the finishing sum) is derived from
// an existing Decimal instead of `new Prisma.Decimal(0)`. That is what lets
// the reception row show the price as the receptionist types — by calling
// THESE functions, not a browser-side copy of them. The server re-runs the very
// same code on submit, so the preview and the charged price cannot drift.

import type { Prisma } from "../../../generated/prisma";
import { DomainProductionSpecError } from "./errors";

/** 4 dp — matches `WorkItem.productionAreaSqm DECIMAL(12,4)`. */
const AREA_DECIMAL_PLACES = 4;

export type AreaInput = {
  /** Already rounded UP to a ladder step, in centimetres. */
  readonly productionWidthCm: Prisma.Decimal;
  /** Height in metres. */
  readonly heightM: Prisma.Decimal;
  /** Pieces to bill. Must be a positive integer. */
  readonly quantity: number;
};

export type ProductionArea = {
  /** `productionWidthCm / 100 * heightM * quantity`, to 4 dp. */
  readonly areaSqm: Prisma.Decimal;
  /** The same product before display rounding — the basis for every amount. */
  readonly exactAreaSqm: Prisma.Decimal;
  /** `productionWidthCm / 100`, carried for display alongside the area. */
  readonly productionWidthM: Prisma.Decimal;
  readonly heightM: Prisma.Decimal;
  readonly quantity: number;
};

/**
 * FR-006 — billable area is PRODUCTION width × height × quantity.
 *
 * The customer's requested width is deliberately not a parameter. Making it
 * structurally impossible to pass is stronger than documenting that it must
 * not be passed: no future caller can accidentally price off the requested
 * width because the function has no way to receive it.
 */
export function computeProductionArea(input: AreaInput): ProductionArea {
  const { productionWidthCm, heightM, quantity } = input;

  if (productionWidthCm.isNegative() || productionWidthCm.isZero()) {
    throw new DomainProductionSpecError(
      "INVALID_DIMENSIONS",
      "The production width must be greater than zero",
    );
  }
  if (heightM.isNegative() || heightM.isZero()) {
    throw new DomainProductionSpecError(
      "INVALID_DIMENSIONS",
      "The height must be greater than zero",
    );
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainProductionSpecError(
      "INVALID_DIMENSIONS",
      "The quantity must be a positive whole number",
    );
  }

  const productionWidthM = productionWidthCm.div(100);
  const exactAreaSqm = productionWidthM.mul(heightM).mul(quantity);

  return {
    areaSqm: exactAreaSqm.toDecimalPlaces(AREA_DECIMAL_PLACES),
    exactAreaSqm,
    productionWidthM,
    heightM,
    quantity,
  };
}

export type FinishingRate = {
  readonly finishingServiceId: string;
  readonly code: string;
  /** Arabic label frozen at selection time (constitution IX). */
  readonly labelAr: string;
  readonly ratePerSqm: Prisma.Decimal;
};

export type RollQuoteInput = {
  readonly area: ProductionArea;
  /** EGP per m², already checked against the configured band. */
  readonly baseRatePerSqm: Prisma.Decimal;
  readonly finishings: readonly FinishingRate[];
};

export type RollQuoteLine = {
  readonly finishingServiceId: string;
  readonly code: string;
  readonly labelAr: string;
  readonly ratePerSqm: Prisma.Decimal;
  /** `area × rate`, NOT rounded — the display layer may show 2 dp. */
  readonly exactAmount: Prisma.Decimal;
  readonly amount: Prisma.Decimal;
};

export type RollQuote = {
  readonly areaSqm: Prisma.Decimal;
  readonly baseRatePerSqm: Prisma.Decimal;
  readonly baseAmount: Prisma.Decimal;
  readonly finishings: readonly RollQuoteLine[];
  /** Sum of the finishing lines, NOT rounded. */
  readonly exactFinishingTotal: Prisma.Decimal;
  readonly finishingTotal: Prisma.Decimal;
  /** `baseAmount + finishingTotal`, still unrounded. */
  readonly exactTotal: Prisma.Decimal;
  /** The one and only rounded figure: `total`, whole EGP (FR-008). */
  readonly total: Prisma.Decimal;
  readonly currency: "EGP";
};

/**
 * FR-008 / FR-010 / SC-002 — `total = base + Σ finishings`, rounded once.
 *
 * Worked example from the spec: 150 cm production width × 2 m = 3 m²;
 * at 100 EGP/m² the base is 300; Sulfan at 90 EGP/m² adds 270; the total
 * rounds to 570 EGP.
 */
export function quoteRoll(input: RollQuoteInput): RollQuote {
  const { area, baseRatePerSqm, finishings } = input;

  if (baseRatePerSqm.isNegative() || baseRatePerSqm.isZero()) {
    throw new DomainProductionSpecError(
      "RATE_OUT_OF_BAND",
      "The base rate must be greater than zero",
    );
  }

  const exactBaseAmount = area.exactAreaSqm.mul(baseRatePerSqm);

  const lines = finishings.map<RollQuoteLine>((finishing) => {
    if (finishing.ratePerSqm.isNegative()) {
      throw new DomainProductionSpecError(
        "FINISHING_UNAVAILABLE",
        `Finishing ${finishing.code} has a negative rate`,
      );
    }
    const exactAmount = area.exactAreaSqm.mul(finishing.ratePerSqm);
    return {
      finishingServiceId: finishing.finishingServiceId,
      code: finishing.code,
      labelAr: finishing.labelAr,
      ratePerSqm: finishing.ratePerSqm,
      exactAmount,
      amount: exactAmount.toDecimalPlaces(2),
    };
  });

  // The zero seed is `area.exactAreaSqm.mul(0)` rather than
  // `new Prisma.Decimal(0)` so this module never needs a VALUE import of the
  // generated Prisma client — see the client-safety note at the top. Both are
  // the same `decimal.js` class the arithmetic below already uses.
  const first = lines[0]?.exactAmount;
  const exactFinishingTotal =
    first === undefined
      ? area.exactAreaSqm.mul(0)
      : lines.slice(1).reduce((sum, line) => sum.plus(line.exactAmount), first);
  const exactTotal = exactBaseAmount.plus(exactFinishingTotal);

  return {
    areaSqm: area.areaSqm,
    baseRatePerSqm,
    baseAmount: exactBaseAmount.toDecimalPlaces(2),
    finishings: lines,
    exactFinishingTotal,
    finishingTotal: exactFinishingTotal.toDecimalPlaces(2),
    exactTotal,
    // The single rounding site in this module — whole EGP, half-up, which is
    // what 051's `NEAREST_EGP` already does for every other pricing path.
    total: exactTotal.round(),
    currency: "EGP",
  };
}

/** Fractional EGP per m², for display next to an amount. */
export function formatRate(rate: Prisma.Decimal): string {
  return rate.toDecimalPlaces(2).toString();
}
