// Printable payment receipt — 052-finance US8 / FR-022.
// Fields match the stored payment + Remaining at print time (SC-010).

import { db } from "~/server/db";
import { DomainFinanceError } from "./errors";
import { getShopTimezone } from "./config";
import { shopLocalDate } from "./time";
import { computeOrderSummary } from "./summaries";

export type ReceiptProjection = {
  readonly paymentId: string;
  readonly shopName: string;
  readonly receiptNumber: number;
  readonly orderId: string;
  readonly orderNumber: number;
  readonly customerName: string;
  readonly amount: string;
  readonly method: string;
  readonly source: string;
  /** Shop-local render of occurredAt (YYYY-MM-DD HH:MM). */
  readonly occurredAtLocal: string;
  readonly recordedByName: string;
  readonly remainingAfter: string;
  readonly voided: boolean;
};

/** FR-022 — caller authorizes (finance.view at the route). */
export async function getReceipt(paymentId: string): Promise<ReceiptProjection> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      recordedBy: { select: { name: true } },
      order: {
        select: {
          number: true,
          customer: { select: { name: true } },
        },
      },
    },
  });
  if (!payment) throw new DomainFinanceError("PAYMENT_NOT_FOUND", "Payment was not found");

  const voidRow = await db.financeVoid.findUnique({
    where: { entityType_entityId: { entityType: "PAYMENT", entityId: payment.id } },
  });

  const summary = await computeOrderSummary(payment.orderId);
  const timezone = await getShopTimezone();
  const localDate = shopLocalDate(payment.occurredAt, timezone);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(payment.occurredAt);

  return {
    paymentId: payment.id,
    shopName: "Printex",
    receiptNumber: payment.receiptNumber,
    orderId: payment.orderId,
    orderNumber: payment.order.number,
    customerName: payment.order.customer.name,
    amount: payment.amount.toString(),
    method: payment.method,
    source: payment.source,
    occurredAtLocal: `${localDate} ${timePart}`,
    recordedByName: payment.recordedBy?.name ?? "",
    remainingAfter: summary.status === "AVAILABLE" ? summary.remaining : "0",
    voided: voidRow !== null,
  };
}
