// <OrderFinancePanel> — 052-finance US1/US2 (contracts/ui.md, T020).
// Server Component: fills 011's placeholderPayments slot. Read-only mode
// for finance.view-only holders (void/record forms still render only when
// the server actions will authorize them — the actions re-check anyway).

import Link from "next/link";
import {
  CreditCard,
  AlertTriangle,
  Receipt,
  ShieldCheck,
  PlusCircle,
  ChevronDown,
} from "lucide-react";
import { listDirectCosts, listPayments, orderProfitability, orderSummary } from "~/server/finance";
import {
  voidDirectCostAction,
  voidPaymentAction,
} from "~/app/(shell)/orders/[orderId]/finance-actions";
import { Button } from "~/components/ui/button";
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
      <section className="apple-card p-6 text-sm text-muted-foreground">
        {summary.reason}
      </section>
    );
  }

  return (
    <section aria-labelledby="order-finance-heading" className="apple-card p-6 sm:p-7">
      {/* ── Heading & Status ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 id="order-finance-heading" className="text-base font-bold text-foreground">
              {S.panelHeading}
            </h2>
            <p className="text-xs text-muted-foreground">الحسابات والمدفوعات وتكاليف الإنتاج المباشرة</p>
          </div>
        </div>

        <span
          className={
            summary.creditApproved
              ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
              : "inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
          }
        >
          {summary.creditApproved && <ShieldCheck className="h-3.5 w-3.5" />}
          <span>{summary.creditApproved ? S.creditApproved : S.creditNotApproved}</span>
        </span>
      </div>

      {/* ── Summary Bento Metrics ── */}
      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <dt className="text-xs font-medium text-muted-foreground">{S.total}</dt>
          <dd className="mt-1 text-xl font-bold tracking-tight text-foreground">{money(summary.total)}</dd>
        </div>
        <div className="rounded-2xl border border-border/60 bg-emerald-500/5 p-4">
          <dt className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{S.paid}</dt>
          <dd className="mt-1 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {money(summary.paid)}
          </dd>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <dt className="text-xs font-medium text-muted-foreground">{S.remaining}</dt>
          <dd
            className={`mt-1 text-xl font-bold tracking-tight ${
              summary.remaining.startsWith("-")
                ? "text-destructive"
                : Number(summary.remaining) > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-foreground"
            }`}
          >
            {money(summary.remaining)}
          </dd>
        </div>
      </dl>

      {summary.pricingIncomplete && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{S.pricingIncomplete}</span>
        </div>
      )}

      {/* ── Record Payment Form ── */}
      <div className="mt-5">
        <RecordPaymentForm orderId={orderId} />
      </div>

      {/* ── Payments List ── */}
      <div className="mt-6 border-t border-border/60 pt-5">
        <h3 className="text-sm font-bold text-foreground mb-3">{S.paymentsList}</h3>
        {payments.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{S.paymentsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2.5 text-xs">
            {payments.rows.map((payment) => (
              <li
                key={payment.id}
                className={`rounded-2xl border border-border/60 p-3.5 transition-colors ${
                  payment.voided ? "opacity-60 bg-muted/20" : "bg-card hover:bg-muted/20"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">
                      {money(payment.amount)}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-2xs text-muted-foreground">
                      {payment.method} / {payment.source}
                    </span>
                  </div>
                  <span
                    className={
                      payment.voided
                        ? "rounded-full bg-destructive/10 px-2 py-0.5 text-2xs font-semibold text-destructive border border-destructive/20"
                        : "rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    }
                  >
                    {payment.voided ? S.voided : S.posted}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-3 text-2xs text-muted-foreground">
                  <span>{S.date}: {new Date(payment.occurredAt).toLocaleString("ar-EG")}</span>
                  <span>{S.recorder}: {payment.recordedByName ?? payment.recordedById}</span>
                  <span>إيصال #{payment.receiptNumber}</span>
                  {payment.note && <span>({payment.note})</span>}
                </div>

                {payment.voided ? (
                  <p className="mt-1 text-2xs text-destructive">
                    {S.voidReason}: {payment.voided.reason}
                  </p>
                ) : (
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                    <Link
                      href={`/finance/receipt/${payment.id}`}
                      className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline"
                    >
                      <Receipt className="h-3 w-3" />
                      <span>{S.receipt}</span>
                    </Link>

                    <form
                      action={voidPaymentAction.bind(null, orderId)}
                      className="flex items-center gap-1.5"
                    >
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <input
                        name="reason"
                        required
                        placeholder={S.voidReason}
                        className="w-28 rounded-lg border border-input bg-background px-2 py-0.5 text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <Button
                        type="submit"
                        variant="destructive"
                        size="xs"
                      >
                        {S.void}
                      </Button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Direct Costs ── */}
      <div className="mt-6 border-t border-border/60 pt-5">
        <h3 id="direct-costs" className="text-sm font-bold text-foreground mb-3">
          {S.directCosts}
        </h3>
        {costs.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{S.paymentsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2.5 text-xs">
            {costs.rows.map((cost) => (
              <li
                key={cost.id}
                className={`rounded-2xl border border-border/60 p-3.5 transition-colors ${
                  cost.voided ? "opacity-60 bg-muted/20" : "bg-card hover:bg-muted/20"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-foreground">
                    {cost.amount} ج.م — {cost.description}
                  </span>
                  <span
                    className={
                      cost.voided
                        ? "rounded-full bg-destructive/10 px-2 py-0.5 text-2xs font-semibold text-destructive border border-destructive/20"
                        : "rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground"
                    }
                  >
                    {cost.voided ? S.voided : S.posted}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-2xs text-muted-foreground">
                  <span>{S.expenseDate}: {cost.costDate}</span>
                  {cost.workItemId && <span>صنف #{cost.workItemId.slice(-6)}</span>}
                </div>

                {!cost.voided && (
                  <form
                    action={voidDirectCostAction.bind(null, orderId)}
                    className="mt-2 flex items-center justify-end gap-1.5 border-t border-border/40 pt-2"
                  >
                    <input type="hidden" name="directCostId" value={cost.id} />
                    <input
                      name="reason"
                      required
                      placeholder={S.voidReason}
                      className="w-28 rounded-lg border border-input bg-background px-2 py-0.5 text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button
                      type="submit"
                      variant="destructive"
                      size="xs"
                    >
                      {S.void}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <details className="group mt-3 rounded-2xl border border-border/70 bg-card overflow-hidden">
          <summary className="flex cursor-pointer select-none items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-3.5 w-3.5 text-primary" />
              <span>{S.addJobCost}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <DirectCostForm orderId={orderId} />
        </details>
      </div>

      {/* ── US6: gross profit (T048) ── */}
      {profit && <ProfitabilityBlock profit={profit} />}
    </section>
  );
}
