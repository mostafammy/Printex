// specification.ts — reception freezes the production specification (093 US1).
//
// This is the write side of US1: reception enters what the customer asked
// for, the server decides what production will consume, and the result is
// FROZEN on the Work Item. After this returns, the numbers on the quote, on
// the accountant's screen and on the printer's job card are the same numbers
// and they will still be the same numbers after next month's rate change
// (SC-002, SC-006).
//
// Two public operations, one derivation:
//
//   previewProductionSpec — no writes. Powers anything that must show the
//                           consequence of a specification BEFORE it is
//                           committed (spec US1, constitution IX: the user sees
//                           the consequence of what they are typing).
//   setProductionSpec     — the same derivation, then one audited write.
//
// UNITS AND THE TWO WIDTHES (FR-002, FR-005, FR-006)
// --------------------------------------------------
// Both dimensions are CENTIMETRES, in and out. `productionHeightM` is stored in
// metres because the schema and the 50 m business ceiling are expressed that
// way; it is a unit projection of the same height, never a second value.
//
// `customerWidthCm` is what the customer asked for, and it is what the designer
// and the printer work to — it is never overwritten. `productionWidthCm` is the
// BILLING width: the nearest ladder step at or above the request, and the only
// width that feeds area. Keeping both is the whole point; collapsing them
// either prints a banner bigger than the customer paid for or bills for one
// smaller than they asked for.
//
// Both go through `deriveProductionSpec`, which delegates to the shared core in
// `src/lib/production/derive.ts`. That core is where the sequence of validation
// and the money maths live, and it is pure with respect to the database — which
// is what lets the reception form run it in the browser on every keystroke
// instead of asking the server to (see the note on the row component). Having
// one implementation, not two, is what guarantees the preview cannot drift from
// what is actually stored: the preview is not a re-implementation, it is the
// same function minus the write.
//
// Re-pricing is additive (constitution III): the Work Item snapshot columns
// are updated, a new `WorkItemFinishing` generation is inserted, and the audit
// event carries the full before/after. Nothing is deleted and no earlier
// quote generation is mutated.

import { Prisma } from "../../../generated/prisma";
import { z } from "zod";
import { db } from "~/server/db";
import { audit, authorize, type Actor } from "~/server/auth";
import { DomainProductionSpecError } from "./errors";
import { loadReceptionConstraints, type ProductionConstraints } from "./constraints";
import { approvedWidthException } from "./exceptions";
import { resolveFinishingRates } from "./finishings";
import { deriveProductionSpec as deriveProductionSpecCore } from "~/lib/production/derive";
import type { FinishingRate, RollQuote } from "./quote";
import { maxProductionWidthCm } from "./widths";

// ── Boundary validation (constitution V: Zod at the server edge) ───────────

/**
 * Reception-facing shape of the form. Amounts arrive as strings on purpose:
 * a JSON number has already lost precision by the time it reaches the server
 * (145.10 stays 145.1, but 0.1 + 0.2 does not), and money must not be typed
 * as a float. The strings are parsed to Decimal immediately and never
 * converted back to a JS number for arithmetic.
 */
export const productionSpecInputSchema = z.object({
  workItemId: z.string().min(1),
  customerWidthCm: z.string().trim().min(1, "أدخل العرض المطلوب بالسنتيمتر"),
  heightCm: z.string().trim().min(1, "أدخل الطول بالسنتيمتر"),
  quantity: z.number().int().positive(),
  baseRatePerSqm: z.string().trim().min(1, "أدخل سعر المتر المربع"),
  finishingCodes: z.array(z.string().trim().min(1)).default([]),
});

export type ProductionSpecInput = z.input<typeof productionSpecInputSchema>;

// ── Read models ────────────────────────────────────────────────────────────

export type ProductionSpecFinishing = {
  readonly finishingServiceId: string;
  readonly code: string;
  readonly labelAr: string;
  readonly ratePerSqm: string;
  readonly amount: string;
};

