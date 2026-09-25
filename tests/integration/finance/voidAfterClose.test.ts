// Integration test for the void-after-close review notice — tasks.md T024, US2.
// A void on an already-COMPLETED order that re-opens a positive remaining
// without credit emits exactly one finance.void_after_close notice to
// Accounting + Admin/Owner, inside the void's transaction; completion state
// is never reversed.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { recordPayment, voidPayment } from "~/server/finance";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("voidclose-accounting", ["payment.record", "payment.void", "finance.view"]);
  customerId = await seedCustomer("VoidClose");
});

describe("void-after-close notice (integration, US2 / SC-009)", () => {
  it("emits one notice when voiding re-opens remaining on a completed order", async () => {
    const { orderId, workItemIds } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["1000"],
      state: "COMPLETED",
    });
    const payment = await recordPayment(accounting, {
      orderId,
      amount: "1000",
      method: "Cash",
      source: "Reception desk",
    });

    const before = await testDb.notificationEvent.count({ where: { type: "finance.void_after_close" } });
    await voidPayment(accounting, { paymentId: payment.payment.id, reason: "wrong customer" });
    const after = await testDb.notificationEvent.count({ where: { type: "finance.void_after_close" } });
    expect(after).toBe(before + 1);

    const event = await testDb.notificationEvent.findFirst({
      where: { type: "finance.void_after_close", entityId: orderId },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event?.recipientRoles).toContain("ACCOUNTING");
    expect(event?.recipientRoles).toContain("ADMIN_OWNER");

    // Completion state unchanged — no auto-reopen (V1 assumption).
    const states = await testDb.workItem.findMany({
      where: { id: { in: workItemIds } },
      select: { state: true },
    });
    expect(states.every((s) => s.state === "COMPLETED")).toBe(true);
  });

  it("emits no notice when voiding a payment on an order that is not closed", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["100"],
      state: "NEW",
    });
    const payment = await recordPayment(accounting, {
      orderId,
      amount: "100",
      method: "Cash",
      source: "Reception desk",
    });
    const before = await testDb.notificationEvent.count({ where: { type: "finance.void_after_close" } });
    await voidPayment(accounting, { paymentId: payment.payment.id, reason: "mistake" });
    const after = await testDb.notificationEvent.count({ where: { type: "finance.void_after_close" } });
    expect(after).toBe(before);
  });
});
