// Integration test for recordExpense() — tasks.md T035, US4.
// Permission, validation, category config, order/work-item coherence,
// audit (+attachmentIds with a receipt), no-write-on-refusal.

import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { listExpenses, recordExpense } from "~/server/finance";
import { ForbiddenError } from "~/server/auth/authorize";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let reception: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor(
    "expense-accounting",
    ["expense.record", "finance.view"],
  );
  reception = await seedFinanceActor("expense-reception", ["finance.view"]);
  customerId = await seedCustomer("Expense");
});

describe("recordExpense (integration, US4)", () => {
  it("records an expense with audit, listed with approval flag derived from threshold", async () => {
    const before = await testDb.auditEvent.count({
      where: { action: "expense.recorded", actorId: accounting.userId },
    });
    const expense = await recordExpense(accounting, {
      amount: "250",
      category: "Transport",
      expenseDate: "2026-09-20",
      employee: "Mohamed",
      description: "delivery fuel",
    });
    expect(expense.amount).toBe("250");
    expect(expense.category).toBe("Transport");
    expect(expense.expenseDate).toBe("2026-09-20");
    // Below default threshold 1000 → no approval flag.
    expect(expense.awaitingApproval).toBe(false);

    const events = await testDb.auditEvent.count({
      where: { action: "expense.recorded", actorId: accounting.userId },
    });
    expect(events).toBe(before + 1);

    const listed = await listExpenses({ category: "Transport", pageSize: 100 });
    expect(listed.rows.some((row) => row.id === expense.id)).toBe(true);
  });

  it("attaches a receipt photo with attachmentIds in the audit event", async () => {
    const expense = await recordExpense(accounting, {
      amount: "80",
      category: "Supplies",
      expenseDate: "2026-09-21",
      employee: "Sara",
      description: "toner",
      receipt: {
        stream: Readable.from([Buffer.from("fake-receipt-bytes")]),
        fileName: "receipt.png",
      },
    });
    expect(expense.attachmentId).not.toBeNull();
    const event = await testDb.auditEvent.findFirst({
      where: { action: "expense.recorded", entityId: expense.id },
    });
    expect(event).not.toBeNull();
    expect(Array.isArray(event?.attachmentIds)).toBe(true);
    expect((event?.attachmentIds as string[]).length).toBe(1);
  });

  it("links an expense to an order and work item coherently", async () => {
    const { orderId, workItemIds } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["100"],
    });
    const expense = await recordExpense(accounting, {
      amount: "400",
      category: "Material",
      expenseDate: "2026-09-22",
      employee: "Ali",
      description: "vinyl roll",
      orderId,
      workItemId: workItemIds[0],
    });
    expect(expense.orderId).toBe(orderId);
    expect(expense.workItemId).toBe(workItemIds[0]);

    // Work item from another order → VALIDATION.
    const other = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["100"],
    });
    await expect(
      recordExpense(accounting, {
        amount: "10",
        category: "Material",
        expenseDate: "2026-09-22",
        employee: "Ali",
        description: "x",
        orderId,
        workItemId: other.workItemIds[0],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuses invalid input, inactive category, and missing permission", async () => {
    const base = {
      category: "Transport",
      expenseDate: "2026-09-22",
      employee: "Ali",
      description: "x",
    };
    await expect(
      recordExpense(accounting, { ...base, amount: "0" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      recordExpense(accounting, { ...base, amount: "10", category: "Bribe" }),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_CONFIGURED" });
    await expect(
      recordExpense(accounting, { ...base, amount: "10", employee: "" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const auditBefore = await testDb.auditEvent.count({ where: { actorId: reception.userId } });
    await expect(
      recordExpense(reception, { ...base, amount: "10" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await testDb.auditEvent.count({ where: { actorId: reception.userId } })).toBe(auditBefore);
  });
});