export type ProductionSpecSnapshot = {
  readonly workItemId: string;
  /** Exactly what the customer asked for — never overwritten by rounding. */
  readonly customerWidthCm: string;
  /**
   * The BILLING width: the first ladder step ≥ `customerWidthCm`. The customer
   * is charged on this, and it is the only width that feeds area. It is NOT the
   * width production physically works to.
   */
  readonly productionWidthCm: string;
  readonly roundedUp: boolean;
  /** Height in centimetres — the canonical dimension unit (FR-005). */
  readonly heightCm: string;
  /** The same height in metres, for the stored column and the ceiling. */
  readonly heightM: string;
  readonly quantity: number;
  readonly areaSqm: string;
  readonly baseRatePerSqm: string;
  readonly baseTotal: string;
  readonly finishings: readonly ProductionSpecFinishing[];
  readonly finishingTotal: string;
  readonly total: string;
  readonly currency: "EGP";
  readonly maxWidthCm: string;
  readonly maxHeightM: string;
  /**
   * Present when the width exceeds the ceiling AND a manager has approved an
   * exception. Its presence is the audit trail for a production width that
   * is not a ladder step (FR-003).
   */
  readonly widthException: {
    readonly id: string;
    readonly requestedWidthCm: string;
    readonly reason: string;
  } | null;
  readonly quotedAt: Date | null;
};

/** The read model for a Work Item that already has a frozen specification. */
export async function getProductionSpec(
  workItemId: string,
): Promise<ProductionSpecSnapshot | null> {
  const item = await db.workItem.findUnique({
    where: { id: workItemId },
    select: {
      id: true,
      productTypeId: true,
      customerWidthCm: true,
      productionWidthCm: true,
      productionHeightM: true,
      quantitySnapshot: true,
      productionAreaSqm: true,
      baseRatePerSqm: true,
      baseTotal: true,
      finishingTotal: true,
      productionTotal: true,
      productionSpecAt: true,
      productType: { select: { id: true, name: true } },
    },
  });
  if (!item?.productionSpecAt) return null;

  const [constraints, finishings, exception] = await Promise.all([
    // Same reader as the write path, so reading a frozen spec back can never
    // disagree with the numbers it was frozen from.
    item.productType
      ? loadReceptionConstraints(item.productType.id, item.productType.name)
      : Promise.resolve(null),
    latestFinishingRows(item.id),
    approvedWidthException(item.id),
  ]);

  const customerWidthCm = item.customerWidthCm;
  const productionWidthCm = item.productionWidthCm;
  if (!customerWidthCm || !productionWidthCm || !item.productionHeightM || !item.baseRatePerSqm) {
    // A half-written snapshot is impossible through `setProductionSpec`, but a
    // NULL here would otherwise be rendered as a confident 0.00 quote.
    throw new DomainProductionSpecError(
      "SPEC_NOT_SET",
      "This work item's production specification is incomplete and cannot be quoted",
    );
  }

  return {
    workItemId: item.id,
    customerWidthCm: customerWidthCm.toString(),
    productionWidthCm: productionWidthCm.toString(),
    roundedUp: !customerWidthCm.equals(productionWidthCm),
    heightCm: item.productionHeightM.mul(100).toString(),
    heightM: item.productionHeightM.toString(),
    quantity: item.quantitySnapshot ?? 1,
    areaSqm: (item.productionAreaSqm ?? new Prisma.Decimal(0)).toString(),
    baseRatePerSqm: item.baseRatePerSqm.toString(),
    baseTotal: (item.baseTotal ?? new Prisma.Decimal(0)).toString(),
    finishings,
    finishingTotal: (item.finishingTotal ?? new Prisma.Decimal(0)).toString(),
    total: (item.productionTotal ?? new Prisma.Decimal(0)).toString(),
    currency: "EGP",
    maxWidthCm: maxProductionWidthCm(constraints!.ladder).toString(),
    maxHeightM: constraints!.maxHeightM.toString(),
    widthException: exception
      ? {
          id: exception.id,
          requestedWidthCm: exception.requestedWidthCm,
          reason: exception.reason,
        }
      : null,
    quotedAt: item.productionSpecAt,
  };
}

