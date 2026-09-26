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
      pageSize: 100,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Date Filter Bar */}
      <div className="apple-card p-4 sm:p-5">
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
          <button
            type="submit"
            className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-105 active:scale-95 transition-all"
          >
            تطبيق التاريخ
          </button>
        </form>
      </div>

      <DailyCashSummary summary={summary} methodFilter={methodFilter} />

      {/* FR-020 drill-down: the actual payments behind every figure above. */}
      <section id="payments-of-day" className="apple-card p-6 sm:p-8">
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
          <ul className="mt-6 flex flex-col gap-3 text-sm">
            {payments.rows.map((payment) => (
              <li
                key={payment.id}
                className="apple-card p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">
                      {payment.amount} ج.م
                    </span>
                    <span className="rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs font-semibold">
                      {payment.method}
                    </span>
                    <span className="rounded-lg bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground font-medium">
                      {payment.source}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    #{payment.receiptNumber}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{new Date(payment.occurredAt).toLocaleString("ar-EG")}</span>
                  <span>
                    {S.recorder}: <strong className="text-foreground">{payment.recordedByName ?? payment.recordedById}</strong>
                  </span>
                  {payment.note && <span className="text-foreground/80">«{payment.note}»</span>}
                  <a
                    href={`/orders/${payment.orderId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    الطلب #{payment.orderId.slice(-6)}
                  </a>
                  <a
                    href={`/finance/receipt/${payment.id}`}
                    className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {S.receipt} ←
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        {payments.nextCursor !== null && (
          <p className="mt-4 text-xs text-muted-foreground">…</p>
        )}
      </section>
    </div>
  );
}
