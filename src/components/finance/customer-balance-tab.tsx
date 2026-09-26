// <CustomerBalanceTab> — 052-finance US3 (contracts/ui.md, T032 + T034
// credit-maintenance surface). Fills 010's slots.paymentsBalance.
// Server Component: balance headline, credit badge, limit + usage with
// warn-only over-limit strip, per-order breakdown linking to each
// OrderFinancePanel, and an Admin/Owner-only edit affordance (admin.config).

import Link from "next/link";
import { ArrowUpRight, AlertTriangle, ShieldCheck, CreditCard, ChevronDown } from "lucide-react";
import { getActor } from "~/server/auth";
import { customerBalance, getCreditStanding } from "~/server/finance";
import { updateCreditAction } from "~/app/(shell)/customers/[id]/finance-actions";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-xs text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

export async function CustomerBalanceTab({ customerId }: { readonly customerId: string }) {
  const [actor, balance, standing] = await Promise.all([
    getActor(),
    customerBalance(customerId),
    getCreditStanding(customerId),
  ]);

  if (!balance) {
    return <p className="text-xs text-muted-foreground py-4 text-center">{S.paymentsEmpty}</p>;
  }

  const canEditCredit = actor.permissions.has("admin.config");
  const overLimit =
    balance.creditLimit !== null && Number(balance.balance) > Number(balance.creditLimit);

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* ── Balance Highlight ── */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-semibold text-muted-foreground">{S.customerBalance}</span>
          <span
            className={
              balance.creditApproved
                ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                : "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground"
            }
          >
            {balance.creditApproved && <ShieldCheck className="h-3 w-3" />}
            <span>{balance.creditApproved ? S.creditBadgeApproved : S.creditBadgeNone}</span>
          </span>
        </div>

        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-foreground">{balance.balance}</span>
          <span className="text-xs font-semibold text-muted-foreground">ج.م</span>
        </div>

        {balance.creditLimit !== null && (
          <p className="mt-1.5 text-2xs text-muted-foreground">
            {S.creditLimit}: <span className="font-semibold text-foreground">{balance.creditLimit} ج.م</span>
          </p>
        )}

        {overLimit && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-2xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>تجاوز الحد الائتماني المسموح به: {balance.balance} &gt; {balance.creditLimit}</span>
          </div>
        )}
      </div>

      {/* ── Orders Breakdown ── */}
      {balance.orders.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-2xs font-bold text-muted-foreground">تفاصيل الحساب لكل طلب</span>
          <ul className="flex flex-col gap-1.5">
            {balance.orders.map((order) => (
              <li
                key={order.orderId}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-background/60 p-2.5 transition-colors hover:border-primary/40"
              >
                <Link
                  href={`/orders/${order.orderId}`}
                  className="inline-flex items-center gap-1 font-mono font-bold text-foreground hover:text-primary transition-colors"
                >
                  <span>#{order.orderNumber}</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </Link>
                <div className="text-2xs text-muted-foreground flex items-center gap-1.5">
                  <span>{S.total} <strong className="text-foreground">{order.total}</strong></span>
                  <span>·</span>
                  <span>{S.paid} <strong className="text-foreground">{order.paid}</strong></span>
                  <span>·</span>
                  <span>{S.remaining} <strong className="text-foreground">{order.remaining}</strong></span>
                  {order.pricingIncomplete && <span className="text-amber-500 font-bold" title="تسعير غير مكتمل">⚠</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Admin Credit Edit Form ── */}
      {canEditCredit && standing && (
        <details className="group rounded-2xl border border-border/70 bg-card overflow-hidden">
          <summary className="flex cursor-pointer select-none items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-primary" />
              <span>{S.editCredit}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <form
            action={updateCreditAction.bind(null, customerId)}
            className="grid gap-3 border-t border-border/60 p-3.5 sm:grid-cols-2 bg-muted/10"
          >
            <div className="flex flex-col gap-1">
              <label className="text-2xs font-semibold text-muted-foreground">{S.creditBadgeApproved}</label>
              <select
                name="creditApproved"
                defaultValue={standing.creditApproved ? "true" : "false"}
                className={inputCls}
              >
                <option value="true">✓ معتمد (Approved)</option>
                <option value="false">✗ غير معتمد (Disabled)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-2xs font-semibold text-muted-foreground">{S.creditLimit}</label>
              <input
                name="creditLimit"
                type="text"
                inputMode="decimal"
                defaultValue={standing.creditLimit ?? ""}
                placeholder="0.00"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-2xs font-semibold text-muted-foreground">{S.creditReason}</label>
              <input
                name="reason"
                type="text"
                required
                placeholder="سبب تحديث الائتمان للمراجعة والتدقيق..."
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2 pt-1">
              <Button
                type="submit"
                variant="default"
                size="sm"
                className="w-full sm:w-auto"
              >
                {S.saveCredit}
              </Button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}
