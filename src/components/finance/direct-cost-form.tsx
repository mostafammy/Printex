// <DirectCostForm> — 052-finance US5 (contracts/ui.md, T044).
// Server-rendered form bound to the order route's recordDirectCostAction.

import { recordDirectCostAction } from "~/app/(shell)/orders/[orderId]/finance-actions";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0";

export function DirectCostForm({ orderId }: { readonly orderId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form
      action={recordDirectCostAction.bind(null, orderId)}
      className="grid gap-3 border-t border-border p-4 sm:grid-cols-2"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">{S.amount}</span>
        <input name="amount" type="text" inputMode="decimal" placeholder="0.00" className={inputCls} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">{S.expenseDate}</span>
        <input name="costDate" type="date" defaultValue={today} required className={inputCls} />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-muted-foreground">{S.description}</span>
        <input name="description" type="text" required className={inputCls} />
      </label>
      <button
        type="submit"
        className="justify-self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:col-span-2"
      >
        {S.addJobCost}
      </button>
    </form>
  );
}
