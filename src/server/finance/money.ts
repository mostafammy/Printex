// Money helpers — 052-finance FR-026 (constitution "Money"): Decimal only,
// never floating point. All boundary inputs are validated decimal strings;
// all arithmetic happens on Prisma.Decimal.

import { Prisma } from "../../../generated/prisma";
import { DomainFinanceError } from "./errors";

/** Parse a strictly positive decimal string (amounts, limits, thresholds). */
export function parsePositiveDecimal(value: string): Prisma.Decimal {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new DomainFinanceError("VALIDATION", "Amount must be a valid positive number");
  }
  if (!amount.isFinite() || amount.isNegative() || amount.isZero()) {
    throw new DomainFinanceError("VALIDATION", "Amount must be a valid positive number");
  }
  return amount;
}

/** Parse a non-negative decimal string (0 allowed — used for thresholds). */
export function parseNonNegativeDecimal(value: string): Prisma.Decimal {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new DomainFinanceError("VALIDATION", "Value must be a valid non-negative number");
  }
  if (!amount.isFinite() || amount.isNegative()) {
    throw new DomainFinanceError("VALIDATION", "Value must be a valid non-negative number");
  }
  return amount;
}

/** Sum decimal strings exactly (API-boundary helper; no float math). */
export function sumDecimalStrings(values: readonly string[]): Prisma.Decimal {
  return values.reduce(
    (acc, value) => acc.plus(new Prisma.Decimal(value)),
    new Prisma.Decimal(0),
  );
}

/** Canonical decimal-string wire format for amounts. */
export function toDecimalString(value: Prisma.Decimal): string {
  return value.toString();
}
