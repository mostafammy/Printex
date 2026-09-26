// Integration test for credit maintenance — tasks.md T029, US3 (FR-010).
// Admin/Owner (`admin.config`) sets flag + limit with a required reason and
// credit.updated audit; non-admin writes forbidden; over-limit stays
// warn-only (never flips creditApproved, never blocks).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { customerBalance, getCreditStanding, updateCredit } from "~/server/finance";
import { ForbiddenError } from "~/server/auth/authorize";
import { seedCustomer, seedCashCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let admin: Awaited<ReturnType<typeof seedFinanceActor>>;
let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  admin = await seedFinanceActor("credit-admin", ["admin.config"]);
  accounting = await seedFinanceActor("credit-accounting", ["payment.record", "finance.view"]);
  customerId = await seedCustomer("Credit");
});

describe("credit maintenance (integration, US3 / FR-010)", () => {
  it("Admin sets flag + limit with reason; audited credit.updated", async () => {
    const standing = await updateCredit(admin, {
      customerId,
      creditApproved: true,
      creditLimit: "1000",
      reason: "account customer approved by owner",
    });
    expect(standing.creditApproved).toBe(true);
    expect(standing.creditLimit).toBe("1000");

    const events = await testDb.auditEvent.findMany({
      where: { action: "credit.updated", entityId: customerId },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.reason).toBe("account customer approved by owner");
    expect(events[0]?.actorId).toBe(admin.userId);
  });

  it("refuses non-admin writes and empty reasons", async () => {
    await expect(
      updateCredit(accounting, {
        customerId,
        creditApproved: true,
        reason: "sneaky",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      updateCredit(admin, { customerId, creditApproved: true, reason: "  " }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("Cash Customer can never be credit-approved", async () => {
    const cashCustomerId = await seedCashCustomer("CreditCash");
    await expect(
      updateCredit(admin, { customerId: cashCustomerId, creditApproved: true, reason: "no" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const standing = await getCreditStanding(cashCustomerId);
    expect(standing?.creditApproved).toBe(false);
  });

  it("over-limit stays warn-only: creditApproved stays true, balances still compute", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["500"],
    });
    await updateCredit(admin, {
      customerId,
      creditApproved: true,
      creditLimit: "1000",
      reason: "limit set",
    });
    // Order remaining 500 is within limit — creditApproved true.
    const balance = await customerBalance(customerId);
    expect(balance?.creditApproved).toBe(true);
    expect(balance?.creditLimit).toBe("1000");
    // A second order pushes total remaining past 1000 — still approved
    // (warn-only; enforcement decision: never flips, Clarifications).
    await seedPricedOrder({ customerId, createdById: accounting.userId, prices: ["700"] });
    const over = await customerBalance(customerId);
    expect(over?.creditApproved).toBe(true);
    expect(Number(over?.balance)).toBeGreaterThan(1000);
    expect(orderId).toBeTruthy();
  });
});
