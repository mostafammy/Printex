// derive.ts — THE sequence of validation and arithmetic for a production spec.
//
// This is the module's reason for existing in two places at once. Before it
// lived here, `specification.ts` owned `deriveProductionSpec` and the reception
// form called a server action per keystroke to run it — four database queries
// behind a debounce, which meant the price arrived a second late, or not at
// all. Moving the arithmetic out of the server was not enough: what actually
// has to be shared is the ORDER of the checks, because that order is part of
// the contract (a nonsense width must be reported as a nonsense width, not as a
// rate-band problem), and a preview that checked things in a different order
// would eventually contradict the order it is previewing.
//
// So this function is pure with respect to the database — every external value
// arrives as an argument — and both callers use it:
//   * `specification.ts` (server): `previewProductionSpec`, `setProductionSpec`
//   * the reception `WorkItemRow` (browser): the live preview, per keystroke
//
// The server remains the authority: `setProductionSpec` re-derives from its own
// freshly-read configuration when the form is submitted, and the client-sent
// values are inputs (width, height, quantity, rate, finishing codes) — never a
// price. A stale browser preview can therefore be wrong, and it will be caught.
//
// Client-safe: the only generated-client code reached is the Decimal value class
// via `./decimal`, and every other import is a sibling pure module.

import { Decimal, type DecimalValue } from "./decimal";
import { assertHeightWithinCap, assertRateWithinBand } from "./checks";
import { DomainProductionSpecError } from "./errors";
import { computeProductionArea, quoteRoll, type FinishingRate, type RollQuote } from "./quote";
import { maxProductionWidthCm, resolveProductionWidth, type WidthLadder } from "./widths";

/**
 * Everything a derivation needs from a product type's `ProductionWidthRule`.
 *
 * Structurally a subset of the server's `ProductionConstraints` (which also
 * carries `productTypeId` for its own error messages), so the server passes its
 * loaded value straight in with no conversion and no cast.
 */
export type DeriveConstraints = {
  readonly ladder: WidthLadder;
  readonly maxHeightM: DecimalValue;
  readonly minRatePerSqm: DecimalValue;
  readonly maxRatePerSqm: DecimalValue;
};

export type DeriveInput = {
  /** Exactly what the customer asked for, in CENTIMETRES. Never rounded. */
  readonly customerWidthCm: DecimalValue;
  /** Height in CENTIMETRES — the same unit as the width (FR-005). */
  readonly heightCm: DecimalValue;
  readonly quantity: number;
  readonly baseRatePerSqm: DecimalValue;
  readonly finishingRates: readonly FinishingRate[];
  /**
   * An approved width exception, or `null`. Always `null` before the work item
   * exists: a ticket is raised against a work item, so there is nothing for the
   * reception form to hold — which is why an over-ceiling width is refused at
   * pre-creation time instead of being quietly clamped.
   */
  readonly exception: { readonly id: string; readonly reason: string } | null;
};

/** One finishing line, stringified exactly as it is frozen on the work item. */
export type DerivedFinishingLine = {
  readonly finishingServiceId: string;
  readonly code: string;
  readonly labelAr: string;
  readonly ratePerSqm: string;
  readonly amount: string;
};

/** The frozen specification, minus the two fields only the server can know. */
export type DerivedSnapshot = {
  /** Exactly what the customer asked for — never overwritten by rounding. */
  readonly customerWidthCm: string;
  /**
   * The BILLING width: the first ladder step ≥ `customerWidthCm`. This is the
   * number the customer is charged on. It is NOT the number the job is printed
   * at — production works to `customerWidthCm`.
   */
  readonly productionWidthCm: string;
  readonly roundedUp: boolean;
  /** Height in CENTIMETRES, the canonical dimension unit (FR-005). */
  readonly heightCm: string;
  /** The same height in metres — the unit the stored column and the ceiling use. */
  readonly heightM: string;
  readonly quantity: number;
  readonly areaSqm: string;
  readonly baseRatePerSqm: string;
  readonly baseTotal: string;
  readonly finishings: readonly DerivedFinishingLine[];
  readonly finishingTotal: string;
  readonly total: string;
  readonly currency: "EGP";
  readonly maxWidthCm: string;
  readonly maxHeightM: string;
  readonly widthException: {
    readonly id: string;
    readonly requestedWidthCm: string;
    readonly reason: string;
  } | null;
};

