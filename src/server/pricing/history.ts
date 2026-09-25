import { db } from "~/server/db";
import { readPricingStatus } from "./status";

export type PriceHistoryRow = {
  readonly id: string;
  readonly workItemId: string;
  readonly amount: string;
  readonly currency: string;
  readonly source: "LIST" | "CUSTOMER_RULE" | "MANUAL";
  readonly reason: string | null;
  readonly breakdown: unknown;
  readonly setById: string;
  readonly setByName: string | null;
  readonly setAt: Date;
  readonly replacedAt: Date | null;
};

export async function getPriceHistory(workItemId: string): Promise<PriceHistoryRow[]> {
  const rows = await db.workItemPrice.findMany({
    where: { workItemId },
    include: { setBy: { select: { name: true } } },
    orderBy: { setAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    workItemId: row.workItemId,
    amount: row.amount.toString(),
    currency: row.currency,
    source: row.source,
    reason: row.reason,
    breakdown: row.quoteBreakdown,
    setById: row.setById,
    setByName: row.setBy?.name ?? null,
    setAt: row.setAt,
    replacedAt: row.replacedAt,
  }));
}

export async function getCurrentPrice(workItemId: string): Promise<PriceHistoryRow | null> {
  const pricingStatus = await readPricingStatus(workItemId);
  if (!pricingStatus?.currentPriceId) return null;
  const history = await getPriceHistory(workItemId);
  return history.find((row) => row.id === pricingStatus.currentPriceId) ?? null;
}