// <CustomerBalanceTab> — 052-finance US3 (contracts/ui.md, T032 + T034
// credit-maintenance surface). Fills 010's slots.paymentsBalance.
// Server Component: balance headline, credit badge, limit + usage with
// warn-only over-limit strip, per-order breakdown linking to each
// OrderFinancePanel, and an Admin/Owner-only edit affordance (admin.config).

import Link from "next/link";
import { getActor } from "~/server/auth";
import { customerBalance, getCreditStanding } from "~/server/finance";
import { updateCreditAction } from "~/app/(shell)/customers/[id]/finance-actions";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

export async function CustomerBalanceTab({ customerId }: { readonly customerId: string }) {
  const [actor, balance, standing] = await Promise.all([
    getActor(),
    customerBalance(customerId),
    getCreditStanding(customerId),
  ]);

  if (!balance) {
    return <p className="text-sm text-muted-foreground">{S.paymentsEmpty}</p>;
  }

  const canEditCredit = actor.permissions.has("admin.config");
  const overLimit =
    balance.creditLimit !== null && Number(balance.balance) > Number(balance.creditLimit);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted-foreground">{S.customerBalance}</p>
        <p className="text-2xl font-semibold">{balance.balance} ج.م</p>
        <span
          className={
            balance.creditApproved
              ? "mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              : "mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          }
        >
          {balance.creditApproved ? S.creditBadgeApproved : S.creditBadgeNone}
        </span>
        {balance.creditLimit !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            {S.creditLimit}: {balance.creditLimit} ج.م
          </p>
        )}
        {overLimit && (
          <p className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            {balance.balance} &gt; {balance.creditLimit}
          </p>
        )}
      </div>

      {balance.orders.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {balance.orders.map((order) => (
            <li key={order.orderId} className="flex items-center justify-between gap-2">
              <Link
                href={`/orders/${order.orderId}`}
                className="underline text-muted-foreground hover:text-foreground"
              >
                #{order.orderNumber}
              </Link>
              <span className="text-xs text-muted-foreground">
                {S.total} {order.total} · {S.paid} {order.paid} · {S.remaining} {order.remaining}
                {order.pricingIncomplete ? " ⚠" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEditCredit && standing && (
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium hover:bg-muted">
            {S.editCredit}
          </summary>
          <form
            action={updateCreditAction.bind(null, customerId)}
            className="grid gap-3 border-t border-border p-4 sm:grid-cols-2"
          >
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">{S.creditBadgeApproved}</span>
              <select
                name="creditApproved"
                defaultValue={standing.creditApproved ? "true" : "false"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="true">✓</option>
                <option value="false">✗</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">{S.creditLimit}</span>
              <input
                name="creditLimit"
                type="text"
                inputMode="decimal"
                defaultValue={standing.creditLimit ?? ""}
                placeholder="—"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted-foreground">{S.creditReason}</span>
              <input
                name="reason"
                type="text"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="justify-self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:col-span-2"
            >
              {S.saveCredit}
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
