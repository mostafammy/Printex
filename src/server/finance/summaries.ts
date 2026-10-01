// Order & customer financial summaries — 052-finance FR-001, FR-009, FR-012.
//
// Pure computes: no actor/authorization here (queries.md — the calling route
// or server action enforces `finance.view`). Totals are computed server-side
// at read time from 051 prices + non-void payments + compensation-port
// credits; nothing derived is ever stored (plan.md research decision 2).

import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { paginateQuery } from "~/server/pagination";
import { getCurrentPrices } from "~/server/pricing";
import { readCreditCompensations } from "./ports";
import { toDecimalString } from "./money";

export type OrderFinancePanelData = {
  readonly status: "AVAILABLE";
  readonly currency: "EGP";
  /** Sum of the work-item prices, BEFORE the order-level discount and tax. */
  readonly subtotal: string;
  /** The order-level discount reception agreed, as stored on `Order`. */
  readonly discount: string;
  /** The order-level tax reception agreed, as stored on `Order`. */
  readonly tax: string;
  /** `subtotal - discount + tax`. This is the amount owed. */
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
      discountAmount: true,
      taxAmount: true,
      customer: { select: { isCashCustomer: true, customerCredit: true } },
      workItems: { select: { id: true, state: true } },
    },
  });
  if (!order) return { status: "UNAVAILABLE", reason: "Order not found" };

  const billable = order.workItems.filter((item) => item.state !== "CANCELLED");
  let subtotal = new Prisma.Decimal(0);
  let pricingIncomplete = false;
  // 092 T043: one batched pointer-resolution read instead of W serial
  // status+history pairs — identical per-item semantics (FR-032, BC-003).
  const priceById = await getCurrentPrices(billable.map((item) => item.id));
  for (const item of billable) {
    const price = priceById.get(item.id) ?? null;
    if (!price) {
      pricingIncomplete = true;
      continue;
    }
    subtotal = subtotal.plus(new Prisma.Decimal(price.amount));
  }

  // ── Order-level discount and tax ────────────────────────────────────────
  //
  // These two are STORED on `Order` (agreed at the desk by reception); the
  // `subtotal` above is derived from the work items. The order TOTAL stays
  // derived, as it always was — it is this computed combination of the two:
  //
  //     total = subtotal - discount + tax
  //
  // Sequence matters and matches the order the receptionist sees: the discount
  // comes off first, and the tax is charged on the discounted amount. Taxing
  // before discounting would charge tax on money that was then given away.
  //
  // `createMasterOrderAction` refuses a discount larger than the quoted
  // subtotal, but that check runs against what the CLIENT quoted. The subtotal
  // here is what the ACCOUNTANT actually priced, and those can legitimately
  // differ (a rate outside the band, a changed finishing, a re-priced item). So
  // the discount is clamped at the floor rather than trusted: an order can go to
  // zero, but it can never go negative and hand the customer a credit that
  // nobody authorised.
  const discount = Prisma.Decimal.min(order.discountAmount, subtotal);
  const discounted = subtotal.minus(discount);
  const total = discounted.plus(order.taxAmount);

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
    subtotal: toDecimalString(subtotal),
    discount: toDecimalString(discount),
    tax: toDecimalString(order.taxAmount),
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
  readonly orderNumber: number;
  readonly subtotal: string;
  readonly discount: string;
  readonly tax: string;
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
    select: {
      id: true,
      isCashCustomer: true,
      customerCredit: true,
      orders: {
        select: {
          id: true,
          number: true,
          discountAmount: true,
          taxAmount: true,
        },
        orderBy: { number: "desc" },
      },
    },
  });
  if (!customer) return null;

  // 092 T054 (investigation §8): the old loop called computeOrderSummary per
  // order — order.findUnique + payments + voids + the prices pair + a port
  // call EACH — unbounded by the customer's order count. Everything that can
  // batch across orders now batches to a CONSTANT number of reads; the
  // per-order math below reproduces computeOrderSummary's Remaining exactly
  // (billable = state !== CANCELLED, null price → pricingIncomplete,
  // (Subtotal − clamped discount + tax) − Paid − CREDIT compensations,
  // Decimal throughout).
  const orderIds = customer.orders.map((order) => order.id);

  const workItems =
    orderIds.length === 0
      ? []
      : await db.workItem.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true, orderId: true, state: true },
        });
  const billable = workItems.filter((item) => item.state !== "CANCELLED");
  const priceById = await getCurrentPrices(billable.map((item) => item.id));

  const payments =
    orderIds.length === 0
      ? []
      : await db.payment.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true, orderId: true, amount: true },
        });
  const voidedIds =
    payments.length === 0
      ? new Set<string>()
      : new Set(
          (
            await db.financeVoid.findMany({
              where: { entityType: "PAYMENT", entityId: { in: payments.map((p) => p.id) } },
              select: { entityId: true },
            })
          ).map((row) => row.entityId),
        );

  // ponytail: credits still go through CompensationReadPort one order at a
  // time — the port contract is (orderId) => … and no orderId IN surface
  // exists (015 owns the Compensation read; production binds nothing, so the
  // unbound default answers [] at zero queries). Add a batch port when 015
  // lands and switch this Promise.all to one read.
  const creditRows = await Promise.all(
    customer.orders.map((order) => readCreditCompensations(order.id)),
  );

  const billableByOrder = new Map<string, string[]>();
  for (const item of billable) {
    const ids = billableByOrder.get(item.orderId);
    if (ids) ids.push(item.id);
    else billableByOrder.set(item.orderId, [item.id]);
  }
  const paidByOrder = new Map<string, Prisma.Decimal>();
  for (const payment of payments) {
    if (voidedIds.has(payment.id)) continue;
    paidByOrder.set(
      payment.orderId,
      (paidByOrder.get(payment.orderId) ?? new Prisma.Decimal(0)).plus(payment.amount),
    );
  }

  const orders: CustomerBalanceOrderRow[] = [];
  let balance = new Prisma.Decimal(0);
  for (const [index, order] of customer.orders.entries()) {
    let subtotal = new Prisma.Decimal(0);
    let pricingIncomplete = false;
    for (const itemId of billableByOrder.get(order.id) ?? []) {
      const price = priceById.get(itemId) ?? null;
      if (!price) {
        pricingIncomplete = true;
        continue;
      }
      subtotal = subtotal.plus(new Prisma.Decimal(price.amount));
    }
    // Same `subtotal - discount + tax` sequence as `computeOrderSummary`, and
    // the same floor clamp. The comment there on why the clamp is not a trust
    // boundary applies here: this path must never print a number the
    // single-order path would disagree with.
    const discount = Prisma.Decimal.min(order.discountAmount, subtotal);
    const total = subtotal.minus(discount).plus(order.taxAmount);
    const paid = paidByOrder.get(order.id) ?? new Prisma.Decimal(0);
    let creditTotal = new Prisma.Decimal(0);
    for (const credit of creditRows[index] ?? []) {
      creditTotal = creditTotal.plus(new Prisma.Decimal(credit.amount));
    }
    const remaining = total.minus(paid).minus(creditTotal);
    orders.push({
      orderId: order.id,
      orderNumber: order.number,
      subtotal: toDecimalString(subtotal),
      discount: toDecimalString(discount),
      tax: toDecimalString(order.taxAmount),
      total: toDecimalString(total),
      paid: toDecimalString(paid),
      remaining: toDecimalString(remaining),
      pricingIncomplete,
    });
    balance = balance.plus(remaining);
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

/**
 * 090 rollup (contracts/queries.md listCustomerBalances). The contract
 * already documents a `page?` filter; the previous implementation ignored
 * it and did `db.customer.findMany()` with no `where`-narrowing take, then
 * ran a full N+1 `customerBalance` (itself N+1 over each customer's orders)
 * across every non-cash customer on every call. Paginating the customer
 * scan bounds both the row count fetched AND the number of `customerBalance`
 * calls made per invocation.
 */
export async function listCustomerBalances(filter?: {
  readonly creditApproved?: boolean;
  readonly positiveOnly?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
}): Promise<{
  rows: Array<{
    customerId: string;
    name: string;
    balance: string;
    creditApproved: boolean;
    creditLimit: string | null;
  }>;
  nextCursor: number | null;
}> {
  const page = await paginateQuery(filter ?? {}, (skip, take) =>
    db.customer.findMany({
      where: { isArchived: false, isCashCustomer: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
  );

  const rows: Array<{
    customerId: string;
    name: string;
    balance: string;
    creditApproved: boolean;
    creditLimit: string | null;
  }> = [];
  for (const row of page.rows) {
    const balance = await customerBalance(row.id);
    if (!balance) continue;
    if (filter?.creditApproved !== undefined && balance.creditApproved !== filter.creditApproved) {
      continue;
    }
    if (filter?.positiveOnly && new Prisma.Decimal(balance.balance).lte(0)) continue;
    rows.push({
      customerId: row.id,
      name: row.name,
      balance: balance.balance,
      creditApproved: balance.creditApproved,
      creditLimit: balance.creditLimit,
    });
  }
  return { rows, nextCursor: page.nextCursor };
}
