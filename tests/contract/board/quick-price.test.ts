/**
 * Contract test for the quick-price release flow.
 * Dropping a WAITING_PRICING card pops the quick-price sheet only while
 * pricing is PENDING; confirming prices the item and releases it to
 * READY_FOR_PRODUCTION in one gesture.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "~/server/auth";
import { edgeCatalog, moveWorkItem } from "~/server/board";
import type { BoardCard } from "~/lib/board/types";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";

describe("Quick-price release contract", { timeout: 60000 }, () => {
  let adminActor: Actor;
  let orderId: string;
  let productTypeId: string;

  beforeAll(async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    orderId = await seedOrder({ customerId, createdById: userId });

    adminActor = {
      id: userId,
      userId,
      roles: ["ADMIN_OWNER"],
      permissions: new Set([
        "pricing.use_fixed",
        "pricing.set_variable",
        "production.operate",
      ]),
      departmentIds: [],
    };

    const productType = await testDb.productType.create({
      data: { name: `QuickPrice ${Date.now()}`, pricingModeHint: "VARIABLE" },
    });
    productTypeId = productType.id;
    await testDb.productPricingPolicy.create({
      data: { productTypeId, mode: "VARIABLE", updatedById: userId },
    });
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  function cardWithPricing(pricing: BoardCard["pricing"]): BoardCard {
    return {
      id: "card-quick-price",
      orderId: "ord-1",
      orderNumber: 101,
      orderTagHue: 180,
      customerName: "عميل",
      title: "عمل",
      quantity: 10,
      state: "WAITING_PRICING",
      priority: "NORMAL",
      pricing,
      enteredStationAt: new Date().toISOString(),
      targetMinutes: null,
      dueAt: null,
      reworkCount: 0,
      assignee: null,
      departmentId: null,
      moves: [],
      lastTransitionId: null,
      lastTransitionAt: new Date().toISOString(),
    };
  }

  it("offers the quick-price sheet while PENDING, direct move once PRICED", () => {
    const pending = edgeCatalog
      .offer(adminActor, cardWithPricing("PENDING"))
      .find((m) => m.edgeId === "WAITING_PRICING->READY_FOR_PRODUCTION");
    expect(pending?.kind).toBe("SHEET");
    expect(pending?.sheet).toBe("quick-price");

    const priced = edgeCatalog
      .offer(adminActor, cardWithPricing("PRICED"))
      .find((m) => m.edgeId === "WAITING_PRICING->READY_FOR_PRODUCTION");
    expect(priced?.kind).toBe("DIRECT");
    expect(priced?.sheet).toBeNull();
  });

  it("manual price input prices the item and releases it to production", async () => {
    const item = await testDb.workItem.create({
      data: { orderId, state: "WAITING_PRICING", productTypeId },
    });
    await testDb.pricingStatus.create({ data: { workItemId: item.id, status: "PENDING" } });

    const res = await moveWorkItem(adminActor, {
      workItemId: item.id,
      edgeId: "WAITING_PRICING->READY_FOR_PRODUCTION",
      input: { kind: "VARIABLE", amount: "2500", reason: "سعر متفق عليه" },
      clientMoveId: `move-quick-price-${Date.now()}`,
    });

    expect(res.ok).toBe(true);
    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.state).toBe("READY_FOR_PRODUCTION");
    const status = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId: item.id } });
    expect(status.status).toBe("PRICED");
    const prices = await testDb.workItemPrice.findMany({ where: { workItemId: item.id } });
    expect(prices).toHaveLength(1);
  });
});
