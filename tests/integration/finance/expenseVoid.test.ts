// Integration test for voidExpense — tasks.md T037, US4 (FR-016).
// No update/delete path; void with reason excludes from totals and
// profitability while the original stays retrievable.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  listExpenses,
  orderProfitability,
  recordExpense,
  voidExpense,
} from "~/server/finance";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("expensevoid-accounting", [
    "expense.record",
    "finance.view",
  ]);
  customerId = await seedCustomer("ExpenseVoid");
});

describe("voidExpense (integration, US4 / FR-016)", () => {
  it("excludes a voided expense from totals and profitability; original retrievable", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["1000"],
    });
    const expense = await recordExpense(accounting, {
      amount: "100",
      category: "Material",
      expenseDate: "2026-09-20",
      employee: "Ali",
      description: "ink",
      orderId,
    });

    // Counts in job expenses before void.
    let profit = await orderProfitability(orderId);
    expect(profit?.jobExpenses.total).toBe("100");

    const result = await voidExpense(accounting, {
      expenseId: expense.id,
      reason: "wrong amount",
    });
    expect(result.voided).toBe(true);

    profit = await orderProfitability(orderId);
    expect(profit?.jobExpenses.total).toBe("0");
    expect(profit?.jobExpenses.entries).toHaveLength(0);

    // Original retrievable with void flag + reason recorded in audit.
    const listed = await listExpenses({ includeVoided: true, pageSize: 100 });
    const row = listed.rows.find((r) => r.id === expense.id);
    expect(row).toBeDefined();
    expect(row?.voided).toBe(true);
    const events = await testDb.auditEvent.findMany({
      where: { action: "expense.voided", entityId: expense.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.reason).toBe("wrong amount");
  });

  it("reason required, double void refused, no update/delete path", async () => {
    const expense = await recordExpense(accounting, {
      amount: "50",
      category: "Supplies",
      expenseDate: "2026-09-20",
      employee: "Ali",
      description: "tape",
    });

    await expect(
      voidExpense(accounting, { expenseId: expense.id, reason: " " }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await voidExpense(accounting, { expenseId: expense.id, reason: "mistake" });
    await expect(
      voidExpense(accounting, { expenseId: expense.id, reason: "again" }),
    ).rejects.toMatchObject({ code: "ALREADY_VOIDED" });

    // Direct SQL refused (append-only REVOKE).
    await expect(
      testDb.$executeRaw`UPDATE "Expense" SET amount = 1 WHERE id = ${expense.id}`,
    ).rejects.toThrow();
    await expect(
      testDb.$executeRaw`DELETE FROM "Expense" WHERE id = ${expense.id}`,
    ).rejects.toThrow();
  });
});
