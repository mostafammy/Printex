// Integration test for expense approval — tasks.md T036, US4 (FR-013).
// Threshold 1000 (config default): 1500 flags awaiting approval everywhere
// yet counts immediately; Admin/Owner (admin.config) approves with audit;
// Accounting cannot approve; below threshold refuses; voided refuses.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { approveExpense, listExpenses, recordExpense, voidExpense } from "~/server/finance";
import { ForbiddenError } from "~/server/auth/authorize";
import { seedFinanceActor } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let admin: Awaited<ReturnType<typeof seedFinanceActor>>;
let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;

beforeAll(async () => {
  admin = await seedFinanceActor("approve-admin", ["admin.config"]);
  accounting = await seedFinanceActor("approve-accounting", ["expense.record", "finance.view"]);
});

describe("approveExpense (integration, US4 / FR-013)", () => {
  it("flags >= threshold immediately, counts anyway; Admin approves with audit; flag clears", async () => {
    const expense = await recordExpense(accounting, {
      amount: "1500",
      category: "External production",
      expenseDate: "2026-09-20",
      employee: "Vendor",
      description: "outsourced print run",
    });
    expect(expense.awaitingApproval).toBe(true);

    // Counted in totals regardless of approval state (never hidden/blocked).
    const listed = await listExpenses({ approval: "awaiting", pageSize: 100 });
    expect(listed.rows.some((r) => r.id === expense.id)).toBe(true);
    const counted = await listExpenses({ pageSize: 100 });
    expect(counted.rows.some((r) => r.id === expense.id && r.amount === "1500")).toBe(true);

    // Accounting (no admin.config) cannot approve.
    await expect(approveExpense(accounting, { expenseId: expense.id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    // Admin approves → approval row + audit + flag clears.
    const result = await approveExpense(admin, { expenseId: expense.id });
    expect(result.approved).toBe(true);
    const events = await testDb.auditEvent.findMany({
      where: { action: "expense.approved", entityId: expense.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.actorId).toBe(admin.userId);

    const after = await listExpenses({ pageSize: 100 });
    const row = after.rows.find((r) => r.id === expense.id);
    expect(row?.approvedAt).not.toBeNull();
    expect(row?.awaitingApproval).toBe(false);

    // Double approval refused.
    await expect(approveExpense(admin, { expenseId: expense.id })).rejects.toMatchObject({
      code: "ALREADY_APPROVED",
    });
  });

  it("below-threshold approval is NOT_REQUIRED", async () => {
    const expense = await recordExpense(accounting, {
      amount: "400",
      category: "Transport",
      expenseDate: "2026-09-20",
      employee: "Ali",
      description: "taxi",
    });
    expect(expense.awaitingApproval).toBe(false);
    await expect(approveExpense(admin, { expenseId: expense.id })).rejects.toMatchObject({
      code: "APPROVAL_NOT_REQUIRED",
    });
  });

  it("a voided expense cannot be approved", async () => {
    const expense = await recordExpense(accounting, {
      amount: "2000",
      category: "Material",
      expenseDate: "2026-09-20",
      employee: "Ali",
      description: "paper",
    });
    await voidExpense(accounting, { expenseId: expense.id, reason: "duplicate entry" });
    await expect(approveExpense(admin, { expenseId: expense.id })).rejects.toMatchObject({
      code: "ALREADY_VOIDED",
    });
  });
});
