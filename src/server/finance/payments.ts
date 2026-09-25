// Payment recording & voiding — 052-finance US1/US2.
// FR-002 (fields), FR-004 (immutable — no update/delete path exists),
// FR-005 (void: permission + mandatory reason + original retained),
// FR-007 (audit in the same transaction), FR-023 (closure post-commit).

import { Prisma } from "../../../generated/prisma";
import { audit, authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import { notify } from "~/server/core/notifications/notify";
import { getCurrentPrice } from "~/server/pricing";
import { FINANCE_AUDIT_ACTIONS, requireReason } from "./audit";
import { isActiveMethod, isActiveSource } from "./config";
import { DomainFinanceError } from "./errors";
import { parsePositiveDecimal } from "./money";
import { invokeFinancialClosure } from "./ports";
import { computeOrderSummary } from "./summaries";
import type { OrderFinanceResult } from "./summaries";

export type RecordPaymentInput = {
  readonly orderId: string;
  readonly amount: string;
  readonly method: string;
  readonly source: string;
  readonly occurredAt?: Date;
  readonly note?: string;
};

export type PaymentSnapshot = {
  readonly id: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly amount: string;
  readonly currency: "EGP";
  readonly method: string;
  readonly source: string;
  readonly note: string | null;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
  readonly recordedById: string;
  readonly receiptNumber: number;
};

export async function recordPayment(
  actor: Actor,
  input: RecordPaymentInput,
): Promise<{ payment: PaymentSnapshot; summary: OrderFinanceResult }> {
  authorize(actor, "payment.record");

  const amount = parsePositiveDecimal(input.amount);
  const method = input.method?.trim() ?? "";
  const source = input.source?.trim() ?? "";
  if (!(await isActiveMethod(method))) {
    throw new DomainFinanceError("METHOD_NOT_CONFIGURED", `Payment method is not configured: ${method}`);
  }
  if (!(await isActiveSource(source))) {
    throw new DomainFinanceError("SOURCE_NOT_CONFIGURED", `Payment source is not configured: ${source}`);
  }
  const occurredAt = input.occurredAt ?? new Date();
  if (occurredAt.getTime() > Date.now()) {
    throw new DomainFinanceError("VALIDATION", "Payment date/time cannot be in the future");
  }
  const note = input.note ? input.note.trim() : null;

  const created = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, customerId: true },
    });
    if (!order) throw new DomainFinanceError("ORDER_NOT_FOUND", "Order was not found");

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        customerId: order.customerId,
        amount,
        currency: "EGP",
        method,
        source,
        note,
        occurredAt,
        recordedById: actor.userId,
        // receiptNumber: native autoincrement — value materializes on insert.
      },
    });

    await audit.record(tx, {
      action: FINANCE_AUDIT_ACTIONS.paymentRecorded,
      entityType: "Payment",
      entityId: payment.id,
      actorId: actor.userId,
      after: {
        orderId: order.id,
        amount: payment.amount.toString(),
        method,
        source,
        occurredAt: payment.occurredAt.toISOString(),
        receiptNumber: payment.receiptNumber,
        note,
      },
      reason: note ?? undefined,
    });

    return payment;
  });

  // FR-023: closure re-evaluation only AFTER commit, outside the tx.
  await invokeFinancialClosure(actor, input.orderId);

  const summary = await computeOrderSummary(input.orderId);
  return {
    payment: {
      id: created.id,
      orderId: created.orderId,
      customerId: created.customerId,
      amount: created.amount.toString(),
      currency: "EGP",
      method: created.method,
      source: created.source,
      note: created.note,
      occurredAt: created.occurredAt,
      recordedAt: created.recordedAt,
      recordedById: created.recordedById,
      receiptNumber: created.receiptNumber,
    },
    summary,
  };
}

export type VoidPaymentInput = {
  readonly paymentId: string;
  readonly reason: string;
};

export type VoidResult = {
  readonly paymentId: string;
  readonly voided: true;
  readonly summary: OrderFinanceResult;
};

