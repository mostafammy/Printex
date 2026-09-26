// Integration test for getReceipt — tasks.md T053, US8. SC-010 fields match
// the stored payment + Remaining at print time; strictly increasing receipt
// numbers; voided projection carries voided: true (watermark).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getReceipt, recordPayment, voidPayment } from "~/server/finance";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  const { testDb } = await import("../../helpers/testDb");
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("receipt-accounting", ["payment.record", "payment.void", "finance.view"]);
  customerId = await seedCustomer("Receipt");
});

describe("getReceipt (integration, US8)", () => {
  it("projects stored payment fields + remaining after (SC-010)", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["800"],
    });
    const first = await recordPayment(accounting, {
      orderId,
      amount: "300",
      method: "Cash",
      source: "Reception desk",
      note: "deposit",
    });

    const receipt = await getReceipt(first.payment.id);
    expect(receipt.receiptNumber).toBe(first.payment.receiptNumber);
    expect(receipt.amount).toBe("300");
    expect(receipt.method).toBe("Cash");
    expect(receipt.source).toBe("Reception desk");
    expect(receipt.shopName).toBe("Printex");
    expect(receipt.orderId).toBe(orderId);
    expect(receipt.remainingAfter).toBe("500"); // 800 − 300
    expect(receipt.voided).toBe(false);
    expect(receipt.occurredAtLocal).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(receipt.recordedByName.length).toBeGreaterThan(0);

    // Second payment → strictly greater receipt number; remaining updates.
    const second = await recordPayment(accounting, {
      orderId,
      amount: "500",
      method: "Card",
      source: "Reception desk",
    });
    expect(second.payment.receiptNumber).toBeGreaterThan(first.payment.receiptNumber);
    const afterFull = await getReceipt(second.payment.id);
    expect(afterFull.remainingAfter).toBe("0");

    // Voided → watermark flag; fields still match the original payment.
    await voidPayment(accounting, { paymentId: second.payment.id, reason: "mistake" });
    const voidedReceipt = await getReceipt(second.payment.id);
    expect(voidedReceipt.voided).toBe(true);
    expect(voidedReceipt.amount).toBe("500");
    expect(voidedReceipt.remainingAfter).toBe("500");
  });

  it("rejects a missing payment", async () => {
    await expect(getReceipt("payment_missing")).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
  });
});
