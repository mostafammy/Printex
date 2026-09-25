// FinanceSummaryPort provider — 052 implements, 015 binds (015 contracts/
// ports.md §2). Shape copied verbatim from the frozen port type; the
// panel-only `pricingIncomplete`/`counts` fields are projected away so 015's
// delivery sheet never sees them (FR-024).

import { Prisma } from "../../../generated/prisma";
import { computeOrderSummary } from "./summaries";

export type OrderFinanceSummary =
  | {
      readonly status: "AVAILABLE";
      readonly currency: "EGP";
      readonly total: Prisma.Decimal;
      readonly paid: Prisma.Decimal;
      readonly remaining: Prisma.Decimal; // may be <= 0
      readonly creditApproved: boolean;
    }
  | { readonly status: "UNAVAILABLE"; readonly reason: string };

export type FinanceSummaryPort = {
  orderSummary(orderId: string): Promise<OrderFinanceSummary>;
};

export const financeSummaryProvider: FinanceSummaryPort = {
  async orderSummary(orderId: string): Promise<OrderFinanceSummary> {
    const summary = await computeOrderSummary(orderId);
    if (summary.status === "UNAVAILABLE") {
      return { status: "UNAVAILABLE", reason: summary.reason };
    }
    return {
      status: "AVAILABLE",
      currency: "EGP",
      total: new Prisma.Decimal(summary.total),
      paid: new Prisma.Decimal(summary.paid),
      remaining: new Prisma.Decimal(summary.remaining),
      creditApproved: summary.creditApproved,
    };
  },
};
