import { Prisma } from "../../../generated/prisma";
import type { Prisma as PrismaTypes } from "../../../generated/prisma";
import { err, ok, type Result } from "~/server/core";
import { db } from "~/server/db";
import { calculateQuote, selectQuantityTier, validateQuantityTiers, type PricingUnit } from "./calculation";
import { DomainPricingError } from "./errors";

export type QuoteInput = {
  readonly workItemId: string;
  readonly customerId: string;
  readonly asOf: Date;
};

export type QuoteBreakdown = {
  readonly unit: PricingUnit;
  readonly quantity: string;
  readonly widthMeters?: string;
  readonly heightMeters?: string;
  readonly areaPerPiece?: string;
  readonly totalArea?: string;
  readonly tierId?: string;
  readonly priceListId?: string;
  readonly customerRuleId?: string;
  readonly baseAmount: string;
  readonly adjustmentAmount: string;
  readonly taxIncluded: true;
  readonly finalAmount: string;
  readonly rounding: "NEAREST_EGP";
  /**
   * Which pricing path produced this breakdown.
   *
   * `PRODUCTION_SPEC` means the frozen 093 specification on the work item is
   * authoritative. `PRICE_LIST` means the 051 price list was used because the
   * product is not roll-governed. The two must never be silently mixed: a job
   * quoted one way and invoiced the other is how a shop loses the difference
   * between a 145 cm and a 150 cm roll.
   */
  readonly source?: "PRODUCTION_SPEC" | "PRICE_LIST";
  readonly finishingTotal?: string;
  readonly customerWidthMeters?: string;
};

export type QuoteResult = {
  readonly amount: string;
  readonly currency: "EGP";
  readonly breakdown: QuoteBreakdown;
};

const supportedUnits = new Set<PricingUnit>([
  "PIECE",
  "SQUARE_METER",
  "LINEAR_METER",
  "SHEET",
  "PACK",
]);

function pricingError(code: ConstructorParameters<typeof DomainPricingError>[0], message: string) {
  return err(new DomainPricingError(code, message));
}

