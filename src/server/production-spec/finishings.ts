// finishings.ts — the extensible per-m² finishing catalogue (093 FR-009/FR-010).
//
// A finishing is CONFIGURATION, not a branch (constitution VI). Nothing in the
// pricing path knows what "SULFAN" is; it knows a `FinishingService` row
// exists with a code, an Arabic label, a rate and an effective window. Sulfan
// at 90 EGP/m² is seeded data — the same fact a customer negotiated last year
// — and the next add-on the shop invents is one more row, with no deploy and
// no test change.
//
// Effective dating is not decoration. `resolveFinishingRates` is called with
// the day the job is being priced, so a rate that was retired last month is
// never charged to a job quoted today (and, symmetrically, a rate raised
// today never rewrites a job quoted last month — that job's rate lives in
// `WorkItemFinishing.rateSnapshot`).

import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { audit, authorize, type Actor } from "~/server/auth";
import { DomainProductionSpecError } from "./errors";
import type { FinishingRate } from "./quote";

// ── The roll finishing defaults ────────────────────────────────────────────
//
// Sulfan at 90 EGP/m² is a real, agreed price (093 FR-009), so it lives here as
// DATA beside the reader rather than as an `if` inside the pricing maths. The
// shop's catalogue is authoritative and always wins: these rows are inserted
// only for codes that are entirely ABSENT, and never updated, so an operator
// who raises Sulfan to 95 keeps 95 forever.
//
// They are inserted on demand rather than by a seed script because
// `WorkItemFinishing.finishingServiceId` is a real foreign key. A default that
// cannot be written cannot be quoted, so a catalogue with no rows would leave
// the receptionist unable to sell the most common add-on in the shop.
export const DEFAULT_ROLL_FINISHINGS: readonly {
  readonly code: string;
  readonly labelAr: string;
  readonly ratePerSqm: string;
}[] = [
  { code: "SULFAN", labelAr: "سلوفان", ratePerSqm: "90" },
  { code: "EYELET", labelAr: "حلقات تثبيت", ratePerSqm: "15" },
  { code: "HEMMING", labelAr: "خياطة الأطراف", ratePerSqm: "25" },
];

/**
 * Inserts any default finishing whose CODE is missing. Idempotent and
 * non-destructive: existing rows are never touched, so this converges after the
 * first call and cannot resurrect a rate an operator deliberately retired.
 *
 * `FinishingService.createdById` is required and there is no actor on a plain
 * catalogue read, so the rows are attributed to the shop's first active
 * `admin.config` holder — the same person who would have entered them by hand.
 * If nobody holds that key the catalogue is simply left alone rather than
 * attributed to a stranger.
 */
