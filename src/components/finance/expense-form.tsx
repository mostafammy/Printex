// <ExpenseForm> — 052-finance US4 (contracts/ui.md, T040).
// Server-rendered form bound to the expenses route's server action.

import { getFinanceConfig } from "~/server/finance";
import { recordExpenseAction } from "~/app/(shell)/finance/expenses/finance-actions";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0";

export async function ExpenseForm() {
  const config = await getFinanceConfig();
  const activeCategories = config.expenseCategories.filter((c) => c.active);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={recordExpenseAction}
      className="mt-4 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">{S.expenseAmount}</span>
        <input name="amount" type="text" inputMode="decimal" placeholder="0.00" className={inputCls} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">{S.expenseCategory}</span>
        <select name="category" className={inputCls}>
          {activeCategories.map((category) => (
            <option key={category.label} value={category.label}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">{S.expenseDate}</span>
        <input name="expenseDate" type="date" defaultValue={today} required className={inputCls} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">{S.employee}</span>
        <input name="employee" type="text" required className={inputCls} />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-muted-foreground">{S.description}</span>
        <input name="description" type="text" required className={inputCls} />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-muted-foreground">{S.receiptAttachment}</span>
        <input name="receipt" type="file" accept="image/*" className={inputCls} />
      </label>
      <button
        type="submit"
        className="justify-self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:col-span-2"
      >
        {S.recordExpense}
      </button>
    </form>
  );
}