export type DerivedSpec = {
  readonly snapshot: DerivedSnapshot;
  readonly quote: RollQuote;
  readonly exceptionId: string | null;
};

/**
 * FR-002…FR-010 — validate, round, price.
 *
 * TWO WIDTHS, ONE JOB (FR-002, FR-006)
 * ------------------------------------
 * `customerWidthCm` is what the customer asked for and what production
 * physically works to — the designer lays out the file and the printer cuts the
 * banner to it, and neither of them ever sees a rounded number. `productionWidthCm`
 * is the BILLING width: the nearest ladder step at or above the request, and the
 * only width that feeds area. A 145 cm request is therefore printed at 145 cm
 * and billed at 150 cm, which is what makes the ladder rule a pricing rule
 * rather than a production one.
 *
 * UNITS (FR-005)
 * -------------
 * Both dimensions are CENTIMETRES. Width in cm and height in metres is the
 * kind of pairing that produces a 2.00 × 1.45 banner because somebody read the
 * wrong field. The ladder is defined in centimetres and so is everything else;
 * metres appear only where the schema and the 50 m ceiling are expressed that
 * way.
 *
 * Order matters and is deliberate: dimension validity first (a nonsense width
 * should not be reported as a band problem), then the height cap, then the
 * width, then the money band.
 *
 * Throws `DomainProductionSpecError` for a business refusal — that is a
 * refusal, not a crash, and the reception row renders it in the field.
 */
export function deriveProductionSpec(
  input: DeriveInput,
  constraints: DeriveConstraints,
): DerivedSpec {
  const { quantity, baseRatePerSqm } = input;

  assertHeightWithinCap(input.heightCm, constraints);

  const width = resolveProductionWidth(input.customerWidthCm, constraints.ladder);
  const approvedException =
    width.ok === false && width.code === "WIDTH_ABOVE_MAXIMUM" ? input.exception : null;

  let billingWidthCm: DecimalValue;
  if (width.ok) {
    billingWidthCm = new Decimal(width.productionWidthCm);
  } else if (approvedException) {
    // FR-003: an over-ceiling width proceeds ONLY behind an approved ticket,
    // and it is billed at the width the customer actually asked for. It is
    // never rounded down to the ceiling.
    billingWidthCm = new Decimal(width.customerWidthCm);
  } else {
    throw new DomainProductionSpecError(width.code, width.message);
  }

  assertRateWithinBand(baseRatePerSqm, constraints);

  const area = computeProductionArea({
    productionWidthCm: billingWidthCm,
    heightCm: input.heightCm,
    quantity,
  });
  const quote = quoteRoll({ area, baseRatePerSqm, finishings: input.finishingRates });

  return {
    quote,
    exceptionId: approvedException?.id ?? null,
    snapshot: {
      customerWidthCm: input.customerWidthCm.toString(),
      productionWidthCm: billingWidthCm.toString(),
      roundedUp: !input.customerWidthCm.equals(billingWidthCm),
      heightCm: input.heightCm.toString(),
      heightM: area.heightM.toString(),
      quantity,
      areaSqm: quote.areaSqm.toString(),
      baseRatePerSqm: quote.baseRatePerSqm.toString(),
      baseTotal: quote.baseAmount.toString(),
      finishings: quote.finishings.map((line) => ({
        finishingServiceId: line.finishingServiceId,
        code: line.code,
        labelAr: line.labelAr,
        ratePerSqm: line.ratePerSqm.toString(),
        amount: line.amount.toString(),
      })),
      finishingTotal: quote.finishingTotal.toString(),
      total: quote.total.toString(),
      currency: "EGP",
      maxWidthCm: maxProductionWidthCm(constraints.ladder).toString(),
      maxHeightM: constraints.maxHeightM.toString(),
      widthException: approvedException
        ? {
            id: approvedException.id,
            requestedWidthCm: billingWidthCm.toString(),
            reason: approvedException.reason,
          }
        : null,
    },
  };
}