export async function ensureDefaultFinishingServices(): Promise<void> {
  const existing = await db.finishingService.findMany({
    where: { code: { in: DEFAULT_ROLL_FINISHINGS.map((f) => f.code) } },
    select: { code: true },
  });
  const present = new Set(existing.map((row) => row.code));
  const missing = DEFAULT_ROLL_FINISHINGS.filter((f) => !present.has(f.code));
  if (missing.length === 0) return;

  const admin = await db.user.findFirst({
    where: {
      isActive: true,
      OR: [
        { roles: { some: { role: { permissions: { some: { permission: "admin.config" } } } } } },
        { extraPermissions: { some: { permission: "admin.config" } } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) return;

  await db.finishingService.createMany({
    data: missing.map((f) => ({
      code: f.code,
      labelAr: f.labelAr,
      ratePerSqm: new Prisma.Decimal(f.ratePerSqm),
      effectiveFrom: new Date(),
      effectiveTo: null,
      createdById: admin.id,
    })),
    skipDuplicates: true,
  });
}

export type FinishingServiceSnapshot = {
  readonly id: string;
  readonly code: string;
  readonly labelAr: string;
  readonly ratePerSqm: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly status: "ACTIVE" | "RETIRED";
};

/** Re-lists a FinishingService row into a decimal-free shape for the UI. */
function toSnapshot(row: {
  id: string;
  code: string;
  labelAr: string;
  ratePerSqm: Prisma.Decimal;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: "ACTIVE" | "RETIRED";
}): FinishingServiceSnapshot {
  return {
    id: row.id,
    code: row.code,
    labelAr: row.labelAr,
    ratePerSqm: row.ratePerSqm.toString(),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    status: row.status,
  };
}

/**
 * The finishings an admin may pick from right now — ACTIVE and inside their
 * effective window. Receptions (retired or not-yet-effective) are simply
 * absent, so the picker cannot offer a service that `resolveFinishingRates`
 * would then reject.
 */
export async function listActiveFinishingServices(
  asOf: Date = new Date(),
): Promise<FinishingServiceSnapshot[]> {
  // Idempotent: after the first call this is a single extra `SELECT`. The
  // catalogue must never come back empty, because an empty catalogue means the
  // receptionist cannot add the finishing the customer is standing there asking
  // for — and the work item's finishing lines cannot be written without a row.
  await ensureDefaultFinishingServices();

  const rows = await db.finishingService.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
    },
    orderBy: { code: "asc" },
  });
  return rows.map(toSnapshot);
}

export type CreateFinishingServiceInput = {
  readonly code: string;
  readonly labelAr: string;
  readonly ratePerSqm: string;
  readonly effectiveFrom?: Date;
  readonly effectiveTo?: Date | null;
};

/**
 * Adds a finishing to the catalogue. `admin.config`, because the rate is money
 * (051's `createPriceList` uses the same key for the same reason).
 */
export async function createFinishingService(
  actor: Actor,
  input: CreateFinishingServiceInput,
): Promise<FinishingServiceSnapshot> {
  authorize(actor, "admin.config");

  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,32}$/.test(code)) {
    throw new DomainProductionSpecError(
      "FINISHING_UNAVAILABLE",
      "A finishing code must be 2–32 characters of A–Z, 0–9 or underscore",
    );
  }
  const rate = new Prisma.Decimal(input.ratePerSqm);
  if (rate.isNegative() || rate.isZero()) {
    throw new DomainProductionSpecError(
      "FINISHING_UNAVAILABLE",
      "A finishing rate must be greater than zero",
    );
  }
  if (input.effectiveTo && input.effectiveTo <= (input.effectiveFrom ?? new Date())) {
    throw new DomainProductionSpecError(
      "FINISHING_UNAVAILABLE",
      "The effective end must be after the effective start",
    );
  }

  return db.$transaction(async (tx) => {
    const created = await tx.finishingService.create({
      data: {
        code,
        labelAr: input.labelAr.trim(),
        ratePerSqm: rate,
        effectiveFrom: input.effectiveFrom ?? new Date(),
        effectiveTo: input.effectiveTo ?? null,
        createdById: actor.userId,
      },
    });
    await audit.record(tx, {
      action: "finishing.created",
      entityType: "FinishingService",
      entityId: created.id,
      actorId: actor.userId,
      after: { code, ratePerSqm: rate.toString(), labelAr: created.labelAr },
    });
    return toSnapshot(created);
  });
}

/** Retires a finishing. Never deletes: prices already quoted keep their rate. */
export async function retireFinishingService(actor: Actor, serviceId: string): Promise<void> {
  authorize(actor, "admin.config");
  await db.$transaction(async (tx) => {
    await tx.finishingService.update({ where: { id: serviceId }, data: { status: "RETIRED" } });
    await audit.record(tx, {
      action: "finishing.retired",
      entityType: "FinishingService",
      entityId: serviceId,
      actorId: actor.userId,
    });
  });
}

/**
 * Turns the codes reception selected into the rates to charge, as of `asOf`.
 *
 * The returned `FinishingRate[]` is what `quoteRoll` consumes, and it carries
 * the label and rate by VALUE. That is the freeze: from this line on, the
 * numbers are decided and stored on the Work Item, so a catalogue change
 * cannot retroactively alter a quoted job (FR-010, SC-006).
 *
 * Requesting an unavailable code is an error rather than a silent skip —
 * "the customer paid for Sulfan and we quietly dropped it" is exactly the
 * class of bug this whole feature exists to remove.
 */
export async function resolveFinishingRates(
  codes: readonly string[],
  asOf: Date = new Date(),
): Promise<FinishingRate[]> {
  const wanted = [...new Set(codes.map((code) => code.trim().toUpperCase()))];
  if (wanted.length === 0) return [];

  // Same catalogue the picker offered, resolved the same way. Doing the
  // provisioning only in the reader would let the two disagree.
  await ensureDefaultFinishingServices();

  const rows = await db.finishingService.findMany({
    where: {
      code: { in: wanted },
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
    },
  });

  const byCode = new Map(rows.map((row) => [row.code, row]));

  return wanted.map((code) => {
    const row = byCode.get(code);
    if (!row) {
      throw new DomainProductionSpecError(
        "FINISHING_UNAVAILABLE",
        `Finishing "${code}" is not available for pricing`,
      );
    }
    return {
      finishingServiceId: row.id,
      code: row.code,
      labelAr: row.labelAr,
      ratePerSqm: row.ratePerSqm,
    };
  });
}
