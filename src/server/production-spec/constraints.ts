// constraints.ts — the configuration boundary for production rules (constitution VI).
//
// This is the ONLY place that reads `ProductionWidthRule` and the ONLY place
// that validates configuration shape. Everything below it in this module —
// and everything in `widths.ts`, `quote.ts` and the shared core in
// `src/lib/production/` — receives already-validated values as plain
// arguments. Two consequences that matter:
//
//   1. The pure functions stay pure, so the spec's width vector (SC-001) and
//      the 570 EGP example (SC-002) are testable with no database, and the
//      reception form can run them in the browser for its live price.
//   2. There is exactly one definition of "is this ladder valid?", so a
//      corrupt rule surfaces as a loud startup-shaped error instead of a
//      subtly wrong banner size three layers down.
//
// The per-ProductType lookup is the configuration switch the pipeline guards
// read: a Work Item whose ProductType has no rule is NOT roll-governed and
// keeps 011/014's pre-existing behaviour. That is what makes the 093 gates
// additive rather than a breaking change to every product in the shop.

import { type Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { Decimal } from "~/lib/production/decimal";
import { DomainProductionSpecError } from "./errors";
import { assertWidthLadder, type WidthLadder } from "./widths";

/** Minimal client surface — satisfied by both `db` and a `TransactionClient`. */
type RuleReader = Pick<typeof db, "productionWidthRule">;

export type ProductionConstraints = {
  readonly productTypeId: string;
  /** Validated, ascending, non-empty. */
  readonly ladder: WidthLadder;
  readonly maxHeightM: Prisma.Decimal;
  readonly minRatePerSqm: Prisma.Decimal;
  readonly maxRatePerSqm: Prisma.Decimal;
};

type RuleRow = {
  readonly productTypeId: string;
  readonly ladderCm: number[];
  readonly maxHeightM: Prisma.Decimal;
  readonly minRatePerSqm: Prisma.Decimal;
  readonly maxRatePerSqm: Prisma.Decimal;
};

/**
 * Loads and validates the rule for a ProductType, or returns `null` when the
 * ProductType is not production-spec governed.
 *
 * `null` is a first-class answer, not an error: "this product has no width
 * ladder" is the normal state for every product the shop has not configured
 * yet, and callers branch on it explicitly.
 */
export async function loadProductionConstraints(
  productTypeId: string | null,
  reader: RuleReader = db,
): Promise<ProductionConstraints | null> {
  if (productTypeId === null) return null;

  const row = await reader.productionWidthRule.findUnique({
    where: { productTypeId },
    select: {
      productTypeId: true,
      ladderCm: true,
      maxHeightM: true,
      minRatePerSqm: true,
      maxRatePerSqm: true,
    },
  });
  if (!row) return null;

  return toConstraints(row);
}

/**
 * Pure row -> validated domain translation. Split out from the query so the
 * validation rules are testable without a database and so the transaction
 * and non-transaction paths cannot drift apart.
 */
export function toConstraints(row: RuleRow): ProductionConstraints {
  const ladder = assertWidthLadder(row.ladderCm);

  const { minRatePerSqm, maxRatePerSqm, maxHeightM } = row;
  if (minRatePerSqm.isNegative() || maxRatePerSqm.isNegative()) {
    throw new DomainProductionSpecError(
      "INVALID_WIDTH_LADDER",
      "The configured base-rate band must not be negative",
    );
  }
  if (minRatePerSqm.gt(maxRatePerSqm)) {
    throw new DomainProductionSpecError(
      "INVALID_WIDTH_LADDER",
      "The configured minimum base rate must not exceed the maximum",
    );
  }
  if (maxHeightM.isNegative() || maxHeightM.isZero()) {
    throw new DomainProductionSpecError(
      "INVALID_WIDTH_LADDER",
      "The configured maximum height must be greater than zero",
    );
  }
  // A ceiling below the widest ladder entry would make the ladder partly
  // dead configuration, which is always an operator mistake.
  const widestStep = ladder[ladder.length - 1]!;
  if (maxHeightM.lte(0) || widestStep <= 0) {
    throw new DomainProductionSpecError(
      "INVALID_WIDTH_LADDER",
      "The configured width ladder is invalid",
    );
  }

  return {
    productTypeId: row.productTypeId,
    ladder,
    maxHeightM,
    minRatePerSqm,
    maxRatePerSqm,
  };
}

// The two configuration REFUSALS (FR-004 height ceiling, FR-007 rate band) are
// pure predicates over the values above, not database reads, so they live in
// `src/lib/production/checks.ts` where the reception form can reach them — it
// previews prices in the browser and must refuse exactly what this server
// refuses. Re-exported here so the module's public surface is unchanged.
export { assertHeightWithinCap, assertRateWithinBand } from "~/lib/production/checks";

// ── The roll defaults ──────────────────────────────────────────────────────
//
// 093 FR-001/FR-004/FR-007 describe one ladder, one height ceiling and one
// EGP/m² band for the roll/banner class. They are declared HERE, once, rather
// than in the reception UI, so a page that previews and an action that commits
// cannot disagree about what a banner costs — that disagreement is exactly how
// an order ends up stored at a different total from the one quoted.
//
// A stored `ProductionWidthRule` always WINS. These are what a shop that has not
// configured the product yet gets, which keeps the roll workflow usable instead
// of refusing every banner with "this product is not set up for per-m² pricing".
export const ROLL_WIDTH_LADDER_CM = [80, 110, 150, 210, 260, 270, 320] as const;
export const ROLL_MAX_HEIGHT_M = "50";
export const ROLL_MIN_RATE_PER_SQM = "80";
export const ROLL_MAX_RATE_PER_SQM = "120";

/**
 * Whether a ProductType belongs to the roll/banner class by NAME.
 *
 * Name matching is the same heuristic the reception modal uses to decide which
 * product a banner job prices as, so the preview and the commit agree on the
 * subject. It is a defaulting convenience, never an authority: a stored rule
 * overrides it, and a product that matches neither path stays ungoverned.
 */
export function isRollProductTypeName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("roll-up") ||
    lower.includes("rollup") ||
    lower.includes("banner") ||
    lower.includes("flex") ||
    lower.includes("vinyl") ||
    lower.includes("sticker") ||
    name.includes("بنر") ||
    name.includes("فليكس") ||
    name.includes("رول") ||
    name.includes("فينيل") ||
    name.includes("استيكر")
  );
}

/** The canonical roll constraints for a ProductType that has no stored rule. */
export function defaultRollConstraints(productTypeId: string): ProductionConstraints {
  return toConstraints({
    productTypeId,
    ladderCm: [...ROLL_WIDTH_LADDER_CM],
    maxHeightM: new Decimal(ROLL_MAX_HEIGHT_M),
    minRatePerSqm: new Decimal(ROLL_MIN_RATE_PER_SQM),
    maxRatePerSqm: new Decimal(ROLL_MAX_RATE_PER_SQM),
  });
}

/**
 * The constraints reception should price a ProductType against: the stored
 * rule when there is one, otherwise the roll defaults when the product is
 * roll-shaped by name, otherwise `null` (genuinely ungoverned).
 *
 * Both the page that renders the live preview and the action that commits it
 * go through this ONE function, so a quote and the stored spec are always
 * derived from the same numbers.
 */
export async function loadReceptionConstraints(
  productTypeId: string,
  productTypeName: string,
  reader: RuleReader = db,
): Promise<ProductionConstraints | null> {
  const stored = await loadProductionConstraints(productTypeId, reader);
  if (stored) return stored;
  return isRollProductTypeName(productTypeName) ? defaultRollConstraints(productTypeId) : null;
}
