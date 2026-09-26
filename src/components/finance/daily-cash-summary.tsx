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
    <div className="apple-bento-card p-6 sm:p-8 bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/25">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30">
            <Coins className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">{S.dailyCash}</h2>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground/80">{summary.date}</span>
              <span>·</span>
              <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded-md">{summary.timezone}</span>
            </div>
          </div>
        </div>

        {/* Grand Total Callout Hero Pill */}
        <div className="flex items-baseline gap-2.5 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/10 px-5 py-2.5 text-emerald-700 dark:text-emerald-400 shadow-md shadow-emerald-500/10">
          <span className="text-xs font-bold uppercase tracking-wider">{S.grandTotal}:</span>
          <span className="text-2xl font-black tracking-tight font-mono">
            {summary.grandTotal} <span className="text-sm font-bold">ج.م</span>
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
                    className={`transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isSelected
                        ? "bg-primary/10 dark:bg-primary/15 font-bold shadow-[inset_3px_0_0_#0071e3]"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <td className="py-3.5">
                      <Link
                        href={dayHref(line.method)}
                        className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors font-semibold"
                        title={`${S.paymentsList} — ${line.method}`}
                      >
                        <span className="rounded-xl border border-border/70 bg-card/80 px-3 py-1 text-xs shadow-2xs">
                          {line.method}
                        </span>
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </Link>
                    </td>
                    <td className="py-3.5 font-mono text-xs text-muted-foreground font-semibold">
                      {line.count} معاملة
                    </td>
                    <td className="py-3.5 font-bold text-foreground font-mono text-base">
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
          className="inline-flex items-center gap-2 text-xs font-bold text-primary transition-all hover:translate-y-0.5"
        >
          <span>{S.paymentsList}</span>
          <span className="rounded-full bg-primary/15 border border-primary/25 px-2.5 py-0.5 text-[11px] font-mono font-bold text-primary">
            {summary.paymentIds.length}
          </span>
          <ArrowDownRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
