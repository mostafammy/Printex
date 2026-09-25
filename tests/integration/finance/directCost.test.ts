// Integration test for direct manufacturing costs — tasks.md T042, US5.
// Permission, order/work-item coherence, audit, void excludes from
// profitability, no update/delete path.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  listDirectCosts,
  orderProfitability,
  recordDirectCost,
  voidDirectCost,
} from "~/server/finance";
import { ForbiddenError } from "~/server/auth/authorize";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let reception: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("cost-accounting", ["expense.record", "finance.view"]);
  reception = await seedFinanceActor("cost-reception", ["finance.view"]);
  customerId = await seedCustomer("DirectCost");
});

describe("direct costs (integration, US5)", () => {
  it("records order-level and work-item-level costs; audited; rolls into profitability", async () => {
    const { orderId, workItemIds } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["1000"],
    });

    const orderLevel = await recordDirectCost(accounting, {
      orderId,
      amount: "200",
      costDate: "2026-09-18",
      description: "vinyl material",
    });
    const itemLevel = await recordDirectCost(accounting, {
      orderId,
      workItemId: workItemIds[0],
      amount: "100",
      costDate: "2026-09-19",
      description: "external print vendor",
    });
    expect(orderLevel.orderId).toBe(orderId);
    expect(itemLevel.workItemId).toBe(workItemIds[0]);

    const events = await testDb.auditEvent.count({
      where: { action: "direct_cost.recorded", actorId: accounting.userId },
    });
    expect(events).toBe(2);

    const profit = await orderProfitability(orderId);
    expect(profit?.directCosts.total).toBe("300");
    expect(profit?.directCosts.entries).toHaveLength(2);
    expect(profit?.sources.directCostIds).toContain(orderLevel.id);
    expect(profit?.sources.directCostIds).toContain(itemLevel.id);
  });

  it("validates amount, order, and work-item coherence; refuses missing permission", async () => {
    const { orderId, workItemIds } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["50"],
    });
    const other = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["50"],
    });

    await expect(
      recordDirectCost(accounting, {
        orderId,
        amount: "0",
        costDate: "2026-09-18",
        description: "x",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      recordDirectCost(accounting, {
        orderId: "order_missing",
        amount: "10",
        costDate: "2026-09-18",
        description: "x",
      }),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    await expect(
      recordDirectCost(accounting, {
        orderId,
        workItemId: other.workItemIds[0],
        amount: "10",
        costDate: "2026-09-18",
        description: "x",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const auditBefore = await testDb.auditEvent.count({ where: { actorId: reception.userId } });
    await expect(
      recordDirectCost(reception, {
        orderId,
        workItemId: workItemIds[0],
        amount: "10",
        costDate: "2026-09-18",
        description: "x",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await testDb.auditEvent.count({ where: { actorId: reception.userId } })).toBe(auditBefore);
  });

  it("void excludes from profitability, keeps original; no update/delete path", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["800"],
    });
    const cost = await recordDirectCost(accounting, {
      orderId,
      amount: "300",
      costDate: "2026-09-18",
      description: "lamination",
    });

    await expect(voidDirectCost(accounting, { directCostId: cost.id, reason: " " })).rejects.toMatchObject({
      code: "VALIDATION",
    });

    await voidDirectCost(accounting, { directCostId: cost.id, reason: "duplicate" });
    const profit = await orderProfitability(orderId);
    expect(profit?.directCosts.total).toBe("0");

    const listed = await listDirectCosts({ orderId, includeVoided: true });
    const row = listed.rows.find((r) => r.id === cost.id);
    expect(row?.voided).toBe(true);
    expect(row?.amount).toBe("300");

    await expect(voidDirectCost(accounting, { directCostId: cost.id, reason: "again" })).rejects.toMatchObject({
      code: "ALREADY_VOIDED",
    });
    await expect(
      testDb.$executeRaw`DELETE FROM "DirectCost" WHERE id = ${cost.id}`,
    ).rejects.toThrow();
    await expect(
      testDb.$executeRaw`UPDATE "DirectCost" SET amount = 1 WHERE id = ${cost.id}`,
    ).rejects.toThrow();
  });
});
