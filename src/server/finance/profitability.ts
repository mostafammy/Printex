// Order profitability — 052-finance US6 / FR-018.
// Gross profit = Sales Revenue (051 prices) − Direct Manufacturing Cost −
// Recorded Job Expenses (order-linked only). Every term carries its source
// IDs for drill-down; nothing derived is stored.

import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getCurrentPrice } from "~/server/pricing";
import { toDecimalString } from "./money";

export type ProfitabilityTerm<T> = {
  readonly total: string;
  readonly entries: readonly T[];
};

export type OrderProfitability = {
  readonly orderId: string;
  readonly revenue: string;
  readonly pricingIncomplete: boolean;
  readonly directCosts: ProfitabilityTerm<{
    id: string;
    amount: string;
    description: string;
    workItemId: string | null;
  }>;
  readonly jobExpenses: ProfitabilityTerm<{
    id: string;
    amount: string;
    category: string;
    expenseDate: string;
  }>;
  readonly grossProfit: string;
  readonly sources: {
    readonly priceIds: string[];
    readonly directCostIds: string[];
    readonly expenseIds: string[];
  };
};

async function voidedIdsFor(
  entityType: "EXPENSE" | "DIRECT_COST",
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db.financeVoid.findMany({
    where: { entityType, entityId: { in: [...ids] } },
    select: { entityId: true },
  });
  return new Set(rows.map((row) => row.entityId));
}

/** FR-018 — caller authorizes (finance.view at the route). */
export async function orderProfitability(orderId: string): Promise<OrderProfitability | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, workItems: { select: { id: true, state: true } } },
  });
  if (!order) return null;

  // Revenue: sum of current 051 prices over non-cancelled Work Items.
  let revenue = new Prisma.Decimal(0);
  let pricingIncomplete = false;
  const priceIds: string[] = [];
  for (const item of order.workItems) {
    if (item.state === "CANCELLED") continue;
    const price = await getCurrentPrice(item.id);
    if (!price) {
      pricingIncomplete = true;
      continue;
    }
    revenue = revenue.plus(new Prisma.Decimal(price.amount));
    priceIds.push(price.id);
  }

  // Direct costs (non-void).
  const costRows = await db.directCost.findMany({
    where: { orderId },
    orderBy: { costDate: "asc" },
  });
  const voidCosts = await voidedIdsFor("DIRECT_COST", costRows.map((r) => r.id));
  let directCostTotal = new Prisma.Decimal(0);
  const directCostEntries: Array<{
    id: string;
    amount: string;
    description: string;
    workItemId: string | null;
  }> = [];
  const directCostIds: string[] = [];
  for (const row of costRows) {
    if (voidCosts.has(row.id)) continue;
    directCostTotal = directCostTotal.plus(row.amount);
    directCostEntries.push({
      id: row.id,
      amount: row.amount.toString(),
      description: row.description,
      workItemId: row.workItemId,
    });
    directCostIds.push(row.id);
  }

  // Job expenses: order-linked, non-void (unlinked = operating expense).
  const expenseRows = await db.expense.findMany({
    where: { orderId },
    orderBy: { expenseDate: "asc" },
  });
  const voidExpenses = await voidedIdsFor("EXPENSE", expenseRows.map((r) => r.id));
  let jobExpenseTotal = new Prisma.Decimal(0);
  const jobExpenseEntries: Array<{
    id: string;
    amount: string;
    category: string;
    expenseDate: string;
  }> = [];
  const expenseIds: string[] = [];
  for (const row of expenseRows) {
    if (voidExpenses.has(row.id)) continue;
    jobExpenseTotal = jobExpenseTotal.plus(row.amount);
    jobExpenseEntries.push({
      id: row.id,
      amount: row.amount.toString(),
      category: row.category,
      expenseDate: row.expenseDate.toISOString().slice(0, 10),
    });
    expenseIds.push(row.id);
  }

  // Credits affect cash Remaining, not accrual gross profit.
  const grossProfit = revenue.minus(directCostTotal).minus(jobExpenseTotal);

  return {
    orderId,
    revenue: toDecimalString(revenue),
    pricingIncomplete,
    directCosts: { total: toDecimalString(directCostTotal), entries: directCostEntries },
    jobExpenses: { total: toDecimalString(jobExpenseTotal), entries: jobExpenseEntries },
    grossProfit: toDecimalString(grossProfit),
    sources: { priceIds, directCostIds, expenseIds },
  };
}
