// Daily cash route — 052-finance US7 (T052 + T068). finance.view required.
// The payments-of-the-day section is the FR-020/SC-007 drill-down: every
// figure above resolves to the actual Payment rows for the selected
// shop-local date (optionally filtered by method).

import { authorize, getActor } from "~/server/auth";
import {
  dailyCashSummary,
  getShopTimezone,
  listPayments,
  shopLocalDayBoundsUtc,
  todayShopLocalDate,
} from "~/server/finance";
import { DailyCashSummary } from "~/components/finance/daily-cash-summary";
import { PaginationBar } from "~/components/pagination-bar";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

type Search = Record<string, string | string[] | undefined>;

export default async function DailyCashPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const actor = await getActor();
  authorize(actor, "finance.view");
  const params = await searchParams;
  const requested = typeof params.date === "string" && params.date ? params.date : null;
  const date = requested ?? (await todayShopLocalDate());
  const methodFilter = typeof params.method === "string" && params.method ? params.method : undefined;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);

  const timezone = await getShopTimezone();
  const { startUtc, endUtc } = shopLocalDayBoundsUtc(date, timezone);
  const [summary, payments] = await Promise.all([
    dailyCashSummary(date),
    listPayments({
      from: startUtc,
      // listPayments lte is inclusive; bounds end is exclusive — pull back 1 ms.
      to: new Date(endUtc.getTime() - 1),
      method: methodFilter,
      includeVoided: false,
      page,
      pageSize: 25,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Date Filter Bar */}
      <div className="apple-bento-card p-5 border-border/70">
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{S.expenseDate}</span>
            <input
              name="date"
              type="date"
              defaultValue={date}
              className="rounded-xl border border-input bg-background/80 px-3.5 py-2 text-sm text-foreground shadow-2xs focus:border-primary focus:ring-3 focus:ring-primary/25 focus:outline-none"
            />
          </label>
          {methodFilter && <input type="hidden" name="method" value={methodFilter} />}
          <Button
            type="submit"
            variant="default"
            size="sm"
          >
            <span>تطبيق التاريخ</span>
          </Button>
        </form>
      </div>

      <DailyCashSummary summary={summary} methodFilter={methodFilter} />

      {/* FR-020 drill-down: the actual payments behind every figure above. */}
      <section id="payments-of-day" className="apple-bento-card p-6 sm:p-8 border-border/70">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-4">
          <h2 className="text-base font-bold text-foreground">{S.paymentsList}</h2>
          <span className="text-xs text-muted-foreground">
            {date}
            {methodFilter ? ` · ${methodFilter}` : ""}
            {methodFilter && (
              <>
                {" · "}
                <a href={`/finance/daily-cash?date=${date}`} className="font-bold text-destructive hover:underline">
                  إلغاء التصفية ×
                </a>
              </>
            )}
          </span>
        </div>
        {payments.rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">{S.paymentsEmpty}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3.5 text-sm">
            {payments.rows.map((payment) => (
              <li
                key={payment.id}
                className="apple-bento-card apple-interactive-row p-4.5 border-border/70 hover:border-emerald-500/30 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-lg text-foreground">
                      {payment.amount} <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">ج.م</span>
                    </span>
                    <span className="rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold">
                      {payment.method}
                    </span>
                    <span className="rounded-xl bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground font-semibold">
                      {payment.source}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg">
                    #{payment.receiptNumber}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground border-t border-border/40 pt-2.5">
                  <span>{new Date(payment.occurredAt).toLocaleString("ar-EG")}</span>
                  <span>
                    {S.recorder}: <strong className="text-foreground">{payment.recordedByName ?? payment.recordedById}</strong>
                  </span>
                  {payment.note && <span className="text-foreground/80 font-medium">«{payment.note}»</span>}
                  <a
                    href={`/orders/${payment.orderId}`}
                    className="font-bold text-primary hover:underline"
                  >
                    الطلب #{payment.orderId.slice(-6)}
                  </a>
                  <a
                    href={`/finance/receipt/${payment.id}`}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {S.receipt} ←
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <PaginationBar
            basePath="/finance/daily-cash"
            page={page}
            hasNextPage={payments.nextCursor !== null}
            query={{ date, method: methodFilter }}
          />
        </div>
      </section>
    </div>
  );
}
