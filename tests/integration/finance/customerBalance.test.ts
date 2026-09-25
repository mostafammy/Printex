// Integration test for customerBalance — tasks.md T028, US3. SC-006:
// balance = Σ per-order Remaining (200, −50, 0 → 150); Cash Customer never
// credit-approved; reads require finance.view at the caller (here: service
// is a pure compute — the authz assertion lives in permissions.test).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { customerBalance, recordPayment } from "~/server/finance";
import { seedCustomer, seedCashCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("balance-accounting", ["payment.record", "finance.view"]);
  customerId = await seedCustomer("Balance");
});

describe("customerBalance (integration, US3)", () => {
  it("sums per-order Remaining across orders (SC-006 fixture: 200, −50, 0 → 150)", async () => {
    const orderA = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["200"],
    });
    const orderB = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["100"],
    });
    const orderC = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["300"],
    });

    // A: untouched → remaining 200
    await recordPayment(accounting, { orderId: orderB.orderId, amount: "150", method: "Cash", source: "Reception desk" });
    // B: overpaid → remaining −50
    await recordPayment(accounting, { orderId: orderC.orderId, amount: "300", method: "Cash", source: "Reception desk" });
    // C: fully paid → remaining 0

    const balance = await customerBalance(customerId);
    expect(balance).not.toBeNull();
    expect(balance!.balance).toBe("150"); // 200 + (−50) + 0
    expect(balance!.orders).toHaveLength(3);
    const byId = new Map(balance!.orders.map((row) => [row.orderId, row.remaining]));
    expect(byId.get(orderA.orderId)).toBe("200");
    expect(byId.get(orderB.orderId)).toBe("-50");
    expect(byId.get(orderC.orderId)).toBe("0");
  });

  it("never reports creditApproved for the Cash Customer", async () => {
    const cashCustomerId = await seedCashCustomer("BalanceCash");
    const { orderId } = await seedPricedOrder({
      customerId: cashCustomerId,
      createdById: accounting.userId,
      prices: ["50"],
    });
    expect(orderId).toBeTruthy();

    // Even if a credit row somehow existed, isCashCustomer forces false.
    await testDb.customerCredit.create({
      data: {
        customerId: cashCustomerId,
        creditApproved: true,
        updatedById: accounting.userId,
        updatedAt: new Date(),
      },
    });
    const balance = await customerBalance(cashCustomerId);
    expect(balance).not.toBeNull();
    expect(balance!.creditApproved).toBe(false);
  });

  it("returns null for a missing customer", async () => {
    expect(await customerBalance("customer_missing")).toBeNull();
  });
});
