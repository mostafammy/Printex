// <ProfitabilityBlock> — 052-finance US6 (contracts/ui.md, T048 + T070).
// Revenue − Direct Costs − Job Expenses = Gross Profit; every term opens
// its source records (spec FR-018): revenue expands into per-Work-Item
// 051 prices, costs expand into entries, expenses deep-link to the
// order-filtered expenses list.

import Link from "next/link";
import { TrendingUp, AlertTriangle } from "lucide-react";
import type { OrderProfitability } from "~/server/finance";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

export function ProfitabilityBlock({ profit }: { readonly profit: OrderProfitability }) {
  const isLoss = profit.grossProfit.startsWith("-");

  return (
    <div className="mt-6 rounded-2xl border border-border/70 bg-muted/15 p-5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">{S.profitability}</h3>
      </div>

      {profit.pricingIncomplete && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-2xs font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{S.pricingIncomplete}</span>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-4 text-xs">
        {/* Revenue */}
        <div className="rounded-xl border border-border/60 bg-card p-3.5">
          <dt className="text-2xs font-medium text-muted-foreground">{S.revenue}</dt>
          <dd className="mt-1 font-bold text-sm text-foreground">
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center justify-between">
                <span>
                  {profit.pricingIncomplete ? "≈ " : ""}
                  {profit.revenue} ج.م
                </span>
                <span className="text-2xs font-normal text-muted-foreground">({profit.revenueEntries.length})</span>
              </summary>
              <ul className="mt-2 flex flex-col gap-1 border-t border-border/40 pt-2 text-2xs text-muted-foreground">
                {profit.revenueEntries.map((entry) => (
                  <li key={entry.priceId} className="flex justify-between items-center">
                    <span>{entry.amount} ج.م</span>
                    <Link href={`/orders/${profit.orderId}`} className="hover:text-primary">
                      #{entry.workItemId.slice(-6)}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </dd>
        </div>

        {/* Direct Costs */}
        <div className="rounded-xl border border-border/60 bg-card p-3.5">
          <dt className="text-2xs font-medium text-muted-foreground">{S.directCostTotal}</dt>
          <dd className="mt-1 font-bold text-sm text-foreground">
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center justify-between">
                <span>{profit.directCosts.total} ج.م</span>
                <span className="text-2xs font-normal text-muted-foreground">({profit.directCosts.entries.length})</span>
              </summary>
              <ul className="mt-2 flex flex-col gap-1 border-t border-border/40 pt-2 text-2xs text-muted-foreground">
                {profit.directCosts.entries.map((entry) => (
                  <li key={entry.id} className="flex justify-between items-center">
                    <span className="truncate max-w-[100px]">{entry.description}</span>
                    <span>{entry.amount} ج.م</span>
                  </li>
                ))}
              </ul>
            </details>
          </dd>
        </div>

        {/* Job Expenses */}
        <div className="rounded-xl border border-border/60 bg-card p-3.5">
          <dt className="text-2xs font-medium text-muted-foreground">{S.jobExpensesTotal}</dt>
          <dd className="mt-1 font-bold text-sm text-foreground">
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center justify-between">
                <span>{profit.jobExpenses.total} ج.م</span>
                <span className="text-2xs font-normal text-muted-foreground">({profit.jobExpenses.entries.length})</span>
              </summary>
              <ul className="mt-2 flex flex-col gap-1 border-t border-border/40 pt-2 text-2xs text-muted-foreground">
                {profit.jobExpenses.entries.map((entry) => (
                  <li key={entry.id} className="flex justify-between items-center">
                    <span className="truncate max-w-[100px]">{entry.category}</span>
                    <span>{entry.amount} ج.م</span>
                  </li>
                ))}
              </ul>
            </details>
          </dd>
        </div>

        {/* Gross Profit */}
        <div
          className={`rounded-xl border p-3.5 ${
            isLoss
              ? "border-destructive/30 bg-destructive/5"
              : "border-emerald-500/30 bg-emerald-500/5"
          }`}
        >
          <dt className="text-2xs font-medium text-muted-foreground">{S.grossProfit}</dt>
          <dd
            className={`mt-1 font-extrabold text-base ${
              isLoss ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {profit.grossProfit} ج.م
          </dd>
        </div>
      </dl>
    </div>
  );
}
