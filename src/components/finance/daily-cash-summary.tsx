// <DailyCashSummary> — 052-finance US7 (contracts/ui.md, T051 + T068).
// Per-method rows with counts/totals, grand total; every figure drills into
// the underlying Payment rows for the selected shop-local day (FR-020).

import Link from "next/link";
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
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{S.dailyCash}</h2>
        <span className="text-xs text-muted-foreground">
          {summary.date} · {summary.timezone}
        </span>
      </div>

      {summary.lines.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{S.paymentsEmpty}</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs text-muted-foreground">
              <th className="py-2 text-start">{S.cashMethod}</th>
              <th className="py-2 text-start">{S.count}</th>
              <th className="py-2 text-start">{S.amount}</th>
            </tr>
          </thead>
          <tbody>
            {summary.lines.map((line) => (
              <tr key={line.method} className="border-b border-border/50">
                <td className="py-2">
                  <Link
                    href={dayHref(line.method)}
                    className="underline decoration-dotted underline-offset-2 hover:text-primary"
                    title={`${S.paymentsList} — ${line.method}`}
                  >
                    {line.method}
                    {methodFilter === line.method ? " ●" : ""}
                  </Link>
                </td>
                <td className="py-2">{line.count}</td>
                <td className="py-2 font-medium">{line.total} ج.م</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-semibold">{S.grandTotal}</td>
              <td className="py-2" />
              <td className="py-2 font-bold">
                <a href="#payments-of-day" className="underline decoration-dotted underline-offset-2 hover:text-primary">
                  {summary.grandTotal} ج.م
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <a
        href="#payments-of-day"
        className="mt-4 inline-block text-xs underline text-muted-foreground hover:text-foreground"
      >
        {S.paymentsList} ({summary.paymentIds.length})
      </a>
    </div>
  );
}
