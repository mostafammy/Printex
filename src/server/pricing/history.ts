import { db } from "~/server/db";
import type { Prisma } from "../../../generated/prisma";
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

type WorkItemPriceRow = Prisma.WorkItemPriceGetPayload<{
  include: { setBy: { select: { name: true } } };
}>;

/** Shared row mapper — single-path and batched reads MUST map identically (092 T043). */
function toPriceHistoryRow(row: WorkItemPriceRow): PriceHistoryRow {
  return {
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
  };
}

export async function getPriceHistory(workItemId: string): Promise<PriceHistoryRow[]> {
  const rows = await db.workItemPrice.findMany({
    where: { workItemId },
    include: { setBy: { select: { name: true } } },
    orderBy: { setAt: "desc" },
  });

  return rows.map(toPriceHistoryRow);
}

/**
 * Batched {@link getCurrentPrice} (092-performance FR-032, T043).
 *
 * Exact semantic equivalent for a set of Work Items: the current price is the
 * row `pricingStatus.currentPriceId` points at — no time/effective-dating
 * heuristics, same pointer resolution, same row mapper, same null cases
 * (missing status → null, null pointer → null, dangling pointer → null).
 * Two set-based reads replace W × (status + history) serial round-trips.
 *
 * Reads run on the module-level `db` client — identical to `getCurrentPrice`,
 * including when called inside a `$transaction` (which today's loops also do;
 * behavior preserved, not altered, by this batch).
 */
export async function getCurrentPrices(
  workItemIds: readonly string[],
): Promise<Map<string, PriceHistoryRow | null>> {
  const ids = [...new Set(workItemIds)];
  const out = new Map<string, PriceHistoryRow | null>();
  for (const id of ids) out.set(id, null); // default: same as getCurrentPrice's miss path
  if (ids.length === 0) return out;

  const [statuses, rows] = await Promise.all([
    db.pricingStatus.findMany({
      where: { workItemId: { in: ids } },
      select: { workItemId: true, currentPriceId: true },
    }),
    db.workItemPrice.findMany({
      where: { workItemId: { in: ids } },
      include: { setBy: { select: { name: true } } },
      orderBy: { setAt: "desc" },
    }),
  ]);

  const historyById = new Map<string, PriceHistoryRow[]>();
  for (const row of rows) {
    const mapped = toPriceHistoryRow(row);
    const list = historyById.get(row.workItemId);
    if (list) list.push(mapped);
    else historyById.set(row.workItemId, [mapped]);
  }

  for (const status of statuses) {
    if (!status.currentPriceId) {
      out.set(status.workItemId, null);
      continue;
    }
    const found =
      (historyById.get(status.workItemId) ?? []).find(
        (r) => r.id === status.currentPriceId,
      ) ?? null;
    out.set(status.workItemId, found);
  }
  return out;
}

export async function getCurrentPrice(workItemId: string): Promise<PriceHistoryRow | null> {
  const pricingStatus = await readPricingStatus(workItemId);
  if (!pricingStatus?.currentPriceId) return null;
  const history = await getPriceHistory(workItemId);
  return history.find((row) => row.id === pricingStatus.currentPriceId) ?? null;
}