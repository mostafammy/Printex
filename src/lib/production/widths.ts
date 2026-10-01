// widths.ts — THE canonical production-width round-up (093 FR-002).
//
// Single Responsibility: turn a customer-requested width in centimetres into
// the width production actually consumes, given an ordered ladder. Nothing
// else in the codebase is allowed to round a width — reception, the API, the
// accountant view and the printer job card all call this. That is what stops
// the classic failure where the number on the quote and the number on the
// roll are different (spec SC-001, SC-002: "reproducibly on every surface").
//
// The function is PURE and total over a validated ladder: no I/O, no config
// lookup, no throwing for business outcomes. Configuration arrives as an
// argument (`WidthLadder`) so the DB read lives in the server module and this
// file stays trivially unit-testable — the ladder is validated there once, at
// the boundary, rather than re-checked on every call.
//
// Round-up semantics, spelled out (FR-002): the result is the FIRST ladder
// entry greater than or equal to the requested width. So an exact hit maps to
// itself (320 -> 320) and anything between entries jumps to the next one
// (151 -> 210), and a width past the top of the ladder is a REFUSAL, never a
// clamp to the maximum (FR-003).
//
// Client-safe: the `Prisma` import below is TYPE-ONLY, so nothing from the
// generated Prisma client reaches the browser bundle. This is load-bearing —
// `production/department.ts` and the reception row both round widths, and they
// must round them with THIS function, not a copy of it.

import type { Prisma } from "../../../generated/prisma";
import { DomainProductionSpecError } from "./errors";
import type { ProductionSpecErrorCode } from "./errors";

/**
 * A validated, strictly-ascending width ladder in whole centimetres.
 *
 * The branding is the compile-time half of "validated": only
 * `assertWidthLadder` can produce one, and only it checks ordering,
 * positivity and emptiness. Everything downstream may therefore assume the
 * entries are sorted and sane.
 */
declare const widthLadderBrand: unique symbol;
export type WidthLadder = readonly number[] & { readonly [widthLadderBrand]: true };

/**
 * Validates a raw ladder and brands it. Called once per configuration read,
 * at the boundary (constitution V: nothing unvalidated reaches business
 * logic) — not on every round-up.
 */
export function assertWidthLadder(candidate: readonly number[]): WidthLadder {
  if (candidate.length === 0) {
    throw new DomainProductionSpecError(
      "INVALID_WIDTH_LADDER",
      "The production width ladder must contain at least one width",
    );
  }
  let previous = 0;
  for (const width of candidate) {
    if (!Number.isInteger(width) || width <= 0) {
      throw new DomainProductionSpecError(
        "INVALID_WIDTH_LADDER",
        `Width ladder entries must be positive whole centimetres; received ${width}`,
      );
    }
    if (width <= previous) {
      throw new DomainProductionSpecError(
        "INVALID_WIDTH_LADDER",
        "The production width ladder must be strictly ascending",
      );
    }
    previous = width;
  }
  return Object.freeze([...candidate]) as WidthLadder;
}

/** The widest width the ladder can produce. Anything above needs an exception. */
export function maxProductionWidthCm(ladder: WidthLadder): number {
  // Safe by construction: `assertWidthLadder` guarantees a non-empty ladder.
  return ladder[ladder.length - 1]!;
}

export type ResolveWidthOk = {
  readonly ok: true;
  /** The width production consumes, in centimetres. */
  readonly productionWidthCm: number;
  /** Exactly what the customer asked for, in centimetres. */
  readonly customerWidthCm: number;
  /** True when rounding actually moved the width. */
  readonly rounded: boolean;
  /** cm added by rounding — 0 when the request already matched a step. */
  readonly roundingDeltaCm: number;
};

export type ResolveWidthRefused = {
  readonly ok: false;
  readonly code: ProductionSpecErrorCode;
  readonly message: string;
  readonly customerWidthCm: number;
  readonly maxWidthCm: number;
};

export type ResolveWidthResult = ResolveWidthOk | ResolveWidthRefused;

/**
 * FR-002 / FR-003 / SC-001 — the one width round-up.
 *
 * Returns a discriminated result rather than throwing so callers can render
 * "your 330 cm banner is over the 320 cm limit" without a try/catch, and so
 * the refusal carries the numbers needed to raise a WidthExceptionTicket.
 */
export function resolveProductionWidth(
  customerWidthCm: Prisma.Decimal,
  ladder: WidthLadder,
): ResolveWidthResult {
  const requested = customerWidthCm;

  if (requested.isNegative() || requested.isZero()) {
    return {
      ok: false,
      code: "INVALID_DIMENSIONS",
      message: "Width must be greater than zero",
      customerWidthCm: requested.toNumber(),
      maxWidthCm: maxProductionWidthCm(ladder),
    };
  }

  const requestedWholeCm = toWholeCentimetresCeiling(requested);
  const maxWidthCm = maxProductionWidthCm(ladder);

  if (requestedWholeCm > maxWidthCm) {
    // FR-003: refuse loudly. Clamping here would silently bill and print a
    // banner smaller than the customer paid for.
    return {
      ok: false,
      code: "WIDTH_ABOVE_MAXIMUM",
      message:
        `Width ${formatCm(requested)} cm exceeds the maximum production width of ${maxWidthCm} cm. ` +
        "Raise a width exception for manager approval — the width is never rounded down.",
      customerWidthCm: requestedWholeCm,
      maxWidthCm,
    };
  }

  const productionWidthCm =
    ladder.find((step) => step >= requestedWholeCm) ?? maxWidthCm;

  return {
    ok: true,
    customerWidthCm: requestedWholeCm,
    productionWidthCm,
    rounded: productionWidthCm !== requestedWholeCm,
    roundingDeltaCm: productionWidthCm - requestedWholeCm,
  };
}

/**
 * Sub-centimetre widths are meaningless for a physical roll and would make
 * "is this an exact hit?" ambiguous, so the request is first resolved to a
 * whole number of centimetres.
 *
 * CEILING, deliberately, and this is the one subtle line in the module. Half-up
 * rounding would be the obvious choice and it would be WRONG: it turns a
 * 320.1 cm request into 320 cm, which is a silent clamp — the customer asked
 * for more than the machine can print and would be handed a smaller banner
 * with nothing in the system saying so. Ceiling instead makes 320.1 cm become
 * 321 cm, which is above the ceiling and is therefore refused by the check
 * above, exactly as FR-003 requires. Rounding UP is the rule everywhere in
 * this function, including for the fractional part.
 */
function toWholeCentimetresCeiling(value: Prisma.Decimal): number {
  return value.ceil().toNumber();
}

function formatCm(value: Prisma.Decimal): string {
  const asNumber = value.toNumber();
  return Number.isInteger(asNumber) ? String(asNumber) : asNumber.toFixed(2);
}
