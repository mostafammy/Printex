// Integration test for dailyCashSummary — tasks.md T049, US7.
// SC-007 method totals/counts/drill-down + voided excluded;
// SC-012 shop-local bucketing (23:30 local lands on that local date).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dailyCashSummary, recordPayment, todayShopLocalDate, voidPayment } from "~/server/finance";
import { shopLocalDate } from "~/server/finance/time";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  const { testDb } = await import("../../helpers/testDb");
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("cash-accounting", ["payment.record", "payment.void", "finance.view"]);
  customerId = await seedCustomer("DailyCash");
});

describe("dailyCashSummary (integration, US7)", () => {
  it("groups non-void payments by method with counts and drill-down IDs (SC-007)", async () => {
    const today = await todayShopLocalDate();
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["2000"],
    });
    // Use occurredAt "now" (shop-local today) for each.
    await recordPayment(accounting, { orderId, amount: "500", method: "Cash", source: "Reception desk" });
    await recordPayment(accounting, { orderId, amount: "300", method: "Card", source: "Reception desk" });
    const third = await recordPayment(accounting, { orderId, amount: "200", method: "Cash", source: "Reception desk" });

    let summary = await dailyCashSummary(today);
    const cash = summary.lines.find((line) => line.method === "Cash");
    const card = summary.lines.find((line) => line.method === "Card");
    expect(cash?.total).toBe("700");
    expect(cash?.count).toBe(2);
    expect(card?.total).toBe("300");
    expect(card?.count).toBe(1);
    expect(summary.paymentIds.length).toBe(3);
    // grand total = 1000 + whatever else this date already has — assert ours included.
    expect(Number(summary.grandTotal)).toBeGreaterThanOrEqual(1000);

    // Voided excluded.
    await voidPayment(accounting, { paymentId: third.payment.id, reason: "test void" });
    summary = await dailyCashSummary(today);
    const cashAfter = summary.lines.find((line) => line.method === "Cash");
    expect(cashAfter?.total).toBe("500");
    expect(cashAfter?.count).toBe(1);
    expect(summary.paymentIds).not.toContain(third.payment.id);
  });

  it("buckets by shop-local calendar date, not UTC (SC-012)", async () => {
    const timezone = "Africa/Cairo";
    // 23:30 Cairo (UTC+2/+3) on a known local date — construct from UTC.
    const localDate = "2026-09-24";
    const utcInstant = new Date("2026-09-24T21:30:00.000Z"); // 23:30 Cairo (UTC+2)
    const { shopLocalDayBoundsUtc } = await import("~/server/finance/time");
    const { startUtc, endUtc } = shopLocalDayBoundsUtc(localDate, timezone);
    expect(utcInstant.getTime()).toBeGreaterThanOrEqual(startUtc.getTime());
    expect(utcInstant.getTime()).toBeLessThan(endUtc.getTime());
    // And the same instant formats as the local date, not the UTC date next day.
    expect(shopLocalDate(utcInstant, timezone)).toBe(localDate);
    expect(shopLocalDate(new Date("2026-09-24T22:30:00.000Z"), timezone)).toBe("2026-09-25");
  });
});
