// Integration test for recordPayment() — tasks.md T013, US1.
// SC-001 fixture: order Total 1000 (600 + 400 Work Items), record 400 then 600;
// receipt numbers allocated; payment.recorded audit committed atomically.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  recordPayment,
  orderSummary,
} from "~/server/finance";
import {
  seedCustomer,
  seedFinanceActor,
  seedPricedOrder,
} from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("payrec-accounting", [
    "payment.record",
    "payment.void",
    "expense.record",
    "finance.view",
  ]);
  customerId = await seedCustomer("PayRecord");
});

describe("recordPayment (integration, US1)", () => {
  it("computes Total/Paid/Remaining across partial payments (SC-001)", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["600", "400"],
    });

    const empty = await orderSummary(orderId);
    expect(empty.status).toBe("AVAILABLE");
    if (empty.status !== "AVAILABLE") return;
    expect(empty.total).toBe("1000");
    expect(empty.paid).toBe("0");
    expect(empty.remaining).toBe("1000");
    expect(empty.pricingIncomplete).toBe(false);

    const first = await recordPayment(accounting, {
      orderId,
      amount: "400",
      method: "Cash",
      source: "Reception desk",
    });
    expect(first.payment.amount).toBe("400");
    expect(first.payment.receiptNumber).toBeGreaterThan(0);
    expect(first.summary.status).toBe("AVAILABLE");
    if (first.summary.status === "AVAILABLE") {
      expect(first.summary.paid).toBe("400");
      expect(first.summary.remaining).toBe("600");
    }

    const second = await recordPayment(accounting, {
      orderId,
      amount: "600",
      method: "Bank transfer",
      source: "Bank",
      note: "balance",
    });
    expect(second.summary.status).toBe("AVAILABLE");
    if (second.summary.status === "AVAILABLE") {
      expect(second.summary.paid).toBe("1000");
      expect(second.summary.remaining).toBe("0");
    }
    expect(second.payment.receiptNumber).toBeGreaterThan(first.payment.receiptNumber);
    expect(second.payment.note).toBe("balance");
  });

  it("accepts overpayment — Remaining may go <= 0 (edge case)", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["200"],
    });
    const result = await recordPayment(accounting, {
      orderId,
      amount: "250",
      method: "Cash",
      source: "Reception desk",
    });
    expect(result.summary.status).toBe("AVAILABLE");
    if (result.summary.status === "AVAILABLE") {
      expect(result.summary.remaining).toBe("-50");
    }
  });

  it("flags pricing-incomplete totals (FR-006)", async () => {
    const { orderId, workItemIds } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["300"],
    });
    // Add an unpriced Work Item to the same order.
    await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        quantity: 1,
        requiresDesign: false,
        requiresReview: false,
      },
    });
    const summary = await orderSummary(orderId);
    expect(summary.status).toBe("AVAILABLE");
    if (summary.status === "AVAILABLE") {
      expect(summary.pricingIncomplete).toBe(true);
      expect(summary.total).toBe("300");
    }
    expect(workItemIds).toHaveLength(1);
  });

  it("writes payment.recorded audit atomically with the insert", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["150"],
    });
    const before = await testDb.auditEvent.count({
      where: { action: "payment.recorded", actorId: accounting.userId },
    });
    const result = await recordPayment(accounting, {
      orderId,
      amount: "150",
      method: "Cash",
      source: "Reception desk",
    });
    const events = await testDb.auditEvent.findMany({
      where: { action: "payment.recorded", entityId: result.payment.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.actorId).toBe(accounting.userId);
    const after = await testDb.auditEvent.count({
      where: { action: "payment.recorded", actorId: accounting.userId },
    });
    expect(after).toBe(before + 1);
  });

  it("rejects invalid input: non-positive amount, unknown method, future date, missing order", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["10"],
    });
    await expect(
      recordPayment(accounting, { orderId, amount: "0", method: "Cash", source: "Reception desk" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      recordPayment(accounting, { orderId, amount: "10", method: "Bitcoin", source: "Reception desk" }),
    ).rejects.toMatchObject({ code: "METHOD_NOT_CONFIGURED" });
    await expect(
      recordPayment(accounting, {
        orderId,
        amount: "10",
        method: "Cash",
        source: "Reception desk",
        occurredAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      recordPayment(accounting, { orderId: "order_missing", amount: "10", method: "Cash", source: "Reception desk" }),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
  });
});
