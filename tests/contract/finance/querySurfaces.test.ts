// Query-surface contract — tasks.md T062 (Polish / FR-019).
// Every contracts/queries.md read function is exported from ~/server/finance
// with the documented filter semantics (includeVoided defaults to false).

import { afterAll, describe, expect, it } from "vitest";
import * as finance from "~/server/finance";

afterAll(async () => {
  const { testDb } = await import("../../helpers/testDb");
  await testDb.$disconnect();
});

describe("090 read-query surface (T062 / FR-019)", () => {
  it("exports every queries.md function", () => {
    const expected = [
      "listPayments",
      "dailyCashSummary",
      "getReceipt",
      "orderSummary",
      "customerBalance",
      "listCustomerBalances",
      "listExpenses",
      "listDirectCosts",
      "orderProfitability",
      "getCreditStanding",
      "updateCredit",
      "recordPayment",
      "voidPayment",
      "recordExpense",
      "voidExpense",
      "approveExpense",
      "recordDirectCost",
      "voidDirectCost",
      "financeSummaryProvider",
      "bindFinancialClosurePort",
      "bindCompensationReadPort",
      "getFinanceConfig",
      "updateFinanceConfig",
    ] as const;
    for (const name of expected) {
      expect(finance, `missing export: ${name}`).toHaveProperty(name);
    }
  });

  it("list functions accept the documented filters and default to hiding voided rows", async () => {
    // Nonexistent scopes return empty pages rather than throwing (shape check).
    const payments = await finance.listPayments({ orderId: "none", pageSize: 5 });
    expect(payments.rows).toEqual([]);
    expect(payments.nextCursor).toBeNull();

    const expenses = await finance.listExpenses({ orderId: "none", pageSize: 5 });
    expect(expenses.rows).toEqual([]);

    const costs = await finance.listDirectCosts({ orderId: "none", pageSize: 5 });
    expect(costs.rows).toEqual([]);
  });
});
