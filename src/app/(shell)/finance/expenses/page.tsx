// Expenses route — 052-finance US4 (T041). finance.view reads; mutations go
// through the server actions (service-level authorization).

import { authorize, getActor } from "~/server/auth";
import { listExpenses, type ListExpensesFilter } from "~/server/finance";
import { ExpenseForm } from "~/components/finance/expense-form";
import { ExpensesList } from "~/components/finance/expenses-list";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

type Search = Record<string, string | string[] | undefined>;

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const actor = await getActor();
  authorize(actor, "finance.view");
  const params = await searchParams;

  const filter: ListExpensesFilter = {
    from: str(params.from),
    to: str(params.to),
    category: str(params.category),
    employee: str(params.employee),
    approval: str(params.approval) as ListExpensesFilter["approval"],
    page: Number(str(params.page) ?? "1") || 1,
    pageSize: 25,
    includeVoided: str(params.includeVoided) === "true",
  };

  const [result, canModerate] = await Promise.all([
    listExpenses(filter),
    getActor().then((a) => a.permissions.has("expense.record")),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{S.expensesHeading}</h1>

      <ExpenseForm />

      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">{S.expenseDate}</span>
          <input name="from" type="date" defaultValue={filter.from} className="rounded-md border border-input bg-background px-2 py-1" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">{S.expenseDate}</span>
          <input name="to" type="date" defaultValue={filter.to} className="rounded-md border border-input bg-background px-2 py-1" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">{S.expenseCategory}</span>
          <input name="category" type="text" defaultValue={filter.category} className="rounded-md border border-input bg-background px-2 py-1" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">{S.employee}</span>
          <input name="employee" type="text" defaultValue={filter.employee} className="rounded-md border border-input bg-background px-2 py-1" />
        </label>
        <button type="submit" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
          ✓
        </button>
      </form>

      <ExpensesList
        rows={result.rows}
        nextPage={result.nextCursor}
        filters={{
          from: filter.from,
          to: filter.to,
          category: filter.category,
          approval: filter.approval,
        }}
        canModerate={canModerate}
      />
    </div>
  );
}
