// <ExpensesList> — 052-finance US4 (contracts/ui.md, T039).
// Filters (date range, category, order, employee, approval state), approval
// pill, voided state, receipt count placeholder, pagination cursor.

import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Receipt,
  ArrowUpRight,
  Paperclip,
} from "lucide-react";
import type { ExpenseRow } from "~/server/finance";
import {
  approveExpenseAction,
  voidExpenseAction,
} from "~/app/(shell)/finance/expenses/finance-actions";
import { Button } from "~/components/ui/button";
import { PaginationBar } from "~/components/pagination-bar";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

type Props = {
  readonly rows: readonly ExpenseRow[];
  readonly page: number;
  readonly nextPage: number | null;
  readonly filters: {
    readonly from?: string;
    readonly to?: string;
    readonly category?: string;
    readonly approval?: string;
    readonly orderId?: string;
  };
  /** void permission (expense.record) — shows the void form. */
  readonly canModerate: boolean;
  /** approve permission (admin.config) — shows the approve button (T071). */
  readonly canApprove: boolean;
};

export function ExpensesList({ rows, page, nextPage, filters, canModerate, canApprove }: Props) {
  if (rows.length === 0) {
    return (
      <div className="apple-bento-card flex flex-col items-center justify-center p-14 text-center border-border/70">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs apple-glow-emerald">
          <Receipt className="h-7 w-7" />
        </div>
        <p className="text-base font-bold text-foreground">{S.paymentsEmpty}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          لا توجد مصروفات تطابق معايير البحث المحددة.
        </p>
      </div>
    );
  }

  const query = {
    from: filters.from,
    to: filters.to,
    category: filters.category,
    approval: filters.approval,
    orderId: filters.orderId,
  };

  return (
    <div className="space-y-4">
      <ul className="flex flex-col gap-3.5">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`apple-bento-card p-5 transition-all border-border/70 ${
              row.voided ? "opacity-60 bg-muted/20" : "hover:border-emerald-500/30"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-extrabold tracking-tight text-foreground">{row.amount}</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">ج.م</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="rounded-xl border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs font-bold text-foreground">
                      {row.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{row.description}</p>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {row.voided && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive border border-destructive/20">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>{S.voided}</span>
                  </span>
                )}
                {row.awaitingApproval && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-500/25 apple-glow-amber">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{S.awaitingApproval}</span>
                  </span>
                )}
                {row.approvedAt && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>معتمد</span>
                  </span>
                )}
              </div>
            </div>

            {/* Meta tags */}
            <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border/50 pt-3 text-xs text-muted-foreground">
              <span>{S.expenseDate}: <strong className="text-foreground">{row.expenseDate}</strong></span>
              <span>{S.employee}: <strong className="text-foreground">{row.employee}</strong></span>
              {row.orderId && (
                <Link
                  href={`/orders/${row.orderId}`}
                  className="inline-flex items-center gap-1 font-mono font-bold text-primary hover:underline"
                >
                  <span>الطلب #{row.orderId.slice(-6)}</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
              {row.receiptAttachmentId && (
                <a
                  href={`/api/finance/expense-receipt/${row.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{S.receiptAttachment}</span>
                </a>
              )}
            </div>

            {/* Moderation Actions (Approve / Void) */}
            {!row.voided && (canApprove || canModerate) && (
              <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2.5 border-t border-border/50 pt-3">
                {canApprove && row.awaitingApproval && (
                  <form action={approveExpenseAction}>
                    <input type="hidden" name="expenseId" value={row.id} />
                    <Button type="submit" variant="default" size="xs" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs apple-glow-emerald">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{S.approve}</span>
                    </Button>
                  </form>
                )}
                {canModerate && (
                  <form action={voidExpenseAction} className="flex items-center gap-2">
                    <input type="hidden" name="expenseId" value={row.id} />
                    <input
                      name="reason"
                      required
                      placeholder={S.voidReason}
                      className="w-40 rounded-xl border border-input bg-background/80 px-3 py-1 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                    />
                    <Button type="submit" variant="destructive" size="xs">
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{S.void}</span>
                    </Button>
                  </form>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="pt-2">
        <PaginationBar
          basePath="/finance/expenses"
          page={page}
          hasNextPage={nextPage !== null}
          query={query}
        />
      </div>
    </div>
  );
}
