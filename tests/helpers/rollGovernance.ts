// Test-only fixture for 093's production-spec governance.
//
// A governed ProductType is the thing the pipeline guards key off, so tests
// need one. This creates a FRESH product type per call rather than reusing a
// seeded one, because these tests deliberately run against a live database
// that other suites share: a per-call type keeps them independent of seed
// order and of anything a previous test mutated.
//
// Mirrors `tests/helpers/seed.ts`'s conventions (testDb only, unique names,
// no app-level imports that would pull in `~/env`).

import { Prisma } from "../../generated/prisma";
import { testDb } from "./testDb";

export type RollGovernance = {
  readonly productTypeId: string;
  readonly widthRuleId: string;
  /**
   * Logical finishing name -> the row it created.
   *
   * Both halves are exposed because callers need both: `setProductionSpec`
   * takes a finishing CODE (what a receptionist picks from a list), while the
   * `WorkItemFinishing` rows it writes are keyed by the service ID. Exposing
   * only one of the two is how a test ends up comparing a code to a cuid and
   * fails for reasons that have nothing to do with the feature.
   */
  readonly finishings: Readonly<Record<string, { readonly id: string; readonly code: string }>>;
};

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${process.hrtime.bigint().toString()}_${counter}`;
}

export async function seedRollGovernance(params: {
  readonly actorId: string;
  readonly ladderCm: readonly number[];
  readonly maxHeightM?: string;
  readonly minRatePerSqm?: string;
  readonly maxRatePerSqm?: string;
  /** code -> EGP per m². Defaults to the spec's Sulfan at 90. */
  readonly finishingRates?: Readonly<Record<string, string>>;
}): Promise<RollGovernance> {
  const productType = await testDb.productType.create({
    data: {
      name: unique("Roll Product"),
      defaultRequiresDesign: true,
      // The roll class has no Head-Designer review stage: design completion
      // lands on APPROVED, which IS the accountant stage.
      defaultRequiresReview: false,
    },
  });

  const widthRule = await testDb.productionWidthRule.create({
    data: {
      productTypeId: productType.id,
      ladderCm: [...params.ladderCm],
      maxHeightM: new Prisma.Decimal(params.maxHeightM ?? "50"),
      minRatePerSqm: new Prisma.Decimal(params.minRatePerSqm ?? "80"),
      maxRatePerSqm: new Prisma.Decimal(params.maxRatePerSqm ?? "120"),
      updatedById: params.actorId,
    },
  });

  const finishings: Record<string, { id: string; code: string }> = {};
  const rates = params.finishingRates ?? { SULFAN: "90" };
  for (const [name, rate] of Object.entries(rates)) {
    // `code` is unique database-wide, and this file is shared with other suites
    // that hit the same live database, so the code is made unique per call
    // while the human-readable `labelAr` stays the real finishing name. Tests
    // therefore look a finishing up by its logical name (`SULFAN`) and never
    // have to know the generated code.
    const service = await testDb.finishingService.create({
      data: {
        code: unique(name).toUpperCase().slice(0, 32),
        labelAr: name,
        ratePerSqm: new Prisma.Decimal(rate),
        createdById: params.actorId,
      },
    });
    finishings[name] = { id: service.id, code: service.code };
  }

  return { productTypeId: productType.id, widthRuleId: widthRule.id, finishings };
}
