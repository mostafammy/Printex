import { Prisma } from "../../../generated/prisma";
import { DomainPricingError } from "./errors";

export type PricingUnit =
  | "PIECE"
  | "SQUARE_METER"
  | "LINEAR_METER"
  | "SHEET"
  | "PACK";

export type DimensionUnit = "CM" | "M";

export type QuantityTier = {
  readonly id: string;
  readonly minimumQuantity: number;
  readonly maximumQuantity: number | null;
  readonly basePrice: Prisma.Decimal;
};

export type CustomerAdjustment =
  | { readonly kind: "FIXED"; readonly amount: Prisma.Decimal; readonly ruleId: string }
  | { readonly kind: "PERCENT_DISCOUNT"; readonly percent: Prisma.Decimal; readonly ruleId: string };

export type QuoteCalculationInput = {
  readonly unit: PricingUnit;
  readonly quantity: number;
  readonly width?: Prisma.Decimal;
  readonly height?: Prisma.Decimal;
  readonly dimensionUnit?: DimensionUnit;
  readonly tier: QuantityTier;
  readonly customerAdjustment?: CustomerAdjustment;
};

export type QuoteCalculation = {
  readonly billableQuantity: Prisma.Decimal;
  readonly areaPerPiece: Prisma.Decimal | null;
  readonly totalArea: Prisma.Decimal | null;
  readonly baseAmount: Prisma.Decimal;
  readonly adjustmentAmount: Prisma.Decimal;
  readonly finalAmount: Prisma.Decimal;
  readonly customerRuleId: string | null;
};

const ONE_HUNDRED = new Prisma.Decimal(100);
const ONE_EGP = new Prisma.Decimal(1);

export function toMeters(value: Prisma.Decimal, unit: DimensionUnit): Prisma.Decimal {
  if (value.isNegative() || value.isZero()) {
    throw new DomainPricingError("INVALID_DIMENSIONS", "Dimensions must be greater than zero");
  }

  return unit === "CM" ? value.div(100) : value;
}

export function selectQuantityTier(tiers: readonly QuantityTier[], quantity: number): QuantityTier {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainPricingError("INVALID_QUANTITY", "Quantity must be a positive integer");
  }

  const matches = tiers.filter(
    (tier) =>
      quantity >= tier.minimumQuantity &&
      (tier.maximumQuantity === null || quantity <= tier.maximumQuantity),
  );

  if (matches.length !== 1) {
    throw new DomainPricingError("TIER_NOT_FOUND", "Exactly one quantity tier must match");
  }

  return matches[0]!;
}

export function validateQuantityTiers(tiers: readonly QuantityTier[]): void {
  for (const tier of tiers) {
    if (
      tier.minimumQuantity <= 0 ||
      (tier.maximumQuantity !== null && tier.maximumQuantity < tier.minimumQuantity) ||
      tier.basePrice.isNegative() ||
      tier.basePrice.isZero()
    ) {
      throw new DomainPricingError("TIER_OVERLAP", "Quantity tier bounds and price are invalid");
    }
  }

  const ordered = [...tiers].sort((left, right) => left.minimumQuantity - right.minimumQuantity);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;
    if (previous.maximumQuantity === null || current.minimumQuantity <= previous.maximumQuantity) {
      throw new DomainPricingError("TIER_OVERLAP", "Quantity tiers must not overlap");
    }
  }
}

function calculateBillableQuantity(input: QuoteCalculationInput): {
  billableQuantity: Prisma.Decimal;
  areaPerPiece: Prisma.Decimal | null;
  totalArea: Prisma.Decimal | null;
} {
  const quantity = new Prisma.Decimal(input.quantity);
  if (input.unit !== "SQUARE_METER" && input.unit !== "LINEAR_METER") {
    return { billableQuantity: quantity, areaPerPiece: null, totalArea: null };
  }

  if (!input.width || !input.dimensionUnit) {
    throw new DomainPricingError("INVALID_DIMENSIONS", "Dimensional pricing requires a positive width and unit");
  }

  const widthMeters = toMeters(input.width, input.dimensionUnit);
  if (input.unit === "LINEAR_METER") {
    return { billableQuantity: widthMeters.mul(quantity), areaPerPiece: null, totalArea: null };
  }

  if (!input.height) {
    throw new DomainPricingError("INVALID_DIMENSIONS", "Area pricing requires a positive height");
  }

  const heightMeters = toMeters(input.height, input.dimensionUnit);
  const areaPerPiece = widthMeters.mul(heightMeters);
  return {
    billableQuantity: areaPerPiece.mul(quantity),
    areaPerPiece,
    totalArea: areaPerPiece.mul(quantity),
  };
}

export function calculateQuote(input: QuoteCalculationInput): QuoteCalculation {
  const { billableQuantity, areaPerPiece, totalArea } = calculateBillableQuantity(input);
  const baseAmount = input.tier.basePrice.mul(billableQuantity);
  let adjustmentAmount = new Prisma.Decimal(0);
  let finalAmount = baseAmount;
  let customerRuleId: string | null = null;

  if (input.customerAdjustment?.kind === "FIXED") {
    if (input.customerAdjustment.amount.isNegative() || input.customerAdjustment.amount.isZero()) {
      throw new DomainPricingError("INVALID_AMOUNT", "Fixed customer price must be greater than zero");
    }
    finalAmount = input.customerAdjustment.amount.mul(billableQuantity);
    adjustmentAmount = finalAmount.sub(baseAmount);
    customerRuleId = input.customerAdjustment.ruleId;
  }

  if (input.customerAdjustment?.kind === "PERCENT_DISCOUNT") {
    const percent = input.customerAdjustment.percent;
    if (percent.isNegative() || percent.gte(ONE_HUNDRED)) {
      throw new DomainPricingError("INVALID_AMOUNT", "Customer discount must be between 0 and 100 percent");
    }
    adjustmentAmount = baseAmount.mul(percent).div(ONE_HUNDRED).neg();
    finalAmount = baseAmount.add(adjustmentAmount);
    customerRuleId = input.customerAdjustment.ruleId;
  }

  return {
    billableQuantity,
    areaPerPiece,
    totalArea,
    baseAmount,
    adjustmentAmount,
    finalAmount: finalAmount.div(ONE_EGP).round().mul(ONE_EGP),
    customerRuleId,
  };
}
