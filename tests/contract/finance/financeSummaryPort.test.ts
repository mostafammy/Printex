// Contract test for the FinanceSummaryPort provider — tasks.md T015, US1.
// Field-for-field match with 015 contracts/ports.md §2's frozen
// OrderFinanceSummary shape; panel-only fields (pricingIncomplete, counts)
// MUST NOT leak into the port projection (FR-024).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "../../../generated/prisma";
import { testDb } from "../../helpers/testDb";
import { financeSummaryProvider } from "~/server/finance";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let actor: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  actor = await seedFinanceActor("summaryport-actor", ["payment.record", "finance.view"]);
  customerId = await seedCustomer("SummaryPort");
});

describe("financeSummaryProvider (contract, T015)", () => {
  it("returns the frozen AVAILABLE shape with Decimal money fields", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: actor.userId,
      prices: ["600", "400"],
    });
    const summary = await financeSummaryProvider.orderSummary(orderId);

    expect(summary.status).toBe("AVAILABLE");
    if (summary.status !== "AVAILABLE") return;
    expect(summary.currency).toBe("EGP");
    expect(summary.total).toBeInstanceOf(Prisma.Decimal);
    expect(summary.paid).toBeInstanceOf(Prisma.Decimal);
    expect(summary.remaining).toBeInstanceOf(Prisma.Decimal);
    expect(typeof summary.creditApproved).toBe("boolean");
    expect(summary.total.toString()).toBe("1000");
    expect(summary.remaining.toString()).toBe("1000");

    // Panel-only fields must NOT exist on the port projection.
    expect("pricingIncomplete" in summary).toBe(false);
    expect("counts" in summary).toBe(false);
  });

  it("returns UNAVAILABLE with a reason for a missing order", async () => {
    const summary = await financeSummaryProvider.orderSummary("order_does_not_exist");
    expect(summary.status).toBe("UNAVAILABLE");
    if (summary.status === "UNAVAILABLE") {
      expect(summary.reason.length).toBeGreaterThan(0);
    }
  });

  it("reports creditApproved=false for the Cash Customer (015 ports.md row)", async () => {
    const cashCustomerId = await seedPricedOrderCashCustomer();
    const { orderId } = await seedPricedOrder({
      customerId: cashCustomerId,
      createdById: actor.userId,
      prices: ["500"],
    });
    const summary = await financeSummaryProvider.orderSummary(orderId);
    expect(summary.status).toBe("AVAILABLE");
    if (summary.status === "AVAILABLE") {
      expect(summary.creditApproved).toBe(false);
    }
  });
});

async function seedPricedOrderCashCustomer(): Promise<string> {
  const { seedCashCustomer } = await import("../../helpers/financeSeed");
  return seedCashCustomer("SummaryPortCash");
}