export async function voidPayment(actor: Actor, input: VoidPaymentInput): Promise<VoidResult> {
  authorize(actor, "payment.void");
  // 001 reason policy: validate BEFORE audit.record — nothing written when empty.
  const reason = requireReason(input.reason, "void a payment");

  const orderId = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, orderId: true },
    });
    if (!payment) throw new DomainFinanceError("PAYMENT_NOT_FOUND", "Payment was not found");

    // Unique(entityType, entityId) enforces single-void structurally.
    const existing = await tx.financeVoid.findUnique({
      where: { entityType_entityId: { entityType: "PAYMENT", entityId: payment.id } },
    });
    if (existing) throw new DomainFinanceError("ALREADY_VOIDED", "Payment is already voided");

    await tx.financeVoid.create({
      data: {
        entityType: "PAYMENT",
        entityId: payment.id,
        reason,
        voidedById: actor.userId,
      },
    });

    const snapshot = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });

    await audit.record(tx, {
      action: FINANCE_AUDIT_ACTIONS.paymentVoided,
      entityType: "Payment",
      entityId: payment.id,
      actorId: actor.userId,
      before: {
        amount: snapshot.amount.toString(),
        method: snapshot.method,
        source: snapshot.source,
        occurredAt: snapshot.occurredAt.toISOString(),
        receiptNumber: snapshot.receiptNumber,
      },
      after: { voided: true },
      reason,
    });

    // Void-after-close review notice (spec Edge Cases / Assumptions): if the
    // order's Work Items are already COMPLETED and this void re-opens a
    // positive remaining without approved credit, emit one internal notice in
    // the SAME transaction as the void (002 notify rule). Completion is never
    // reversed in V1 — the notice just surfaces the reversal for review.
    const items = await tx.workItem.findMany({
      where: { orderId: payment.orderId, state: { not: "CANCELLED" } },
      select: { id: true, state: true },
    });
    const wasClosed = items.length > 0 && items.every((item) => item.state === "COMPLETED");
    if (wasClosed) {
      // Post-void remaining, computed inside this tx (the new FinanceVoid row
      // is visible here; prices are unchanged by this transaction).
      let total = new Prisma.Decimal(0);
      for (const item of items) {
        const price = await getCurrentPrice(item.id);
        if (price) total = total.plus(new Prisma.Decimal(price.amount));
      }
      const rows = await tx.payment.findMany({
        where: { orderId: payment.orderId },
        select: { id: true, amount: true },
      });
      const voidedIds = new Set(
        (
          await tx.financeVoid.findMany({
            where: { entityType: "PAYMENT", entityId: { in: rows.map((r) => r.id) } },
            select: { entityId: true },
          })
        ).map((row) => row.entityId),
      );
      let paid = new Prisma.Decimal(0);
      for (const row of rows) {
        if (!voidedIds.has(row.id)) paid = paid.plus(row.amount);
      }
      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        select: {
          customerId: true,
          customer: { select: { isCashCustomer: true, customerCredit: { select: { creditApproved: true } } } },
        },
      });
      const creditApproved =
        Boolean(order.customer.customerCredit?.creditApproved) && !order.customer.isCashCustomer;
      if (total.minus(paid).gt(0) && !creditApproved) {
        await notify(tx, {
          type: "finance.void_after_close",
          entity: { type: "Order", id: payment.orderId },
          recipients: { roles: ["ACCOUNTING", "ADMIN_OWNER"] },
          payload: { orderId: payment.orderId, paymentId: payment.id, reason },
        });
      }
    }

    return payment.orderId;
  });

  await invokeFinancialClosure(actor, orderId);
  const summary = await computeOrderSummary(orderId);
  return { paymentId: input.paymentId, voided: true, summary };
}

export type PaymentRow = {
  readonly id: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly amount: string;
  readonly method: string;
  readonly source: string;
  readonly note: string | null;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
  readonly recordedById: string;
  readonly recordedByName: string | null;
  readonly receiptNumber: number;
  readonly voided: { readonly reason: string; readonly voidedById: string; readonly voidedAt: Date } | null;
};

export type ListPaymentsFilter = {
  readonly orderId?: string;
  readonly customerId?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly method?: string;
  readonly includeVoided?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
};

/** FR-019 read query (contracts/queries.md listPayments) — caller authorizes. */
export async function listPayments(filter: ListPaymentsFilter): Promise<{
  rows: PaymentRow[];
  nextCursor: number | null;
}> {
  const pageSize = Math.min(Math.max(filter.pageSize ?? 25, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const where = {
    ...(filter.orderId ? { orderId: filter.orderId } : {}),
    ...(filter.customerId ? { customerId: filter.customerId } : {}),
    ...(filter.method ? { method: filter.method } : {}),
    ...(filter.from || filter.to
      ? {
          occurredAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
  };
  const rows = await db.payment.findMany({
    where,
    include: { recordedBy: { select: { name: true } } },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const voidRows = await db.financeVoid.findMany({
    where: { entityType: "PAYMENT", entityId: { in: pageRows.map((r) => r.id) } },
  });
  const voidMap = new Map(voidRows.map((row) => [row.entityId, row]));

  const shaped = pageRows
    .map((row) => ({
      id: row.id,
      orderId: row.orderId,
      customerId: row.customerId,
      amount: row.amount.toString(),
      method: row.method,
      source: row.source,
      note: row.note,
      occurredAt: row.occurredAt,
      recordedAt: row.recordedAt,
      recordedById: row.recordedById,
      recordedByName: row.recordedBy?.name ?? null,
      receiptNumber: row.receiptNumber,
      voided: (() => {
        const voidRow = voidMap.get(row.id);
        return voidRow
          ? { reason: voidRow.reason, voidedById: voidRow.voidedById, voidedAt: voidRow.voidedAt }
          : null;
      })(),
    }))
    .filter((row) => filter.includeVoided === true || row.voided === null);

  return { rows: shaped, nextCursor: hasMore ? page + 1 : null };
}

/** Convenience: does this payment have a void row? (shared with list shaping) */
export async function isPaymentVoided(paymentId: string): Promise<boolean> {
  const row = await db.financeVoid.findUnique({
    where: { entityType_entityId: { entityType: "PAYMENT", entityId: paymentId } },
  });
  return row !== null;
}
