// Record-payment form (contracts/ui.md RecordPaymentDialog) — 052-finance
// T019. Native <details> dialog: no client JS, RTL-safe, fits FR-021's
// ≤3-interaction budget (amount → method/source preselected → confirm),
// with server-resolved 100% / 50% presets that never auto-submit.

import { PlusCircle, ChevronDown } from "lucide-react";
import { getFinanceConfig } from "~/server/finance";
import { recordPaymentAction } from "~/app/(shell)/orders/[orderId]/finance-actions";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2 text-xs text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

export async function RecordPaymentForm({ orderId }: { readonly orderId: string }) {
  const config = await getFinanceConfig();
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <details className="group rounded-2xl border border-border/70 bg-card overflow-hidden">
      <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-xs font-bold text-foreground hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{S.recordPayment}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <form
        action={recordPaymentAction.bind(null, orderId)}
        className="grid gap-3.5 border-t border-border/60 p-4 sm:grid-cols-2 bg-muted/10 text-xs"
      >
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="font-semibold text-foreground">{S.amount}</label>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-foreground">{S.method}</label>
          <select name="method" defaultValue={config.paymentMethods[0]} className={inputCls}>
            {config.paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-foreground">{S.source}</label>
          <select name="source" defaultValue={config.paymentSources[0]} className={inputCls}>
            {config.paymentSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-foreground">{S.occurredAt}</label>
          <input
            name="occurredAt"
            type="datetime-local"
            defaultValue={nowLocal}
            required
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-foreground">{S.note}</label>
          <input name="note" type="text" placeholder="ملاحظات الدفعة..." className={inputCls} />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 sm:col-span-2">
          <Button
            type="submit"
            name="preset"
            value="full"
            variant="default"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
          >
            {S.payFull}
          </Button>

          <Button
            type="submit"
            name="preset"
            value="half"
            variant="outline"
            size="sm"
          >
            {S.payHalf}
          </Button>

          <Button
            type="submit"
            variant="secondary"
            size="sm"
          >
            {S.savePayment}
          </Button>
        </div>
      </form>
    </details>
  );
}
