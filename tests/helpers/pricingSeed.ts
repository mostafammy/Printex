// Shared fixtures for 051 pricing tests (T014+). Inserts the minimal
// Customer -> Order -> WorkItem graph plus pricing configuration via
// `testDb` (tests/helpers/testDb.ts) — no application code writes fixtures.

import { testDb } from "./testDb";
import type { Actor, Permission } from "~/server/auth";
import type { WorkItemState } from "~/server/core";
import type { PricingUnit } from "~/server/pricing";

let counter = 0;

export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${process.hrtime.bigint().toString()}_${counter}`;
}

/**
 * Creates a User row and returns an Actor carrying exactly `permissions`.
 * Per-user grants go through 001's UserPermission table so responsible-user
 * resolution (role + extra permissions) sees the same user the Actor does.
 */
export async function seedPricingUser(
  prefix: string,
  permissions: readonly Permission[] = [],
): Promise<Actor> {
  const userId = unique(prefix);
  await testDb.user.create({
    data: {
      id: userId,
      name: `Test ${prefix}`,
      email: `${userId}@local.invalid`,
      username: userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  for (const permission of permissions) {
    await testDb.userPermission.create({
      data: { userId, permission, grantedById: userId },
    });
  }
  return {
    userId,
    roles: [],
    permissions: new Set<Permission>(permissions),
    departmentIds: [],
  };
}

export async function seedCustomer(prefix: string): Promise<string> {
  const customer = await testDb.customer.create({
    data: { name: unique(prefix), normalizedName: unique(prefix.toLowerCase()) },
  });
  return customer.id;
}

export async function seedProductType(prefix: string): Promise<string> {
  const productType = await testDb.productType.create({
    data: { name: unique(prefix) },
  });
  return productType.id;
}

export async function seedPricingPolicy(
  productTypeId: string,
  mode: "FIXED" | "VARIABLE",
  updatedById: string,
): Promise<void> {
  await testDb.productPricingPolicy.create({
    data: { productTypeId, mode, updatedById },
  });
}

export type SeedTier = {
  readonly minimumQuantity: number;
  readonly maximumQuantity: number | null;
  readonly basePrice: string;
};

export async function seedPriceList(params: {
  readonly productTypeId: string;
  readonly unit: PricingUnit;
  readonly createdById: string;
  readonly tiers: readonly SeedTier[];
  readonly effectiveFrom?: Date;
  readonly effectiveTo?: Date | null;
}): Promise<{ priceListId: string; tierIds: string[] }> {
  const priceList = await testDb.priceList.create({
    data: {
      productTypeId: params.productTypeId,
      unit: params.unit,
      createdById: params.createdById,
      effectiveFrom: params.effectiveFrom ?? new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: params.effectiveTo ?? null,
      tiers: {
        create: params.tiers.map((tier) => ({
          minimumQuantity: tier.minimumQuantity,
          maximumQuantity: tier.maximumQuantity,
          basePrice: tier.basePrice,
        })),
      },
    },
    include: { tiers: true },
  });
  return { priceListId: priceList.id, tierIds: priceList.tiers.map((tier) => tier.id) };
}

export async function seedCustomerRule(params: {
  readonly customerId: string;
  readonly productTypeId: string;
  readonly unit: PricingUnit;
  readonly createdById: string;
  readonly kind: "FIXED" | "PERCENT_DISCOUNT";
  readonly fixedPrice?: string;
  readonly discountPercent?: string;
  readonly effectiveFrom?: Date;
  readonly effectiveTo?: Date | null;
}): Promise<string> {
  const rule = await testDb.customerPricingRule.create({
    data: {
      customerId: params.customerId,
      productTypeId: params.productTypeId,
      unit: params.unit,
      createdById: params.createdById,
      kind: params.kind,
      fixedPrice: params.fixedPrice,
      discountPercent: params.discountPercent,
      effectiveFrom: params.effectiveFrom ?? new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: params.effectiveTo ?? null,
    },
  });
  return rule.id;
}

export async function seedOrderWithWorkItem(params: {
  readonly customerId: string;
  readonly createdById: string;
  readonly productTypeId?: string | null;
  readonly quantity?: number;
  readonly widthValue?: number;
  readonly heightValue?: number;
  readonly dimensionUnit?: "MM" | "CM" | "M" | "IN";
  readonly state?: WorkItemState;
  readonly priority?: "NORMAL" | "URGENT";
}): Promise<{ orderId: string; workItemId: string }> {
  const order = await testDb.order.create({
    data: {
      customerId: params.customerId,
      channel: "WALK_IN",
      priority: params.priority ?? "NORMAL",
      mode: "GROUPED",
      createdById: params.createdById,
    },
  });
  const workItem = await testDb.workItem.create({
    data: {
      orderId: order.id,
      productTypeId: params.productTypeId ?? null,
      state: params.state ?? "NEW",
      quantity: params.quantity ?? 1,
      widthValue: params.widthValue,
      heightValue: params.heightValue,
      dimensionUnit: params.dimensionUnit,
      requiresDesign: false,
      requiresReview: false,
    },
  });
  return { orderId: order.id, workItemId: workItem.id };
}
