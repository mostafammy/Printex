// Order search — 011-orders-reception US5 (T032).
// Server Component: no "use client".

import Link from "next/link";
import { Search, ArrowRight, ArrowUpRight } from "lucide-react";
import { getActor } from "~/server/auth";
import { searchOrders } from "~/server/orders";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-4 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "transition-all duration-200 shadow-2xs";

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: S.orderStatusNotStarted,
  IN_PRODUCTION: S.orderStatusInProduction,
  PARTIALLY_READY: S.orderStatusPartiallyReady,
  DELIVERED: S.orderStatusDelivered,
  COMPLETED: S.orderStatusCompleted,
  CANCELLED: S.orderStatusCancelled,
};

export default async function SearchOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const orderNumber = /^\d+$/.test(q) ? Number(q) : undefined;
  const results = q
    ? await searchOrders(actor, { orderNumber, customerName: orderNumber === undefined ? q : undefined })
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Breadcrumb ── */}
      <div>
        <Link
          href="/reception"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>العودة لطابور الاستقبال</span>
        </Link>
      </div>

      {/* ── Hero Search Header ── */}
      <div className="apple-bento-card relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-cyan-500/[0.06] via-card to-card border-cyan-500/25">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 apple-glow-cyan">
            <Search className="h-8 w-8" />
            <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {S.searchOrdersPageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              البحث الفوري الذكي عن الطلبات ومتابعة مسار التنفيذ والمواصفات
            </p>
          </div>
        </div>
      </div>

      {/* ── Search Bar Card ── */}
      <div className="apple-bento-card p-6 sm:p-7 border-border/70">
        <form action="/reception/search" className="flex max-w-xl items-end gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="q" className="text-xs font-bold text-foreground">
              {S.searchQueryLabel}
            </label>
            <div className="relative">
              <input
                id="q"
                name="q"
                type="text"
                defaultValue={q}
                placeholder="أدخل رقم الطلب أو اسم العميل للبحث الفوري..."
                className={inputCls + " ps-10"}
              />
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>
          <Button type="submit" variant="default">
            <span>{S.searchSubmitButton}</span>
          </Button>
        </form>
      </div>

      {/* ── Search Results ── */}
      {q && results.length === 0 && (
        <div className="apple-bento-card flex flex-col items-center justify-center p-14 text-center border-border/70">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            <Search className="h-7 w-7" />
          </div>
          <p className="text-base font-bold text-foreground">{S.searchNoResults}</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            تأكد من كتابة رقم الطلب بشكل صحيح أو تجربة جزء من اسم العميل.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="apple-bento-card overflow-hidden border-border/70">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/70 bg-muted/40 text-muted-foreground text-xs font-bold">
                <tr>
                  <th className="px-6 py-4 text-start">{S.tableHeaderOrderNumber}</th>
                  <th className="px-6 py-4 text-start">{S.tableHeaderCustomer}</th>
                  <th className="px-6 py-4 text-start">{S.tableHeaderOrderStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {results.map((r) => {
                  const initials = (r.customerName || "ع")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("");

                  return (
                    <tr key={r.orderId} className="apple-interactive-row transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">
                        <Link
                          href={`/orders/${r.orderId}`}
                          className="inline-flex items-center gap-1.5 font-mono text-primary hover:underline font-bold"
                        >
                          <span>#{r.orderNumber}</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-xs">
                            {initials}
                          </div>
                          <span>{r.customerName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary">
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
