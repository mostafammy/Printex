import { Prisma } from "../../../generated/prisma";
import { audit, authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import { validateQuantityTiers, type PricingUnit } from "./calculation";
import { DomainPricingError } from "./errors";

export type PricingMode = "FIXED" | "VARIABLE";

export type CreatePriceListInput = {
  readonly productTypeId: string;
  readonly unit: PricingUnit;
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date | null;
  readonly tiers: readonly {
    readonly minimumQuantity: number;
    readonly maximumQuantity: number | null;
    readonly basePrice: string;
  }[];
};

export type CreateCustomerRuleInput = {
  readonly customerId: string;
  readonly productTypeId: string;
  readonly unit: PricingUnit;
  readonly kind: "FIXED" | "PERCENT_DISCOUNT";
  readonly fixedPrice?: string;
  readonly discountPercent?: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date | null;
};

export async function setPricingPolicy(actor: Actor, productTypeId: string, mode: PricingMode): Promise<void> {
  authorize(actor, "admin.config");
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.productPricingPolicy.upsert({
      where: { productTypeId },
      create: { productTypeId, mode, updatedById: actor.userId },
      update: { mode, updatedById: actor.userId },
    });
    await audit.record(tx, {
      action: "pricing.policy_changed",
      entityType: "ProductPricingPolicy",
      entityId: productTypeId,
      actorId: actor.userId,
      after: { productTypeId, mode },
    });
  });
}

export async function createPriceList(actor: Actor, input: CreatePriceListInput): Promise<{ priceListId: string }> {
  authorize(actor, "admin.config");
  validateDateRange(input.effectiveFrom, input.effectiveTo);
  const tiers = input.tiers.map((tier, index) => ({
    id: `validation-${index}`,
    minimumQuantity: tier.minimumQuantity,
    maximumQuantity: tier.maximumQuantity,
    basePrice: new Prisma.Decimal(tier.basePrice),
  }));
  validateQuantityTiers(tiers);

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const overlapping = await tx.priceList.findFirst({
      where: {
        productTypeId: input.productTypeId,
        unit: input.unit,
        status: "ACTIVE",
        effectiveFrom: { lt: input.effectiveTo ?? new Date("9999-12-31") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
      },
      select: { id: true },
    });
    if (overlapping) throw new DomainPricingError("EFFECTIVE_DATE_CONFLICT", "Price list dates overlap");

    const priceList = await tx.priceList.create({
      data: {
        productTypeId: input.productTypeId,
        unit: input.unit,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdById: actor.userId,
        tiers: {
          create: input.tiers.map((tier) => ({
            minimumQuantity: tier.minimumQuantity,
            maximumQuantity: tier.maximumQuantity,
            basePrice: new Prisma.Decimal(tier.basePrice),
          })),
        },
      },
    });
    await audit.record(tx, {
      action: "pricing.price_list_created",
      entityType: "PriceList",
      entityId: priceList.id,
      actorId: actor.userId,
      after: { productTypeId: input.productTypeId, unit: input.unit },
    });
    return { priceListId: priceList.id };
  });
}

export async function retirePriceList(actor: Actor, priceListId: string): Promise<void> {
  authorize(actor, "admin.config");
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.priceList.update({ where: { id: priceListId }, data: { status: "RETIRED" } });
    await audit.record(tx, {
      action: "pricing.price_list_retired",
      entityType: "PriceList",
      entityId: priceListId,
      actorId: actor.userId,
    });
  });
}

export async function createCustomerPricingRule(
  actor: Actor,
  input: CreateCustomerRuleInput,
): Promise<{ ruleId: string }> {
  authorize(actor, "admin.config");
  validateDateRange(input.effectiveFrom, input.effectiveTo);
  const fixedPrice = input.fixedPrice === undefined ? null : new Prisma.Decimal(input.fixedPrice);
  const discountPercent = input.discountPercent === undefined ? null : new Prisma.Decimal(input.discountPercent);
  if (input.kind === "FIXED" && (!fixedPrice || fixedPrice.isNegative() || fixedPrice.isZero())) {
    throw new DomainPricingError("INVALID_AMOUNT", "Fixed customer price must be positive");
  }
  if (input.kind === "PERCENT_DISCOUNT" && (!discountPercent || discountPercent.isNegative() || discountPercent.gte(100))) {
    throw new DomainPricingError("INVALID_AMOUNT", "Discount must be between 0 and 100 percent");
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const overlapping = await tx.customerPricingRule.findFirst({
      where: {
        customerId: input.customerId,
        productTypeId: input.productTypeId,
        unit: input.unit,
        status: "ACTIVE",
        effectiveFrom: { lt: input.effectiveTo ?? new Date("9999-12-31") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
      },
      select: { id: true },
    });
    if (overlapping) throw new DomainPricingError("EFFECTIVE_DATE_CONFLICT", "Customer rule dates overlap");

    const rule = await tx.customerPricingRule.create({
      data: {
        customerId: input.customerId,
        productTypeId: input.productTypeId,
        unit: input.unit,
        kind: input.kind,
        fixedPrice,
        discountPercent,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdById: actor.userId,
      },
    });
    await audit.record(tx, {
      action: "pricing.customer_rule_created",
      entityType: "CustomerPricingRule",
      entityId: rule.id,
      actorId: actor.userId,
      after: { customerId: input.customerId, productTypeId: input.productTypeId, kind: input.kind },
    });
    return { ruleId: rule.id };
  });
}

function validateDateRange(effectiveFrom: Date, effectiveTo?: Date | null): void {
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw new DomainPricingError("EFFECTIVE_DATE_CONFLICT", "Effective end must be after effective start");
  }
}