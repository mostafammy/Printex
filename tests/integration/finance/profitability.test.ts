// Integration test for orderProfitability — tasks.md T046, US6. SC-004:
// revenue 1000 − costs 300 − job expenses 100 = 600 with drill-down IDs;
// unlinked/voided expenses excluded; pending price flags incomplete.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orderProfitability, recordDirectCost, recordExpense, voidDirectCost } from "~/server/finance";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  const { testDb } = await import("../../helpers/testDb");
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("profit-accounting", [
    "expense.record",
    "payment.record",
    "finance.view",
  ]);
  customerId = await seedCustomer("Profitability");
});

describe("orderProfitability (integration, US6)", () => {
  it("computes gross profit = revenue − direct costs − job expenses with drill-down sources (SC-004)", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["600", "400"],
    });

    await recordDirectCost(accounting, {
      orderId,
      amount: "200",
      costDate: "2026-09-10",
      description: "material",
    });
    await recordDirectCost(accounting, {
      orderId,
      amount: "100",
      costDate: "2026-09-11",
      description: "vendor",
    });
    const jobExpense = await recordExpense(accounting, {
      amount: "100",
      category: "Material",
      expenseDate: "2026-09-12",
      employee: "Ali",
      description: "job vinyl",
      orderId,
    });
    // Unlinked operating expense — must NOT count.
    await recordExpense(accounting, {
      amount: "500",
      category: "Maintenance",
      expenseDate: "2026-09-13",
      employee: "Ali",
      description: "machine service",
    });

    const profit = await orderProfitability(orderId);
    expect(profit).not.toBeNull();
    expect(profit!.revenue).toBe("1000");
    expect(profit!.directCosts.total).toBe("300");
    expect(profit!.jobExpenses.total).toBe("100");
    expect(profit!.grossProfit).toBe("600"); // 1000 − 300 − 100
    expect(profit!.pricingIncomplete).toBe(false);
    expect(profit!.sources.expenseIds).toContain(jobExpense.id);
    expect(profit!.sources.priceIds).toHaveLength(2);
    expect(profit!.directCosts.entries).toHaveLength(2);
  });

  it("excludes voided costs and flags incomplete pricing", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["500"],
    });
    const cost = await recordDirectCost(accounting, {
      orderId,
      amount: "50",
      costDate: "2026-09-10",
      description: "temp cost",
    });
    await voidDirectCost(accounting, { directCostId: cost.id, reason: "not for this job" });

    // Add an unpriced Work Item → pricingIncomplete.
    const { testDb } = await import("../../helpers/testDb");
    await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        quantity: 1,
        requiresDesign: false,
        requiresReview: false,
      },
    });

    const profit = await orderProfitability(orderId);
    expect(profit!.directCosts.total).toBe("0");
    expect(profit!.revenue).toBe("500");
    expect(profit!.pricingIncomplete).toBe(true);
    expect(profit!.grossProfit).toBe("500");
  });

  it("returns null for a missing order", async () => {
    expect(await orderProfitability("order_missing")).toBeNull();
  });
});
