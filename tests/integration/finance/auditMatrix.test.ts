// Audit completeness matrix — tasks.md T058 (Polish / SC-005).
// All nine finance audit actions fire with actor + timestamp; refused
// attempts write nothing.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  approveExpense,
  recordDirectCost,
  recordExpense,
  recordPayment,
  updateCredit,
  voidExpense,
  voidPayment,
} from "~/server/finance";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let admin: Awaited<ReturnType<typeof seedFinanceActor>>;
let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  admin = await seedFinanceActor("auditmatrix-admin", ["admin.config", "finance.view"]);
  accounting = await seedFinanceActor("auditmatrix-accounting", [
    "payment.record",
    "payment.void",
    "expense.record",
    "finance.view",
  ]);
  customerId = await seedCustomer("AuditMatrix");
});

async function assertEvent(action: string, entityId: string, actorId: string, needsReason = false) {
  const events = await testDb.auditEvent.findMany({ where: { action, entityId } });
  expect(events.length).toBeGreaterThanOrEqual(1);
  const event = events[events.length - 1]!;
  expect(event.actorId).toBe(actorId);
  expect(event.createdAt).toBeInstanceOf(Date);
  if (needsReason) {
    expect(typeof event.reason).toBe("string");
    expect((event.reason ?? "").length).toBeGreaterThan(0);
  }
}

describe("finance audit matrix (T058 / SC-005)", () => {
  it("writes all nine finance audit actions with actor + timestamp", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["100"],
    });

    // 1. payment.recorded
    const payment = await recordPayment(accounting, {
      orderId,
      amount: "100",
      method: "Cash",
      source: "Reception desk",
    });
    await assertEvent("payment.recorded", payment.payment.id, accounting.userId);

    // 2. payment.voided (reason required)
    await voidPayment(accounting, { paymentId: payment.payment.id, reason: "audit matrix" });
    await assertEvent("payment.voided", payment.payment.id, accounting.userId, true);

    // 3. expense.recorded
    const expense = await recordExpense(accounting, {
      amount: "2000",
      category: "Material",
      expenseDate: "2026-09-20",
      employee: "x",
      description: "audit matrix",
    });
    await assertEvent("expense.recorded", expense.id, accounting.userId);

    // 4. expense.voided (reason)
    await voidExpense(accounting, { expenseId: expense.id, reason: "audit matrix" });
    await assertEvent("expense.voided", expense.id, accounting.userId, true);

    // 5. expense.approved
    const approvable = await recordExpense(accounting, {
      amount: "5000",
      category: "Material",
      expenseDate: "2026-09-20",
      employee: "x",
      description: "approvable",
    });
    await approveExpense(admin, { expenseId: approvable.id });
    await assertEvent("expense.approved", approvable.id, admin.userId);

    // 6. direct_cost.recorded
    const cost = await recordDirectCost(accounting, {
      orderId,
      amount: "50",
      costDate: "2026-09-20",
      description: "audit matrix",
    });
    await assertEvent("direct_cost.recorded", cost.id, accounting.userId);

    // 7. direct_cost.voided (reason)
    const { voidDirectCost } = await import("~/server/finance");
    await voidDirectCost(accounting, { directCostId: cost.id, reason: "audit matrix" });
    await assertEvent("direct_cost.voided", cost.id, accounting.userId, true);

    // 8. credit.updated (reason)
    await updateCredit(admin, {
      customerId,
      creditApproved: true,
      creditLimit: "250",
      reason: "audit matrix",
    });
    await assertEvent("credit.updated", customerId, admin.userId, true);

    // 9. config.updated
    const { getFinanceConfig, updateFinanceConfig } = await import("~/server/finance");
    const config = await getFinanceConfig();
    await updateFinanceConfig(admin, { shopTimezone: config.shopTimezone });
    await assertEvent("config.updated", "finance-config", admin.userId);
  });

  it("refused attempts write no audit event", async () => {
    const reception = await seedFinanceActor("auditmatrix-reception", ["finance.view"]);
    const before = await testDb.auditEvent.count({ where: { actorId: reception.userId } });
    const { ForbiddenError } = await import("~/server/auth/authorize");

    await expect(
      recordPayment(reception, {
        orderId: "any",
        amount: "1",
        method: "Cash",
        source: "Reception desk",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await testDb.auditEvent.count({ where: { actorId: reception.userId } })).toBe(before);
  });
});
