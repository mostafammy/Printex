// <DirectCostForm> — 052-finance US5 (contracts/ui.md, T044).
// Server-rendered form bound to the order route's recordDirectCostAction.

import { PlusCircle } from "lucide-react";
import { recordDirectCostAction } from "~/app/(shell)/orders/[orderId]/finance-actions";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2 text-xs text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "transition-all duration-200 shadow-2xs";

export function DirectCostForm({ orderId }: { readonly orderId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form
      action={recordDirectCostAction.bind(null, orderId)}
      className="grid gap-3.5 border-t border-border/60 p-4 sm:grid-cols-2 bg-muted/10 text-xs"
    >
      <div className="flex flex-col gap-1">
        <label className="font-semibold text-foreground">{S.amount}</label>
        <input name="amount" type="text" inputMode="decimal" placeholder="0.00" required className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-semibold text-foreground">{S.expenseDate}</label>
        <input name="costDate" type="date" defaultValue={today} required className={inputCls} />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="font-semibold text-foreground">{S.description}</label>
        <input name="description" type="text" placeholder="وصف التكلفة المباشرة (خامات، عمالة خاصة...)" required className={inputCls} />
      </div>
      <div className="sm:col-span-2 pt-1">
        <Button
          type="submit"
          variant="default"
          size="sm"
        >
          <PlusCircle className="h-4 w-4" />
          <span>{S.addJobCost}</span>
        </Button>
      </div>
    </form>
  );
}
