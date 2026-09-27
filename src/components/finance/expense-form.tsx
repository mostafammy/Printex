// <ExpenseForm> — 052-finance US4 (contracts/ui.md, T040).
// Server-rendered form bound to the expenses route's server action.

import { PlusCircle, Receipt, ChevronDown } from "lucide-react";
import { getFinanceConfig } from "~/server/finance";
import { recordExpenseAction } from "~/app/(shell)/finance/expenses/finance-actions";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

export async function ExpenseForm() {
  const config = await getFinanceConfig();
  const activeCategories = config.expenseCategories.filter((c) => c.active);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <details className="group apple-bento-card overflow-hidden border-border/70">
      <summary className="flex cursor-pointer select-none items-center justify-between p-5 text-sm font-bold text-foreground hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold">تسجيل مصروف جديد</span>
            <p className="text-xs font-normal text-muted-foreground">
              إضافة مصروف تشغيلي أو صيانة أو مشتريات مع إرفاق الإيصال
            </p>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <form
        action={recordExpenseAction}
        className="grid gap-4 border-t border-border/60 p-6 sm:grid-cols-2 bg-muted/10"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">{S.expenseAmount}</label>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">{S.expenseCategory}</label>
          <select name="category" className={inputCls} defaultValue={activeCategories[0]?.label}>
            {activeCategories.map((category) => (
              <option key={category.label} value={category.label}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">{S.expenseDate}</label>
          <input name="expenseDate" type="date" defaultValue={today} required className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">{S.employee}</label>
          <input name="employee" type="text" placeholder="اسم الموظف المسؤول..." required className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-xs font-semibold text-foreground">{S.description}</label>
          <input
            name="description"
            type="text"
            placeholder="تفاصيل المصروف والجهة المصروف لها..."
            required
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-xs font-semibold text-foreground">{S.receiptAttachment}</label>
          <input
            name="receipt"
            type="file"
            accept="image/*"
            className="cursor-pointer text-xs text-muted-foreground file:ms-0 file:me-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted/80"
          />
        </div>

        <div className="sm:col-span-2 pt-2">
          <Button
            type="submit"
            variant="default"
            className="w-full sm:w-auto"
          >
            <Receipt className="h-4 w-4" />
            <span>{S.recordExpense}</span>
          </Button>
        </div>
      </form>
    </details>
  );
}
