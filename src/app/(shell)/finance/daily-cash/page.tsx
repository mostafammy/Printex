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
    <div className="flex flex-col gap-6">
      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">{S.expenseDate}</span>
          <input
            name="date"
            type="date"
            defaultValue={date}
            className="rounded-md border border-input bg-background px-2 py-1"
          />
        </label>
        {methodFilter && <input type="hidden" name="method" value={methodFilter} />}
        <button type="submit" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
          ✓
        </button>
      </form>

      <DailyCashSummary summary={summary} methodFilter={methodFilter} />

      {/* FR-020 drill-down: the actual payments behind every figure above. */}
      <section id="payments-of-day" className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">{S.paymentsList}</h2>
          <span className="text-xs text-muted-foreground">
            {date}
            {methodFilter ? ` · ${methodFilter}` : ""}
            {methodFilter && (
              <>
                {" · "}
                <a href={`/finance/daily-cash?date=${date}`} className="underline">
                  ×
                </a>
              </>
            )}
          </span>
        </div>
        {payments.rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{S.paymentsEmpty}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {payments.rows.map((payment) => (
              <li key={payment.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {payment.amount} ج.م — {payment.method} / {payment.source}
                  </span>
                  <span className="text-xs text-muted-foreground">#{payment.receiptNumber}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>{new Date(payment.occurredAt).toLocaleString("ar-EG")}</span>
                  <span>
                    {S.recorder}: {payment.recordedByName ?? payment.recordedById}
                  </span>
                  {payment.note && <span>{payment.note}</span>}
                  <a href={`/orders/${payment.orderId}`} className="underline hover:text-foreground">
                    #{payment.orderId.slice(-6)}
                  </a>
                  <a href={`/finance/receipt/${payment.id}`} className="underline hover:text-foreground">
                    {S.receipt}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        {payments.nextCursor !== null && (
          <p className="mt-3 text-xs text-muted-foreground">…</p>
        )}
      </section>
    </div>
  );
}
