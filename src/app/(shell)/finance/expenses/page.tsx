// Expenses route — 052-finance US4 (T041 + T070 orderId filter + T071
// approve gating). finance.view reads; mutations go through the server
// actions (service-level authorization).

import Link from "next/link";
import { Receipt, Filter, X } from "lucide-react";
import { authorize, getActor } from "~/server/auth";
import { listExpenses, type ListExpensesFilter } from "~/server/finance";
import { ExpenseForm } from "~/components/finance/expense-form";
import { ExpensesList } from "~/components/finance/expenses-list";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

type SearchParams = Record<string, string | string[] | undefined>;

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

const inputCls =
  "rounded-xl border border-input bg-background/80 px-3 py-1.5 text-xs text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 " +
  "transition-all duration-200 shadow-2xs";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await getActor();
  authorize(actor, "finance.view");
  const params = await searchParams;

  const filter: ListExpensesFilter = {
    from: str(params.from),
    to: str(params.to),
    category: str(params.category),
    employee: str(params.employee),
    orderId: str(params.orderId),
    approval: str(params.approval) as ListExpensesFilter["approval"],
    page: Number(str(params.page) ?? "1") || 1,
    pageSize: 25,
    includeVoided: str(params.includeVoided) === "true",
  };

  const [result] = await Promise.all([listExpenses(filter)]);
  const canModerate = actor.permissions.has("expense.record");
  const canApprove = actor.permissions.has("admin.config");

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero Expenses Header ── */}
      <div className="apple-bento-card relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-emerald-500/[0.06] via-card to-card border-emerald-500/25">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 apple-glow-emerald">
              <Receipt className="h-8 w-8" />
              <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-400 ring-2 ring-card">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {S.expensesHeading}
                </h1>
                {filter.orderId && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                    <span>طلب #{filter.orderId.slice(-6)}</span>
                    <Link href="/finance/expenses" className="hover:opacity-75">
                      <X className="h-3 w-3" />
                    </Link>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                إدارة ومتابعة المصروفات التشغيلية للمطبعة والطلبات واعتماد النفقات
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Record New Expense Form Card ── */}
      <ExpenseForm />

      {/* ── Filters Toolbar Card ── */}
      <div className="apple-bento-card p-5 border-border/70">
        <form method="get" className="flex flex-wrap items-end gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">{S.expenseDate} (من)</span>
            <input name="from" type="date" defaultValue={filter.from} className={inputCls} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">{S.expenseDate} (إلى)</span>
            <input name="to" type="date" defaultValue={filter.to} className={inputCls} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">{S.expenseCategory}</span>
            <input
              name="category"
              type="text"
              placeholder="البند..."
              defaultValue={filter.category}
              className={inputCls + " w-36"}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">{S.employee}</span>
            <input
              name="employee"
              type="text"
              placeholder="الموظف..."
              defaultValue={filter.employee}
              className={inputCls + " w-36"}
            />
          </div>

          {filter.orderId && <input type="hidden" name="orderId" value={filter.orderId} />}

          <Button type="submit" variant="default" size="sm">
            <Filter className="h-3.5 w-3.5" />
            <span>تطبيق الفلتر</span>
          </Button>

          {Boolean(filter.from ?? filter.to ?? filter.category ?? filter.employee) && (
            <Link
              href="/finance/expenses"
              className="inline-flex items-center gap-1 rounded-xl border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted active:scale-95 transition-all"
            >
              <X className="h-3.5 w-3.5" />
              <span>إعادة ضبط</span>
            </Link>
          )}
        </form>
      </div>

      {/* ── Expenses List ── */}
      <ExpensesList
        rows={result.rows}
        page={filter.page ?? 1}
        nextPage={result.nextCursor}
        filters={{
          from: filter.from,
          to: filter.to,
          category: filter.category,
          approval: filter.approval,
          orderId: filter.orderId,
        }}
        canModerate={canModerate}
        canApprove={canApprove}
      />
    </div>
  );
}
