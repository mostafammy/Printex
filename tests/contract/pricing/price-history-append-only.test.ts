// Contract test for append-only price history — tasks.md T019, US2.
// Later price decisions never rewrite earlier amounts/sources/reasons, and
// the database itself rejects destructive writes (constitution III).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  seedCustomer,
  seedOrderWithWorkItem,
  seedPriceList,
  seedPricingPolicy,
  seedPricingUser,
  seedProductType,
} from "../../helpers/pricingSeed";
import { getPriceHistory, setPrice } from "~/server/pricing";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let setter: Actor;
let overrider: Actor;
let customerId: string;
let productId: string;

beforeAll(async () => {
  setter = await seedPricingUser("history-setter", ["pricing.set_variable"]);
  overrider = await seedPricingUser("history-overrider", ["pricing.override"]);
  customerId = await seedCustomer("History");
  productId = await seedProductType("HistoryProduct");
  await seedPricingPolicy(productId, "VARIABLE", setter.userId);
  await seedPriceList({
    productTypeId: productId,
    unit: "PIECE",
    createdById: setter.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "10" }],
  });
});

describe("price history is append-only (contract, US2)", () => {
  it("keeps prior amounts, sources and reasons unchanged after later price decisions", async () => {
    const { workItemId } = await seedOrderWithWorkItem({
      customerId,
      createdById: setter.userId,
      productTypeId: productId,
      quantity: 2,
    });

    const first = await setPrice(setter, {
      workItemId,
      kind: "VARIABLE",
      amount: "10",
      reason: "opening rate",
    });
    const second = await setPrice(overrider, {
      workItemId,
      kind: "OVERRIDE",
      amount: "15",
      reason: "late correction",
    });

    const firstRow = await testDb.workItemPrice.findUniqueOrThrow({ where: { id: first.id } });
    const secondRow = await testDb.workItemPrice.findUniqueOrThrow({ where: { id: second.id } });

    expect(Number(firstRow.amount)).toBe(10);
    expect(firstRow.source).toBe("MANUAL");
    expect(firstRow.reason).toBe("opening rate");
    expect(firstRow.setById).toBe(setter.userId);
    expect(firstRow.replacedAt).toBeNull();

    expect(Number(secondRow.amount)).toBe(15);
    expect(secondRow.reason).toBe("late correction");

    // The readable history surface exposes both decisions with actor names.
    const history = await getPriceHistory(workItemId);
    expect(history).toHaveLength(2);
    expect(history[0]?.id).toBe(second.id); // newest first
    expect(history[1]?.id).toBe(first.id);
    expect(history[1]?.setByName).toBeTruthy();
    expect(history[1]?.amount).toBe(firstRow.amount.toString());
  });

  it("rejects UPDATE and DELETE of commercial price rows at the database level", async () => {
    const { workItemId } = await seedOrderWithWorkItem({
      customerId,
      createdById: setter.userId,
      productTypeId: productId,
      quantity: 1,
    });
    const price = await setPrice(setter, {
      workItemId,
      kind: "VARIABLE",
      amount: "20",
      reason: "baseline",
    });

    await expect(
      testDb.$executeRawUnsafe(`UPDATE "WorkItemPrice" SET amount = 1 WHERE id = $1`, price.id),
    ).rejects.toThrow(/append-only/i);

    await expect(
      testDb.$executeRawUnsafe(`DELETE FROM "WorkItemPrice" WHERE id = $1`, price.id),
    ).rejects.toThrow(/append-only/i);

    const row = await testDb.workItemPrice.findUniqueOrThrow({ where: { id: price.id } });
    expect(Number(row.amount)).toBe(20);
    expect(row.reason).toBe("baseline");
  });
});
