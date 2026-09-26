// Integration test for recordPayment authorization/validation — tasks.md T014, US1.
// Reception (no payment.record) must be refused with FORBIDDEN, writing
// neither payment nor audit event; unconfigured method/source refused.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { recordPayment } from "~/server/finance";
import { ForbiddenError } from "~/server/auth/authorize";
import {
  seedCustomer,
  seedFinanceActor,
  seedPricedOrder,
} from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let reception: Awaited<ReturnType<typeof seedFinanceActor>>;
let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  reception = await seedFinanceActor("payauthz-reception", ["finance.view"]);
  accounting = await seedFinanceActor("payauthz-accounting", ["payment.record"]);
  customerId = await seedCustomer("PayAuthz");
});

describe("recordPayment authorization (integration, US1)", () => {
  it("refuses recording without payment.record and writes nothing", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["100"],
    });
    const paymentBefore = await testDb.payment.count({ where: { orderId } });
    const auditBefore = await testDb.auditEvent.count({ where: { actorId: reception.userId } });

    await expect(
      recordPayment(reception, {
        orderId,
        amount: "100",
        method: "Cash",
        source: "Reception desk",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await testDb.payment.count({ where: { orderId } })).toBe(paymentBefore);
    expect(await testDb.auditEvent.count({ where: { actorId: reception.userId } })).toBe(auditBefore);
  });

  it("refuses an unknown source even with permission", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["50"],
    });
    await expect(
      recordPayment(accounting, { orderId, amount: "50", method: "Cash", source: "Moon" }),
    ).rejects.toMatchObject({ code: "SOURCE_NOT_CONFIGURED" });
  });
});
