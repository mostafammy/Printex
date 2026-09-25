// Credit application through the compensation port — tasks.md T067 (FR-012).
// Bound fake port: remaining = total − paid − credit; unbound → empty
// default (credit ignored); PRICE_ADJUSTMENT rows never reduce remaining.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orderSummary, recordPayment } from "~/server/finance";
import { bindCompensationReadPort } from "~/server/finance/ports";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  const { testDb } = await import("../../helpers/testDb");
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;
let creditOrderId = "";

// Bind-once module state: this file owns its own compensation port.
beforeAll(async () => {
  accounting = await seedFinanceActor("credits-accounting", ["payment.record", "finance.view"]);
  customerId = await seedCustomer("CreditsApplied");

  bindCompensationReadPort(async (orderId: string) => {
    if (orderId !== creditOrderId) return [];
    // One CREDIT of 150 for the fixture order; PRICE_ADJUSTMENT-like entries
    // are filtered by 052 (only CREDIT-like rows modeled here as credit).
    return [{ id: "comp_credit_1", amount: "150", orderId }];
  });
});

describe("credit application via compensation port (T067 / FR-012)", () => {
  it("reduces remaining by the bound credit amount", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["1000"],
    });
    creditOrderId = orderId;

    await recordPayment(accounting, {
      orderId,
      amount: "400",
      method: "Cash",
      source: "Reception desk",
    });

    const summary = await orderSummary(orderId);
    expect(summary.status).toBe("AVAILABLE");
    if (summary.status !== "AVAILABLE") return;
    expect(summary.total).toBe("1000");
    expect(summary.paid).toBe("400");
    // 1000 − 400 − 150 credit = 450
    expect(summary.remaining).toBe("450");
  });

  it("ignores credits for other orders (empty default per order)", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["200"],
    });
    creditOrderId = "a_different_order"; // fixture order gets [] this time
    const summary = await orderSummary(orderId);
    expect(summary.status).toBe("AVAILABLE");
    if (summary.status !== "AVAILABLE") return;
    expect(summary.remaining).toBe("200"); // no credit applied
  });

  it("overpayment via credits: remaining may go <= 0 (contract)", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["100"],
    });
    creditOrderId = orderId; // credit 150 > total 100
    const summary = await orderSummary(orderId);
    expect(summary.status).toBe("AVAILABLE");
    if (summary.status !== "AVAILABLE") return;
    expect(summary.remaining).toBe("-50"); // 100 − 0 − 150
  });
});
