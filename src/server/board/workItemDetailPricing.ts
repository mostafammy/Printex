/**
 * Mapping for 093's frozen production spec into the board detail DTO.
 * (specs/017-press-floor-board)
 *
 * Split out of workItemDetailMapper.ts because pricing is its own concern with
 * its own rules, and inlining it pushed that file past its line budget.
 */

import type { DetailPriceBreakdown } from "~/lib/board/detailTypes";
import type { WorkItemDetailQueryRow } from "./workItemDetailQueryTypes";

/** Decimal → string, keeping `null` as `null` rather than inventing a zero. */
function dec(value: { toString(): string } | null): string | null {
  return value === null ? null : value.toString();
}

/**
 * `WorkItemFinishing` is append-only: a re-price appends a new generation rather
 * than editing the old rows. Only the newest generation is the live quote, so
 * summing every generation would show the accountant a breakdown that no longer
 * adds up to the total they are being asked to approve.
 */
function currentGenerationFinishings(row: WorkItemDetailQueryRow) {
  const generation = row.finishings[0]?.generation ?? null;
  if (generation === null) return [];
  return row.finishings
    .filter((line) => line.generation === generation)
    .map((line) => ({
      labelAr: line.labelSnapshot,
      ratePerSqm: line.rateSnapshot.toString(),
      totalAmount: line.totalAmount.toString(),
    }));
}

/**
 * The 093 quote breakdown, or `null` when the item carries no frozen spec.
 *
 * Null rather than a row of zeros: an item with no production spec has not been
 * priced at zero, and rendering absent figures as "0.00" reads as "this job was
 * free" rather than "there is nothing to approve yet". Non-roll work — print
 * jobs, die-cutting, anything not area-priced — lands here.
 */
export function mapPriceBreakdown(row: WorkItemDetailQueryRow): DetailPriceBreakdown | null {
  const hasSpec =
    row.productionTotal !== null ||
    row.baseTotal !== null ||
    row.productionAreaSqm !== null ||
    row.productionWidthCm !== null;
  if (!hasSpec) return null;

  return {
    customerWidthCm: dec(row.customerWidthCm),
    productionWidthCm: dec(row.productionWidthCm),
    productionHeightM: dec(row.productionHeightM),
    productionAreaSqm: dec(row.productionAreaSqm),
    baseRatePerSqm: dec(row.baseRatePerSqm),
    baseTotal: dec(row.baseTotal),
    finishingTotal: dec(row.finishingTotal),
    productionTotal: dec(row.productionTotal),
    finishings: currentGenerationFinishings(row),
  };
}