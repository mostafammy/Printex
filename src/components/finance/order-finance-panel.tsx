// <OrderFinancePanel> — 052-finance US1/US2 (contracts/ui.md, T020).
// Server Component: fills 011's placeholderPayments slot. Read-only mode
// for finance.view-only holders (void/record forms still render only when
// the server actions will authorize them — the actions re-check anyway).

import Link from "next/link";
import { listDirectCosts, listPayments, orderProfitability, orderSummary } from "~/server/finance";
import {
  voidDirectCostAction,
  voidPaymentAction,
} from "~/app/(shell)/orders/[orderId]/finance-actions";
import { RecordPaymentForm } from "./record-payment-form";
import { DirectCostForm } from "./direct-cost-form";
import { ProfitabilityBlock } from "./profitability-block";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

type Props = { readonly orderId: string };

function money(value: string): string {
  return `${value} ج.م`;
}

export async function OrderFinancePanel({ orderId }: Props) {
  const [summary, payments, costs, profit] = await Promise.all([
    orderSummary(orderId),
    listPayments({ orderId, includeVoided: true, pageSize: 50 }),
    listDirectCosts({ orderId, includeVoided: true, pageSize: 50 }),
    orderProfitability(orderId),
  ]);

  if (summary.status === "UNAVAILABLE") {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        {summary.reason}
      </section>
    );
  }

  return (
    <section aria-labelledby="order-finance-heading" className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="order-finance-heading" className="text-base font-semibold">
          {S.panelHeading}
        </h2>
        <span
          className={
            summary.creditApproved
              ? "rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
              : "rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
          }
        >
          {summary.creditApproved ? S.creditApproved : S.creditNotApproved}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{S.total}</dt>
          <dd className="font-semibold">{money(summary.total)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{S.paid}</dt>
          <dd className="font-semibold">{money(summary.paid)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{S.remaining}</dt>
          <dd className={summary.remaining.startsWith("-") ? "font-semibold text-destructive" : "font-semibold"}>
            {money(summary.remaining)}
          </dd>
        </div>
      </dl>
      {summary.pricingIncomplete && (
        <p className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          {S.pricingIncomplete}
        </p>
      )}

      <RecordPaymentForm orderId={orderId} />

      <h3 className="mt-6 text-sm font-semibold">{S.paymentsList}</h3>
      {payments.rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{S.paymentsEmpty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {payments.rows.map((payment) => (
            <li key={payment.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {money(payment.amount)} — {payment.method} / {payment.source}
                </span>
                <span
                  className={
                    payment.voided
                      ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {payment.voided ? S.voided : S.posted}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>
                  {S.date}: {new Date(payment.occurredAt).toLocaleString("ar-EG")}
                </span>
                <span>
                  {S.recorder}: {payment.recordedByName ?? payment.recordedById}
                </span>
                <span>#{payment.receiptNumber}</span>
                {payment.note && <span>{payment.note}</span>}
              </div>
              {payment.voided ? (
                <p className="mt-1 text-xs text-destructive">
                  {S.voidReason}: {payment.voided.reason}
                </p>
              ) : (
                <form
                  action={voidPaymentAction.bind(null, orderId)}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="paymentId" value={payment.id} />
                  <label className="text-xs">
                    <span className="mb-1 block text-muted-foreground">{S.voidReason}</span>
                    <input
                      name="reason"
                      required
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    {S.void}
                  </button>
                </form>
              )}
              <Link
                href={`/finance/receipt/${payment.id}`}
                className="mt-2 inline-block text-xs underline text-muted-foreground hover:text-foreground"
              >
                {S.receipt}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* US5: direct manufacturing costs (T045) */}
      <h3 id="direct-costs" className="mt-6 text-sm font-semibold">{S.directCosts}</h3>
      {costs.rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{S.paymentsEmpty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {costs.rows.map((cost) => (
            <li key={cost.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {cost.amount} ج.م — {cost.description}
                </span>
                <span
                  className={
                    cost.voided
                      ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {cost.voided ? S.voided : S.posted}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>
                  {S.expenseDate}: {cost.costDate}
                </span>
                {cost.workItemId && <span>#{cost.workItemId.slice(-6)}</span>}
              </div>
              {cost.voided ? (
                <p className="mt-1 text-xs text-destructive">
                  {S.voidReason}: —
                </p>
              ) : (
                <form
                  action={voidDirectCostAction.bind(null, orderId)}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="directCostId" value={cost.id} />
                  <label className="text-xs">
                    <span className="mb-1 block text-muted-foreground">{S.voidReason}</span>
                    <input
                      name="reason"
                      required
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    {S.void}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-4 rounded-md border border-border">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium hover:bg-muted">
          {S.addJobCost}
        </summary>
        <DirectCostForm orderId={orderId} />
      </details>

      {/* US6: gross profit (T048) */}
      {profit && <ProfitabilityBlock profit={profit} />}
    </section>
  );
}
