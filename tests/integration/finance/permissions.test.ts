// Permission matrix integration test — tasks.md T057 (Polish).
// Every finance entry point × {Reception, Accounting, Admin/Owner} per
// contracts/authorization-audit.md.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  approveExpense,
  customerBalance,
  dailyCashSummary,
  listExpenses,
  orderProfitability,
  orderSummary,
  recordDirectCost,
  recordExpense,
  recordPayment,
  updateCredit,
  voidDirectCost,
  voidExpense,
  voidPayment,
} from "~/server/finance";
import { ForbiddenError } from "~/server/auth/authorize";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  const { testDb } = await import("../../helpers/testDb");
  await testDb.$disconnect();
});

// Reception: finance.view only — read-only.
// Accounting: payment.record/void + expense.record + finance.view.
// Admin/Owner: admin.config (+ whatever else) — credit/approval/config.
let reception: Awaited<ReturnType<typeof seedFinanceActor>>;
let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let admin: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;
let orderId: string;

beforeAll(async () => {
  reception = await seedFinanceActor("matrix-reception", ["finance.view"]);
  accounting = await seedFinanceActor("matrix-accounting", [
    "payment.record",
    "payment.void",
    "expense.record",
    "finance.view",
  ]);
  admin = await seedFinanceActor("matrix-admin", ["admin.config", "finance.view"]);
  customerId = await seedCustomer("PermMatrix");
  ({ orderId } = await seedPricedOrder({
    customerId,
    createdById: accounting.userId,
    prices: ["100"],
  }));
});

async function expectForbidden(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(ForbiddenError);
}

describe("finance permission matrix (T057)", () => {
  it("Reception: reads allowed, every mutation refused", async () => {
    // Reads succeed (pure computes — route-level finance.view check passed here by construction).
    await expect(orderSummary(orderId)).resolves.toBeTruthy();
    await expect(customerBalance(customerId)).resolves.toBeTruthy();
    await expect(listExpenses({})).resolves.toBeTruthy();
    await expect(orderProfitability(orderId)).resolves.toBeTruthy();
    await expect(dailyCashSummary("2026-09-25")).resolves.toBeTruthy();

    // Mutations refused.
    await expectForbidden(
      recordPayment(reception, { orderId, amount: "10", method: "Cash", source: "Reception desk" }),
    );
    await expectForbidden(
      recordExpense(reception, {
        amount: "10",
        category: "Transport",
        expenseDate: "2026-09-20",
        employee: "x",
        description: "x",
      }),
    );
    await expectForbidden(
      recordDirectCost(reception, { orderId, amount: "10", costDate: "2026-09-20", description: "x" }),
    );
    await expectForbidden(
      updateCredit(reception, { customerId, creditApproved: true, reason: "x" }),
    );
    await expectForbidden(approveExpense(reception, { expenseId: "any" }));
    await expectForbidden(voidPayment(reception, { paymentId: "any", reason: "x" }));
    await expectForbidden(voidExpense(reception, { expenseId: "any", reason: "x" }));
    await expectForbidden(voidDirectCost(reception, { directCostId: "any", reason: "x" }));
  });

  it("Accounting: payment/expense recording + voids allowed, admin-only refused", async () => {
    const payment = await recordPayment(accounting, {
      orderId,
      amount: "10",
      method: "Cash",
      source: "Reception desk",
    });
    await expect(voidPayment(accounting, { paymentId: payment.payment.id, reason: "matrix" })).resolves.toMatchObject({
      voided: true,
    });

    const expense = await recordExpense(accounting, {
      amount: "2000",
      category: "Material",
      expenseDate: "2026-09-20",
      employee: "x",
      description: "big spend",
    });
    await expect(voidExpense(accounting, { expenseId: expense.id, reason: "matrix" })).resolves.toMatchObject({
      voided: true,
    });

    const cost = await recordDirectCost(accounting, {
      orderId,
      amount: "30",
      costDate: "2026-09-20",
      description: "vendor",
    });
    await expect(voidDirectCost(accounting, { directCostId: cost.id, reason: "matrix" })).resolves.toMatchObject({
      voided: true,
    });

    // Admin-only actions refused for Accounting.
    await expectForbidden(
      updateCredit(accounting, { customerId, creditApproved: true, reason: "nope" }),
    );
    await expectForbidden(approveExpense(accounting, { expenseId: expense.id }));
  });

  it("Admin/Owner: credit + approval allowed, payment record refused without payment.record", async () => {
    const standing = await updateCredit(admin, {
      customerId,
      creditApproved: true,
      creditLimit: "500",
      reason: "owner approval",
    });
    expect(standing.creditApproved).toBe(true);

    const expense = await recordExpense(accounting, {
      amount: "3000",
      category: "Material",
      expenseDate: "2026-09-20",
      employee: "x",
      description: "approve me",
    });
    await expect(approveExpense(admin, { expenseId: expense.id })).resolves.toMatchObject({
      approved: true,
    });

    // admin.config alone does NOT grant payment recording.
    await expectForbidden(
      recordPayment(admin, { orderId, amount: "10", method: "Cash", source: "Reception desk" }),
    );
  });
});
