// Performance smoke — tasks.md T060 (Polish / SC-011).
// LAN p95 budgets with generous CI tolerance: summary/balance < 500 ms,
// payment record (incl. audit) < 500 ms.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { customerBalance, orderSummary, recordPayment } from "~/server/finance";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  const { testDb } = await import("../../helpers/testDb");
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;
let orderId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("perf-accounting", ["payment.record", "finance.view"]);
  customerId = await seedCustomer("Perf");
  ({ orderId } = await seedPricedOrder({
    customerId,
    createdById: accounting.userId,
    prices: ["1000"],
  }));
});

async function p95(samples: number, run: () => Promise<void>): Promise<number> {
  const durations: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    await run();
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  return durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]!;
}

describe("finance performance smoke (T060 / SC-011)", () => {
  it("orderSummary and customerBalance under 500 ms p95", async () => {
    const summaryP95 = await p95(10, async () => {
      await orderSummary(orderId);
    });
    const balanceP95 = await p95(10, async () => {
      await customerBalance(customerId);
    });
    expect(summaryP95).toBeLessThan(500);
    expect(balanceP95).toBeLessThan(500);
  });

  it("a single payment records (incl. audit) under 500 ms p95", async () => {
    const recordP95 = await p95(5, async () => {
      await recordPayment(accounting, {
        orderId,
        amount: "1",
        method: "Cash",
        source: "Reception desk",
      });
    });
    expect(recordP95).toBeLessThan(500);
  });
});