// ── Derivation (shared by preview and commit) ─────────────────────────────

type DerivedSpec = {
  readonly snapshot: Omit<ProductionSpecSnapshot, "quotedAt">;
  readonly quote: RollQuote;
  readonly constraints: ProductionConstraints;
  readonly finishingRates: readonly FinishingRate[];
  readonly exceptionId: string | null;
};

/**
 * The server's view of the shared derivation.
 *
 * `deriveProductionSpecCore` (in `src/lib/production/derive.ts`) owns the
 * sequence of checks and all the arithmetic; this wrapper only adds what only
 * the server can know — which work item this is, and which configuration and
 * finishing rows it was derived against. The reception form calls the same
 * core, which is what stops the preview from drifting from what is stored
 * (spec US1, SC-002).
 */
function deriveProductionSpec(params: {
  readonly workItemId: string;
  readonly constraints: ProductionConstraints;
  readonly customerWidthCm: Prisma.Decimal;
  readonly heightCm: Prisma.Decimal;
  readonly quantity: number;
  readonly baseRatePerSqm: Prisma.Decimal;
  readonly finishingRates: readonly FinishingRate[];
  readonly exception: { readonly id: string; readonly reason: string } | null;
}): DerivedSpec {
  const derived = deriveProductionSpecCore(
    {
      customerWidthCm: params.customerWidthCm,
      heightCm: params.heightCm,
      quantity: params.quantity,
      baseRatePerSqm: params.baseRatePerSqm,
      finishingRates: params.finishingRates,
      exception: params.exception,
    },
    params.constraints,
  );

  return {
    ...derived,
    constraints: params.constraints,
    finishingRates: params.finishingRates,
    snapshot: { workItemId: params.workItemId, ...derived.snapshot },
  };
}

/** Loads the configuration an item needs, or explains why it has none. */
async function loadGovernance(
  workItemId: string,
): Promise<{ readonly constraints: ProductionConstraints; readonly productTypeId: string }> {
  const item = await db.workItem.findUnique({
    where: { id: workItemId },
    select: {
      id: true,
      productTypeId: true,
      state: true,
      productType: { select: { id: true, name: true } },
    },
  });
  if (!item) {
    throw new DomainProductionSpecError("WORK_ITEM_NOT_APPLICABLE", "Work item was not found");
  }
  if (item.state !== "NEW" && item.state !== "REWORK_REQUIRED" && item.state !== "ASSIGNED") {
    throw new DomainProductionSpecError(
      "WORK_ITEM_NOT_APPLICABLE",
      `A production specification can only be set while the item is in reception (current state: ${item.state})`,
    );
  }
  // `loadReceptionConstraints`, NOT `loadProductionConstraints`: the page that
  // rendered the live preview used the same reader, and a commit that resolved
  // different configuration than the preview is exactly the "quoted 570, stored
  // something else" bug this write path exists to prevent.
  const constraints = item.productType
    ? await loadReceptionConstraints(item.productType.id, item.productType.name)
    : null;
  if (!constraints) {
    throw new DomainProductionSpecError(
      "NOT_PRODUCTION_SPEC_GOVERNED",
      "This product type has no production width configuration, so area pricing does not apply to it",
    );
  }
  return { constraints, productTypeId: constraints.productTypeId };
}

// ── Public operations ─────────────────────────────────────────────────────

/**
 * Reception's live preview. Performs every validation `setProductionSpec`
 * performs, including the width and rate refusals, so the form can show the
 * real consequence (or the real refusal) without writing anything.
 */
