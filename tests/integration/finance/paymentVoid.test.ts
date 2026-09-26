// Integration test for voidPayment() — tasks.md T023, US2.
// SC-002/SC-003: void keeps the original excluded-but-retrievable, reason and
// permission required, double-void refused, direct SQL refused by the
// append-only REVOKE (prisma/manual-sql/finance-append-only.sql).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { listPayments, orderSummary, recordPayment, voidPayment } from "~/server/finance";
import { ForbiddenError } from "~/server/auth/authorize";
import { seedCustomer, seedFinanceActor, seedPricedOrder } from "../../helpers/financeSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let accounting: Awaited<ReturnType<typeof seedFinanceActor>>;
let reception: Awaited<ReturnType<typeof seedFinanceActor>>;
let customerId: string;

beforeAll(async () => {
  accounting = await seedFinanceActor("void-accounting", ["payment.record", "payment.void", "finance.view"]);
  reception = await seedFinanceActor("void-reception", ["finance.view"]);
  customerId = await seedCustomer("VoidTest");
});

describe("voidPayment (integration, US2)", () => {
  it("excludes a voided payment from Paid while the original stays retrievable (SC-001/SC-002)", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["1000"],
    });
    const first = await recordPayment(accounting, {
      orderId,
      amount: "400",
      method: "Cash",
      source: "Reception desk",
    });
    await recordPayment(accounting, {
      orderId,
      amount: "600",
      method: "Cash",
      source: "Reception desk",
    });
    expect(first.summary.status).toBe("AVAILABLE");
    if (first.summary.status !== "AVAILABLE") return;
    expect(first.summary.paid).toBe("1000");

    const voided = await voidPayment(accounting, {
      paymentId: first.payment.id,
      reason: "entered twice",
    });
    expect(voided.voided).toBe(true);
    if (voided.summary.status === "AVAILABLE") {
      expect(voided.summary.paid).toBe("600");
      expect(voided.summary.remaining).toBe("400");
      expect(voided.summary.counts.voidedPayments).toBe(1);
    }

    // Original fully retrievable with void metadata.
    const rows = await listPayments({ orderId, includeVoided: true });
    const original = rows.rows.find((r) => r.id === first.payment.id);
    expect(original).toBeDefined();
    expect(original?.voided?.reason).toBe("entered twice");
    expect(original?.amount).toBe("400");
    expect(original?.method).toBe("Cash");
  });

  it("requires a reason, refuses double void, refuses users without payment.void", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["100"],
    });
    const payment = await recordPayment(accounting, {
      orderId,
      amount: "100",
      method: "Cash",
      source: "Reception desk",
    });

    // Empty reason → VALIDATION, nothing written.
    await expect(
      voidPayment(accounting, { paymentId: payment.payment.id, reason: "   " }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    // Reception (no payment.void) → FORBIDDEN, no audit event.
    const auditBefore = await testDb.auditEvent.count({
      where: { action: "payment.voided", actorId: reception.userId },
    });
    await expect(
      voidPayment(reception, { paymentId: payment.payment.id, reason: "nope" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(
      await testDb.auditEvent.count({ where: { action: "payment.voided", actorId: reception.userId } }),
    ).toBe(auditBefore);

    // First void succeeds with audit carrying before/after + reason.
    await voidPayment(accounting, { paymentId: payment.payment.id, reason: "mistake" });
    const events = await testDb.auditEvent.findMany({
      where: { action: "payment.voided", entityId: payment.payment.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.reason).toBe("mistake");

    // Double void → ALREADY_VOIDED.
    await expect(
      voidPayment(accounting, { paymentId: payment.payment.id, reason: "again" }),
    ).rejects.toMatchObject({ code: "ALREADY_VOIDED" });
  });

  it("database refuses direct UPDATE and DELETE on Payment (SC-002, append-only REVOKE)", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["20"],
    });
    const payment = await recordPayment(accounting, {
      orderId,
      amount: "20",
      method: "Cash",
      source: "Reception desk",
    });

    await expect(
      testDb.$executeRaw`UPDATE "Payment" SET note = 'tampered' WHERE id = ${payment.payment.id}`,
    ).rejects.toThrow();
    await expect(
      testDb.$executeRaw`DELETE FROM "Payment" WHERE id = ${payment.payment.id}`,
    ).rejects.toThrow();

    // Row untouched.
    const row = await testDb.payment.findUnique({ where: { id: payment.payment.id } });
    expect(row?.amount.toString()).toBe("20");
    expect(row?.note).toBeNull();
  });

  it("remaining formula holds with partial + voided mix (SC-001 fixture)", async () => {
    const { orderId } = await seedPricedOrder({
      customerId,
      createdById: accounting.userId,
      prices: ["500", "500"],
    });
    const a = await recordPayment(accounting, { orderId, amount: "300", method: "Cash", source: "Reception desk" });
    const b = await recordPayment(accounting, { orderId, amount: "200", method: "Card", source: "Reception desk" });
    await recordPayment(accounting, { orderId, amount: "100", method: "Cash", source: "Reception desk" });

    let summary = await orderSummary(orderId);
    expect(summary.status).toBe("AVAILABLE");
    if (summary.status === "AVAILABLE") expect(summary.remaining).toBe("400"); // 1000-600

    await voidPayment(accounting, { paymentId: b.payment.id, reason: "wrong order" });
    summary = await orderSummary(orderId);
    if (summary.status === "AVAILABLE") {
      expect(summary.paid).toBe("400"); // 300 + 100, 200 voided
      expect(summary.remaining).toBe("600");
    }
    expect(a.payment.amount).toBe("300");
  });
});
