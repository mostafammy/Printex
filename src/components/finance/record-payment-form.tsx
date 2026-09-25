// Record-payment form (contracts/ui.md RecordPaymentDialog) — 052-finance
// T019. Native <details> dialog: no client JS, RTL-safe, fits FR-021's
// ≤3-interaction budget (amount → method/source preselected → confirm),
// with server-resolved 100% / 50% presets that never auto-submit.

import { getFinanceConfig } from "~/server/finance";
import { recordPaymentAction } from "~/app/(shell)/orders/[orderId]/finance-actions";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export async function RecordPaymentForm({ orderId }: { readonly orderId: string }) {
  const config = await getFinanceConfig();
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <details className="mt-4 rounded-md border border-border">
      <summary className="cursor-pointer select-none rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
        {S.recordPayment}
      </summary>
      <form
        action={recordPaymentAction.bind(null, orderId)}
        className="grid gap-3 border-t border-border p-4 sm:grid-cols-2"
      >
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">{S.amount}</span>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">{S.method}</span>
          <select name="method" defaultValue={config.paymentMethods[0]} className={inputCls}>
            {config.paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">{S.source}</span>
          <select name="source" defaultValue={config.paymentSources[0]} className={inputCls}>
            {config.paymentSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">{S.occurredAt}</span>
          <input
            name="occurredAt"
            type="datetime-local"
            defaultValue={nowLocal}
            required
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">{S.note}</span>
          <input name="note" type="text" className={inputCls} />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            name="preset"
            value="full"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {S.payFull}
          </button>
          <button
            type="submit"
            name="preset"
            value="half"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {S.payHalf}
          </button>
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {S.savePayment}
          </button>
        </div>
      </form>
    </details>
  );
}
