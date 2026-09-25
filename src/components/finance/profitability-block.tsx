// <ProfitabilityBlock> — 052-finance US6 (contracts/ui.md, T048 + T070).
// Revenue − Direct Costs − Job Expenses = Gross Profit; every term opens
// its source records (spec FR-018): revenue expands into per-Work-Item
// 051 prices, costs expand into entries, expenses deep-link to the
// order-filtered expenses list.

import Link from "next/link";
import type { OrderProfitability } from "~/server/finance";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

export function ProfitabilityBlock({ profit }: { readonly profit: OrderProfitability }) {
  return (
    <div className="mt-6 rounded-md border border-border p-4">
      <h3 className="text-sm font-semibold">{S.profitability}</h3>
      {profit.pricingIncomplete && (
        <p className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          {S.pricingIncomplete}
        </p>
      )}
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{S.revenue}</dt>
          <dd className="font-semibold">
            <details>
              <summary className="cursor-pointer list-none">
                {profit.pricingIncomplete ? "≈" : ""}
                {profit.revenue} ج.م ({profit.revenueEntries.length})
              </summary>
              <ul className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                {profit.revenueEntries.map((entry) => (
                  <li key={entry.priceId}>
                    {entry.amount} — <Link href={`/orders/${profit.orderId}`} className="underline hover:text-foreground">#{entry.workItemId.slice(-6)}</Link>
                  </li>
                ))}
              </ul>
            </details>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{S.directCostTotal}</dt>
          <dd className="font-semibold">
            <details>
              <summary className="cursor-pointer list-none">
                {profit.directCosts.total} ج.م ({profit.directCosts.entries.length})
              </summary>
              <ul className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                {profit.directCosts.entries.map((entry) => (
                  <li key={entry.id}>
                    {entry.amount} — {entry.description}
                    {entry.workItemId ? ` (#${entry.workItemId.slice(-6)})` : ""}
                  </li>
                ))}
              </ul>
            </details>
            <a href="#direct-costs" className="ml-1 text-xs underline text-muted-foreground hover:text-foreground">
              →
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{S.jobExpensesTotal}</dt>
          <dd className="font-semibold">
            <details>
              <summary className="cursor-pointer list-none">
                {profit.jobExpenses.total} ج.م ({profit.jobExpenses.entries.length})
              </summary>
              <ul className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                {profit.jobExpenses.entries.map((entry) => (
                  <li key={entry.id}>
                    {entry.amount} — {entry.category} ({entry.expenseDate})
                  </li>
                ))}
              </ul>
            </details>
            <Link
              href={`/finance/expenses?orderId=${profit.orderId}`}
              className="ml-1 text-xs underline text-muted-foreground hover:text-foreground"
              title={S.expensesHeading}
            >
              →
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{S.grossProfit}</dt>
          <dd
            className={
              profit.grossProfit.startsWith("-")
                ? "text-lg font-bold text-destructive"
                : "text-lg font-bold"
            }
          >
            {profit.grossProfit} ج.م
          </dd>
        </div>
      </dl>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          {S.revenue}: {profit.revenueEntries.length} × {S.directCosts}: {profit.directCosts.entries.length} × {S.expensesHeading}: {profit.jobExpenses.entries.length}
        </span>
      </div>
    </div>
  );
}
