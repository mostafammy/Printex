// Order & customer financial summaries — 052-finance FR-001, FR-009, FR-012.
//
// Pure computes: no actor/authorization here (queries.md — the calling route
// or server action enforces `finance.view`). Totals are computed server-side
// at read time from 051 prices + non-void payments + compensation-port
// credits; nothing derived is ever stored (plan.md research decision 2).

import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getCurrentPrice } from "~/server/pricing";
import { readCreditCompensations } from "./ports";
import { toDecimalString } from "./money";

export type OrderFinancePanelData = {
  readonly status: "AVAILABLE";
  readonly currency: "EGP";
  readonly total: string;
  readonly paid: string;
  readonly remaining: string; // may be <= 0 (overpayment surfaces as credit)
  readonly creditApproved: boolean;
  readonly pricingIncomplete: boolean;
  readonly counts: { readonly payments: number; readonly voidedPayments: number };
};

export type OrderFinanceUnavailable = {
  readonly status: "UNAVAILABLE";
  readonly reason: string;
};

export type OrderFinanceResult = OrderFinancePanelData | OrderFinanceUnavailable;

async function computePaid(orderId: string): Promise<{
  paid: Prisma.Decimal;
  payments: number;
  voidedPayments: number;
}> {
  const all = await db.payment.findMany({
    where: { orderId },
    select: { id: true, amount: true },
  });
  const voidedIds = new Set(
    (
      await db.financeVoid.findMany({
        where: { entityType: "PAYMENT", entityId: { in: all.map((p) => p.id) } },
        select: { entityId: true },
      })
    ).map((row) => row.entityId),
  );
  let paid = new Prisma.Decimal(0);
  let payments = 0;
  let voidedPayments = 0;
  for (const payment of all) {
    if (voidedIds.has(payment.id)) {
      voidedPayments += 1;
    } else {
      paid = paid.plus(payment.amount);
      payments += 1;
    }
  }
  return { paid, payments, voidedPayments };
}

/** Internal compute used by recordPayment's response and the 015 provider. */
export async function computeOrderSummary(orderId: string): Promise<OrderFinanceResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      customer: { select: { isCashCustomer: true, customerCredit: true } },
      workItems: { select: { id: true, state: true } },
    },
  });
  if (!order) return { status: "UNAVAILABLE", reason: "Order not found" };

  const billable = order.workItems.filter((item) => item.state !== "CANCELLED");
  let total = new Prisma.Decimal(0);
  let pricingIncomplete = false;
  for (const item of billable) {
    const price = await getCurrentPrice(item.id);
    if (!price) {
      pricingIncomplete = true;
      continue;
    }
    total = total.plus(new Prisma.Decimal(price.amount));
  }

  const { paid, payments, voidedPayments } = await computePaid(orderId);

  // FR-012: CREDIT compensations reduce remaining (empty default until 015 binds).
  const credits = await readCreditCompensations(orderId);
  let creditTotal = new Prisma.Decimal(0);
  for (const credit of credits) {
    creditTotal = creditTotal.plus(new Prisma.Decimal(credit.amount));
  }

  const remaining = total.minus(paid).minus(creditTotal);
  const credit = order.customer.customerCredit;
  const creditApproved = Boolean(credit?.creditApproved) && !order.customer.isCashCustomer;

  return {
    status: "AVAILABLE",
    currency: "EGP",
    total: toDecimalString(total),
    paid: toDecimalString(paid),
    remaining: toDecimalString(remaining),
    creditApproved,
    pricingIncomplete,
    counts: { payments, voidedPayments },
  };
}

/** FR-001/FR-009 public summary (caller enforces finance.view). */
export async function orderSummary(orderId: string): Promise<OrderFinanceResult> {
  return computeOrderSummary(orderId);
}

export type CustomerBalanceOrderRow = {
  readonly orderId: string;
  readonly total: string;
  readonly paid: string;
  readonly remaining: string;
  readonly pricingIncomplete: boolean;
};

export type CustomerBalance = {
  readonly customerId: string;
  readonly balance: string; // Σ remaining; may be negative (overpaid)
  readonly creditApproved: boolean;
  readonly creditLimit: string | null;
  readonly orders: readonly CustomerBalanceOrderRow[];
};

/** FR-009: balance = Σ per-order Remaining across all of the customer's orders. */
export async function customerBalance(customerId: string): Promise<CustomerBalance | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, isCashCustomer: true, customerCredit: true, orders: { select: { id: true } } },
  });
  if (!customer) return null;

  const orders: CustomerBalanceOrderRow[] = [];
  let balance = new Prisma.Decimal(0);
  for (const order of customer.orders) {
    const summary = await computeOrderSummary(order.id);
    if (summary.status !== "AVAILABLE") continue;
    orders.push({
      orderId: order.id,
      total: summary.total,
      paid: summary.paid,
      remaining: summary.remaining,
      pricingIncomplete: summary.pricingIncomplete,
    });
    balance = balance.plus(new Prisma.Decimal(summary.remaining));
  }

  const credit = customer.customerCredit;
  return {
    customerId: customer.id,
    balance: toDecimalString(balance),
    creditApproved: Boolean(credit?.creditApproved) && !customer.isCashCustomer,
    creditLimit: credit?.creditLimit ? credit.creditLimit.toString() : null,
    orders,
  };
}

/** 090 rollup (contracts/queries.md listCustomerBalances). */
export async function listCustomerBalances(filter?: {
  readonly creditApproved?: boolean;
  readonly positiveOnly?: boolean;
}): Promise<Array<{ customerId: string; name: string; balance: string; creditApproved: boolean; creditLimit: string | null }>> {
  const rows = await db.customer.findMany({
    where: { isArchived: false, isCashCustomer: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const out: Array<{
    customerId: string;
    name: string;
    balance: string;
    creditApproved: boolean;
    creditLimit: string | null;
  }> = [];
  for (const row of rows) {
    const balance = await customerBalance(row.id);
    if (!balance) continue;
    if (filter?.creditApproved !== undefined && balance.creditApproved !== filter.creditApproved) {
      continue;
    }
    if (filter?.positiveOnly && new Prisma.Decimal(balance.balance).lte(0)) continue;
    out.push({
      customerId: row.id,
      name: row.name,
      balance: balance.balance,
      creditApproved: balance.creditApproved,
      creditLimit: balance.creditLimit,
    });
  }
  return out;
}
