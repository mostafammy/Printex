// <DailyCashSummary> — 052-finance US7 (contracts/ui.md, T051 + T068).
// Per-method rows with counts/totals, grand total; every figure drills into
// the underlying Payment rows for the selected shop-local day (FR-020).

import Link from "next/link";
import { Coins, Calendar, ArrowDownRight } from "lucide-react";
import type { DailyCashSummary as DailyCash } from "~/server/finance";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

type Props = {
  readonly summary: DailyCash;
  readonly methodFilter?: string | undefined;
};

export function DailyCashSummary({ summary, methodFilter }: Props) {
  const dayHref = (method?: string): string => {
    const params = new URLSearchParams({ date: summary.date });
    if (method) params.set("method", method);
    return `/finance/daily-cash?${params.toString()}`;
  };

  return (
    <div className="apple-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{S.dailyCash}</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Calendar className="h-3 w-3" />
              <span>{summary.date}</span>
              <span>·</span>
              <span className="font-mono text-[11px]">{summary.timezone}</span>
            </div>
          </div>
        </div>

        {/* Grand Total Callout */}
        <div className="flex items-baseline gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-emerald-700 dark:text-emerald-400 shadow-2xs">
          <span className="text-xs font-semibold">{S.grandTotal}:</span>
          <span className="text-xl font-extrabold tracking-tight">
            {summary.grandTotal} ج.م
          </span>
        </div>
      </div>

      {summary.lines.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{S.paymentsEmpty}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs font-semibold text-muted-foreground">
                <th className="py-3 text-start">{S.cashMethod}</th>
                <th className="py-3 text-start">{S.count}</th>
                <th className="py-3 text-start">{S.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {summary.lines.map((line) => {
                const isSelected = methodFilter === line.method;
                return (
                  <tr
                    key={line.method}
                    className={`transition-colors duration-150 ${
                      isSelected
                        ? "bg-primary/5 dark:bg-primary/10 font-semibold"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <td className="py-3.5">
                      <Link
                        href={dayHref(line.method)}
                        className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                        title={`${S.paymentsList} — ${line.method}`}
                      >
                        <span className="rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-medium">
                          {line.method}
                        </span>
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </Link>
                    </td>
                    <td className="py-3.5 font-mono text-xs text-muted-foreground">
                      {line.count} معاملة
                    </td>
                    <td className="py-3.5 font-bold text-foreground">
                      {line.total} ج.م
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 border-t border-border/60 pt-4">
        <a
          href="#payments-of-day"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline"
        >
          <span>{S.paymentsList}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-mono">
            {summary.paymentIds.length}
          </span>
          <ArrowDownRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
