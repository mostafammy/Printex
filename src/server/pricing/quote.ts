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