export async function quote(input: QuoteInput): Promise<Result<QuoteResult, DomainPricingError>> {
  const workItem = await db.workItem.findUnique({
    where: { id: input.workItemId },
    include: {
      order: { select: { customerId: true } },
      productType: {
        include: {
          priceLists: {
            where: {
              status: "ACTIVE",
              effectiveFrom: { lte: input.asOf },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.asOf } }],
            },
            include: { tiers: true },
            orderBy: { effectiveFrom: "desc" },
          },
          customerPricingRules: {
            where: {
              customerId: input.customerId,
              status: "ACTIVE",
              effectiveFrom: { lte: input.asOf },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.asOf } }],
            },
          },
        },
      },
    },
  });

  if (!workItem?.productType) {
    return pricingError("PRICE_NOT_FOUND", "The work item or product type could not be found");
  }
  if (workItem.order.customerId !== input.customerId) {
    return pricingError("VALIDATION", "The customer does not own this work item");
  }
  if (!workItem.quantity || workItem.quantity <= 0) {
    return pricingError("INVALID_QUANTITY", "The work item quantity must be positive");
  }

  const priceList = workItem.productType.priceLists.find((candidate) =>
    supportedUnits.has(candidate.unit),
  );
  if (!priceList) {
    return pricingError("PRICE_NOT_FOUND", "No active price list exists for this product");
  }

  const unit: PricingUnit = priceList.unit;
  validateQuantityTiers(priceList.tiers);
  const tier = selectQuantityTier(priceList.tiers, workItem.quantity);
  const dimensionUnit = workItem.dimensionUnit === "CM" || workItem.dimensionUnit === "M"
    ? workItem.dimensionUnit
    : undefined;

  // 093's frozen specification WINS whenever the work item has one.
  //
  // This is the reconciliation between the two pricing paths. Reception freezes
  // `productionWidthCm` (the BILLING width, rounded up to a ladder step) and
  // `productionTotal` (base + finishings) onto the work item, while
  // `widthValue` deliberately carries the CUSTOMER's width because that is what
  // the designer lays out and the printer cuts. Recomputing area from
  // `widthValue` here would therefore re-derive the customer's 145 cm as 2.90 m²
  // when the customer was quoted — and billed — on the 150 cm roll's 3.00 m²,
  // and would silently drop the finishing lines entirely.
  //
  // So: if `productionSpecAt` is set, this function REPORTS the frozen numbers
  // instead of re-deriving them. The 051 path remains for every product with no
  // rule, which is what keeps this additive.
  if (workItem.productionSpecAt && workItem.productionTotal) {
    return ok({
      amount: workItem.productionTotal.toString(),
      currency: "EGP" as const,
      breakdown: {
        unit,
        quantity: new Prisma.Decimal(workItem.quantity).toString(),
        ...(workItem.productionWidthCm
          ? { widthMeters: workItem.productionWidthCm.div(100).toString() }
          : {}),
        ...(workItem.productionHeightM
          ? { heightMeters: workItem.productionHeightM.toString() }
          : {}),
        ...(workItem.productionAreaSqm
          ? { totalArea: workItem.productionAreaSqm.toString() }
          : {}),
        ...(workItem.customerWidthCm && dimensionUnit
          ? { customerWidthMeters: toMetersForBreakdown(workItem.customerWidthCm, dimensionUnit).toString() }
          : {}),
        tierId: tier.id,
        priceListId: priceList.id,
        baseAmount: workItem.baseTotal?.toString() ?? "0",
        // The frozen specification carries no separate customer-adjustment
        // figure: the receptionist's selected rate IS the agreed rate.
        adjustmentAmount: "0",
        ...(workItem.finishingTotal ? { finishingTotal: workItem.finishingTotal.toString() } : {}),
        taxIncluded: true,
        finalAmount: workItem.productionTotal.toString(),
        rounding: "NEAREST_EGP",
        source: "PRODUCTION_SPEC",
      },
    });
  }

  const calculation = calculateQuote({
    unit,
    quantity: workItem.quantity,
    width: workItem.widthValue ?? undefined,
    height: workItem.heightValue ?? undefined,
    dimensionUnit,
    tier,
    customerAdjustment: resolveCustomerAdjustment(workItem.productType.customerPricingRules),
  });

  const breakdown: QuoteBreakdown = {
    unit,
    quantity: new Prisma.Decimal(workItem.quantity).toString(),
    ...(workItem.widthValue && dimensionUnit
      ? { widthMeters: toMetersForBreakdown(workItem.widthValue, dimensionUnit).toString() }
      : {}),
    ...(workItem.heightValue && dimensionUnit
      ? { heightMeters: toMetersForBreakdown(workItem.heightValue, dimensionUnit).toString() }
      : {}),
    ...(calculation.areaPerPiece ? { areaPerPiece: calculation.areaPerPiece.toString() } : {}),
    ...(calculation.totalArea ? { totalArea: calculation.totalArea.toString() } : {}),
    tierId: tier.id,
    priceListId: priceList.id,
    ...(calculation.customerRuleId ? { customerRuleId: calculation.customerRuleId } : {}),
    baseAmount: calculation.baseAmount.toString(),
    adjustmentAmount: calculation.adjustmentAmount.toString(),
    taxIncluded: true,
    finalAmount: calculation.finalAmount.toString(),
    rounding: "NEAREST_EGP",
    source: "PRICE_LIST",
  };

  return ok({ amount: calculation.finalAmount.toString(), currency: "EGP", breakdown });
}

function resolveCustomerAdjustment(
  rules: readonly {
    id: string;
    kind: "FIXED" | "PERCENT_DISCOUNT";
    fixedPrice: PrismaTypes.Decimal | null;
    discountPercent: PrismaTypes.Decimal | null;
  }[],
) {
  if (rules.length > 1) {
    throw new DomainPricingError("EFFECTIVE_DATE_CONFLICT", "Multiple active customer pricing rules match");
  }
  const rule = rules[0];
  if (!rule) return undefined;
  if (rule.kind === "FIXED" && rule.fixedPrice) {
    return { kind: "FIXED" as const, amount: rule.fixedPrice, ruleId: rule.id };
  }
  if (rule.kind === "PERCENT_DISCOUNT" && rule.discountPercent) {
    return { kind: "PERCENT_DISCOUNT" as const, percent: rule.discountPercent, ruleId: rule.id };
  }
  throw new DomainPricingError("VALIDATION", "Customer pricing rule is incomplete");
}

function toMetersForBreakdown(value: PrismaTypes.Decimal, unit: "CM" | "M"): PrismaTypes.Decimal {
  return unit === "CM" ? value.div(100) : value;
}