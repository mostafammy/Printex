// checks.ts — the refusals that depend only on CONFIGURATION (093 FR-004,
// FR-007): the height ceiling and the permitted EGP/m² band.
//
// They live apart from `constraints.ts` because that file's job is reading
// `ProductionWidthRule` out of the database. These two are pure predicates over
// already-loaded values, and the reception row needs them while the
// receptionist types — so they must be reachable from the browser. Keeping them
// here rather than inlining the comparison in the form is the whole point: a
// form that re-implemented the band check would start disagreeing with the
// server the first time the band moved.
//
// Client-safe: `Prisma` is imported TYPE-ONLY and `ProductionConstraints` is
// imported TYPE-ONLY, so neither the generated client nor the database module
// is pulled into the client bundle.

import type { Prisma } from "../../../generated/prisma";
import { DomainProductionSpecError } from "./errors";

/** The subset of a loaded `ProductionWidthRule` these refusals read. */
export type ProductionConstraintsLike = {
  readonly maxHeightM: Prisma.Decimal;
  readonly minRatePerSqm: Prisma.Decimal;
  readonly maxRatePerSqm: Prisma.Decimal;
};

/** FR-004 — height must be positive and within the configured ceiling. */
export function assertHeightWithinCap(
  heightM: Prisma.Decimal,
  constraints: ProductionConstraintsLike,
): void {
  if (heightM.isNegative() || heightM.isZero()) {
    throw new DomainProductionSpecError(
      "INVALID_DIMENSIONS",
      "Height must be greater than zero",
    );
  }
  if (heightM.gt(constraints.maxHeightM)) {
    throw new DomainProductionSpecError(
      "HEIGHT_ABOVE_MAXIMUM",
      `Height ${heightM.toString()} m exceeds the maximum of ${constraints.maxHeightM.toString()} m for this product`,
    );
  }
}

/** FR-007 — the entered EGP/m² must sit inside the configured band. */
export function assertRateWithinBand(
  ratePerSqm: Prisma.Decimal,
  constraints: ProductionConstraintsLike,
): void {
  if (ratePerSqm.lt(constraints.minRatePerSqm) || ratePerSqm.gt(constraints.maxRatePerSqm)) {
    throw new DomainProductionSpecError(
      "RATE_OUT_OF_BAND",
      `The base rate must be between ${constraints.minRatePerSqm.toString()} and ${constraints.maxRatePerSqm.toString()} EGP per m²`,
    );
  }
}
