// Daily cash summary — 052-finance US7 / FR-020.
// Non-void payments grouped by method for ONE shop-local calendar date
// (FR-027, SC-012: bucketing converts UTC occurredAt via shopTimezone).

import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getShopTimezone } from "./config";
import { shopLocalDayBoundsUtc, shopLocalDate } from "./time";
import { toDecimalString } from "./money";

export type DailyCashLine = {
  readonly method: string;
  readonly count: number;
  readonly total: string;
};

export type DailyCashSummary = {
  readonly date: string;
  readonly timezone: string;
  readonly lines: readonly DailyCashLine[];
  readonly grandTotal: string;
  readonly paymentIds: readonly string[];
};

/** FR-020 — caller authorizes (finance.view at the route). */
export async function dailyCashSummary(date: string): Promise<DailyCashSummary> {
  const timezone = await getShopTimezone();
  const { startUtc, endUtc } = shopLocalDayBoundsUtc(date, timezone);

  const payments = await db.payment.findMany({
    where: { occurredAt: { gte: startUtc, lt: endUtc } },
    select: { id: true, amount: true, method: true },
    orderBy: { occurredAt: "asc" },
  });

  const voidRows = await db.financeVoid.findMany({
    where: { entityType: "PAYMENT", entityId: { in: payments.map((p) => p.id) } },
    select: { entityId: true },
  });
  const voidedSet = new Set(voidRows.map((row) => row.entityId));

  const byMethod = new Map<string, { count: number; total: Prisma.Decimal; ids: string[] }>();
  let grand = new Prisma.Decimal(0);
  const paymentIds: string[] = [];
  for (const payment of payments) {
    if (voidedSet.has(payment.id)) continue;
    const entry = byMethod.get(payment.method) ?? {
      count: 0,
      total: new Prisma.Decimal(0),
      ids: [],
    };
    entry.count += 1;
    entry.total = entry.total.plus(payment.amount);
    entry.ids.push(payment.id);
    byMethod.set(payment.method, entry);
    grand = grand.plus(payment.amount);
    paymentIds.push(payment.id);
  }

  const lines: DailyCashLine[] = [...byMethod.entries()]
    .map(([method, entry]) => ({
      method,
      count: entry.count,
      total: toDecimalString(entry.total),
    }))
    .sort((a, b) => a.method.localeCompare(b.method));

  return {
    date,
    timezone,
    lines,
    grandTotal: toDecimalString(grand),
    paymentIds,
  };
}

/** The shop-local "today" default for the date picker (SC-012). */
export async function todayShopLocalDate(): Promise<string> {
  return shopLocalDate(new Date(), await getShopTimezone());
}
