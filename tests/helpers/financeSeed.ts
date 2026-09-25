// Shared fixtures for 052-finance tests (T013+). Reuses the 051 seed helpers
// for the Customer -> Order -> WorkItem graph and adds priced Work Items plus
// finance-specific users. Fixtures insert via `testDb` directly — no
// application code writes fixtures (pricingSeed.ts convention).

export { seedCustomer, seedOrderWithWorkItem, seedPriceList, seedPricingPolicy, seedPricingUser, seedProductType, unique } from "./pricingSeed";
export type { SeedTier } from "./pricingSeed";
import { seedPricingUser, unique } from "./pricingSeed";
import type { Actor, Permission } from "~/server/auth";

/** Alias of seedPricingUser for finance tests (same UserPermission mechanism). */
export function seedFinanceActor(
  prefix: string,
  permissions: readonly Permission[] = [],
): Promise<Actor> {
  return seedPricingUser(prefix, permissions);
}

import { testDb } from "./testDb";
import type { WorkItemState } from "~/server/core";

/**
 * Creates an order whose Work Items each carry a current PRICED price
 * (WorkItemPrice + PricingStatus rows written directly as fixture data),
 * so orderSummary Total is deterministic without running the pricing flow.
 */
export async function seedPricedOrder(params: {
  readonly customerId: string;
  readonly createdById: string;
  /** One Decimal-string price per Work Item. */
  readonly prices: readonly string[];
  readonly productTypeId?: string | null;
  readonly state?: WorkItemState;
}): Promise<{ orderId: string; workItemIds: string[] }> {
  const order = await testDb.order.create({
    data: {
      customerId: params.customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "GROUPED",
      createdById: params.createdById,
    },
  });

  const workItemIds: string[] = [];
  for (const price of params.prices) {
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        productTypeId: params.productTypeId ?? null,
        state: params.state ?? "NEW",
        quantity: 1,
        requiresDesign: false,
        requiresReview: false,
      },
    });
    const created = await testDb.workItemPrice.create({
      data: {
        workItemId: workItem.id,
        amount: price,
        currency: "EGP",
        source: "MANUAL",
        setById: params.createdById,
        reason: "fixture",
      },
    });
    await testDb.pricingStatus.upsert({
      where: { workItemId: workItem.id },
      create: {
        workItemId: workItem.id,
        status: "PRICED",
        currentPriceId: created.id,
        updatedById: params.createdById,
      },
      update: {
        status: "PRICED",
        currentPriceId: created.id,
        updatedById: params.createdById,
      },
    });
    workItemIds.push(workItem.id);
  }
  return { orderId: order.id, workItemIds };
}

/** A cash customer (isCashCustomer = true) for credit-coverage assertions. */
export async function seedCashCustomer(prefix: string): Promise<string> {
  const customer = await testDb.customer.create({
    data: {
      name: unique(prefix),
      normalizedName: unique(prefix.toLowerCase()),
      isCashCustomer: true,
    },
  });
  return customer.id;
}
