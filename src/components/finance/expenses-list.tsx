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
  ChevronLeft,
  Paperclip,
} from "lucide-react";
import type { ExpenseRow } from "~/server/finance";
import {
  approveExpenseAction,
  voidExpenseAction,
} from "~/app/(shell)/finance/expenses/finance-actions";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

type Props = {
  readonly rows: readonly ExpenseRow[];
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

export function ExpensesList({ rows, nextPage, filters, canModerate, canApprove }: Props) {
  if (rows.length === 0) {
    return (
      <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          <Receipt className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">{S.paymentsEmpty}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          لا توجد مصروفات تطابق معايير البحث المحددة.
        </p>
      </div>
    );
  }

  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.category) query.set("category", filters.category);
  if (filters.approval) query.set("approval", filters.approval);
  if (filters.orderId) query.set("orderId", filters.orderId);

  return (
    <div className="space-y-4">
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`apple-card p-4 transition-all sm:p-5 ${
              row.voided ? "opacity-60 bg-muted/20" : ""
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-foreground">{row.amount}</span>
                    <span className="text-xs font-semibold text-muted-foreground">ج.م</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="rounded-lg bg-muted/60 px-2 py-0.5 text-xs font-semibold text-foreground">
                      {row.category}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                {row.voided && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive border border-destructive/20">
                    <XCircle className="h-3 w-3" />
                    <span>{S.voided}</span>
                  </span>
                )}
                {row.awaitingApproval && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    <AlertCircle className="h-3 w-3" />
                    <span>{S.awaitingApproval}</span>
                  </span>
                )}
                {row.approvedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>معتمد</span>
                  </span>
                )}
              </div>
            </div>

            {/* Meta tags */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
              <span>{S.expenseDate}: <strong className="text-foreground">{row.expenseDate}</strong></span>
              <span>{S.employee}: <strong className="text-foreground">{row.employee}</strong></span>
              {row.orderId && (
                <Link
                  href={`/orders/${row.orderId}`}
                  className="inline-flex items-center gap-1 font-mono font-semibold text-primary hover:underline"
                >
                  <span>#{row.orderId.slice(-6)}</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
              {row.receiptAttachmentId && (
                <a
                  href={`/api/finance/expense-receipt/${row.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <Paperclip className="h-3 w-3" />
                  <span>{S.receiptAttachment}</span>
                </a>
              )}
            </div>

            {/* Moderation Actions (Approve / Void) */}
            {!row.voided && (canApprove || canModerate) && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-2.5">
                {canApprove && row.awaitingApproval && (
                  <form action={approveExpenseAction}>
                    <input type="hidden" name="expenseId" value={row.id} />
                    <Button type="submit" variant="default" size="xs" className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
                      className="w-36 rounded-lg border border-input bg-background/80 px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
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

      {nextPage !== null && (
        <div className="pt-2 text-center">
          <Link
            href={`/finance/expenses?${query.toString()}&page=${nextPage}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted transition-colors"
          >
            <span>الصفحة التالية</span>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