export async function previewProductionSpec(
  input: ProductionSpecInput,
): Promise<ProductionSpecSnapshot> {
  const parsed = productionSpecInputSchema.parse(input);
  const { constraints } = await loadGovernance(parsed.workItemId);

  const [finishingRates, exception] = await Promise.all([
    resolveFinishingRates(parsed.finishingCodes),
    loadExceptionFor(parsed.workItemId),
  ]);

  const derived = deriveProductionSpec({
    workItemId: parsed.workItemId,
    constraints,
    customerWidthCm: parseDecimal(parsed.customerWidthCm, "العرض المطلوب"),
    heightCm: parseDecimal(parsed.heightCm, "الطول"),
    quantity: parsed.quantity,
    baseRatePerSqm: parseDecimal(parsed.baseRatePerSqm, "سعر المتر المربع"),
    finishingRates,
    exception,
  });

  return { ...derived.snapshot, quotedAt: null };
}

/**
 * Freezes the production specification and its price breakdown.
 *
 * `order.edit` — reception's own key, because this is reception data entry.
 * The accountant's separate approval is a different action with a different
 * key (`workitem.approve_production`); nothing here releases work to
 * production.
 */
export async function setProductionSpec(
  actor: Actor,
  input: ProductionSpecInput,
): Promise<ProductionSpecSnapshot> {
  authorize(actor, "order.edit");
  const parsed = productionSpecInputSchema.parse(input);
  const { constraints } = await loadGovernance(parsed.workItemId);

  const [finishingRates, exception] = await Promise.all([
    resolveFinishingRates(parsed.finishingCodes),
    loadExceptionFor(parsed.workItemId),
  ]);

  const derived = deriveProductionSpec({
    workItemId: parsed.workItemId,
    constraints,
    customerWidthCm: parseDecimal(parsed.customerWidthCm, "العرض المطلوب"),
    heightCm: parseDecimal(parsed.heightCm, "الطول"),
    quantity: parsed.quantity,
    baseRatePerSqm: parseDecimal(parsed.baseRatePerSqm, "سعر المتر المربع"),
    finishingRates,
    exception,
  });

  const quotedAt = new Date();

  return db.$transaction(async (tx) => {
    // `productionSpecAt IS NULL` distinguishes a first quote from a re-quote.
    const previous = await tx.workItem.findUniqueOrThrow({
      where: { id: parsed.workItemId },
      select: {
        customerWidthCm: true,
        productionWidthCm: true,
        productionHeightM: true,
        productionAreaSqm: true,
        baseRatePerSqm: true,
        baseTotal: true,
        finishingTotal: true,
        productionTotal: true,
        productionSpecAt: true,
      },
    });
    const generation = previous.productionSpecAt
      ? 1 + (await tx.workItemFinishing.aggregate({
          where: { workItemId: parsed.workItemId },
          _max: { generation: true },
        }))._max.generation!
      : 1;

    await tx.workItem.update({
      where: { id: parsed.workItemId },
      data: {
        customerWidthCm: new Prisma.Decimal(derived.snapshot.customerWidthCm),
        productionWidthCm: new Prisma.Decimal(derived.snapshot.productionWidthCm),
        productionHeightM: new Prisma.Decimal(derived.snapshot.heightM),
        quantitySnapshot: derived.snapshot.quantity,
        productionAreaSqm: new Prisma.Decimal(derived.snapshot.areaSqm),
        baseRatePerSqm: new Prisma.Decimal(derived.snapshot.baseRatePerSqm),
        baseTotal: new Prisma.Decimal(derived.snapshot.baseTotal),
        finishingTotal: new Prisma.Decimal(derived.snapshot.finishingTotal),
        productionTotal: new Prisma.Decimal(derived.snapshot.total),
        productionSpecAt: quotedAt,
      },
    });

    // Append-only: a re-quote adds a generation, it never edits one.
    if (derived.finishingRates.length > 0) {
      await tx.workItemFinishing.createMany({
        data: derived.finishingRates.map((rate) => ({
          workItemId: parsed.workItemId,
          finishingServiceId: rate.finishingServiceId,
          generation,
          quotedAt,
          labelSnapshot: rate.labelAr,
          rateSnapshot: rate.ratePerSqm,
          totalAmount: new Prisma.Decimal(
            derived.quote.finishings.find((l) => l.finishingServiceId === rate.finishingServiceId)
              ?.amount.toString() ?? "0",
          ),
        })),
      });
    }

    await audit.record(tx, {
      action: "workitem.production_spec_set",
      entityType: "WorkItem",
      entityId: parsed.workItemId,
      actorId: actor.userId,
      before: previous.productionSpecAt
        ? {
            customerWidthCm: previous.customerWidthCm?.toString() ?? null,
            productionWidthCm: previous.productionWidthCm?.toString() ?? null,
            productionAreaSqm: previous.productionAreaSqm?.toString() ?? null,
            baseRatePerSqm: previous.baseRatePerSqm?.toString() ?? null,
            baseTotal: previous.baseTotal?.toString() ?? null,
            finishingTotal: previous.finishingTotal?.toString() ?? null,
            productionTotal: previous.productionTotal?.toString() ?? null,
            generation,
          }
        : null,
      after: {
        customerWidthCm: derived.snapshot.customerWidthCm,
        productionWidthCm: derived.snapshot.productionWidthCm,
        heightCm: derived.snapshot.heightCm,
        quantity: derived.snapshot.quantity,
        areaSqm: derived.snapshot.areaSqm,
        baseRatePerSqm: derived.snapshot.baseRatePerSqm,
        baseTotal: derived.snapshot.baseTotal,
        finishingCodes: derived.snapshot.finishings.map((f) => f.code),
        finishingTotal: derived.snapshot.finishingTotal,
        productionTotal: derived.snapshot.total,
        generation,
        widthExceptionId: derived.exceptionId,
      },
    });

    return { ...derived.snapshot, quotedAt };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * An over-ceiling width is only passable behind a manager-approved ticket.
 * Read here (rather than in the guard) because the specification is where the
 * width is decided; the guard only has to verify the recorded result is
 * consistent.
 */
async function loadExceptionFor(
  workItemId: string,
): Promise<{ readonly id: string; readonly reason: string } | null> {
  const ticket = await approvedWidthException(workItemId);
  return ticket ? { id: ticket.id, reason: ticket.reason } : null;
}

async function latestFinishingRows(
  workItemId: string,
): Promise<ProductionSpecFinishing[]> {
  const rows = await db.workItemFinishing.findMany({
    where: { workItemId },
    include: { finishingService: { select: { code: true } } },
    orderBy: [{ generation: "desc" }, { quotedAt: "desc" }],
    take: 64,
  });
  const latest = rows[0]?.generation ?? 0;
  return rows
    .filter((row) => row.generation === latest)
    .map((row) => ({
      finishingServiceId: row.finishingServiceId,
      code: row.finishingService.code,
      labelAr: row.labelSnapshot,
      ratePerSqm: row.rateSnapshot.toString(),
      amount: row.totalAmount.toString(),
    }));
}

function parseDecimal(raw: string, arabicLabel: string): Prisma.Decimal {
  let value: Prisma.Decimal;
  try {
    value = new Prisma.Decimal(raw);
  } catch {
    throw new DomainProductionSpecError(
      "INVALID_DIMENSIONS",
      `${arabicLabel} يجب أن يكون رقماً صحيحاً`,
    );
  }
  if (!value.isFinite()) {
    throw new DomainProductionSpecError(
      "INVALID_DIMENSIONS",
      `${arabicLabel} يجب أن يكون رقماً صحيحاً`,
    );
  }
  return value;
}
