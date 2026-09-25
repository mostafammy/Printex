// <ExpensesList> — 052-finance US4 (contracts/ui.md, T039).
// Filters (date range, category, order, employee, approval state), approval
// pill, voided state, receipt count placeholder, pagination cursor.

import Link from "next/link";
import type { ExpenseRow } from "~/server/finance";
import {
  approveExpenseAction,
  voidExpenseAction,
} from "~/app/(shell)/finance/expenses/finance-actions";
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
    return <p className="mt-4 text-sm text-muted-foreground">{S.paymentsEmpty}</p>;
  }

  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.category) query.set("category", filters.category);
  if (filters.approval) query.set("approval", filters.approval);
  if (filters.orderId) query.set("orderId", filters.orderId);

  return (
    <div className="mt-4">
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {row.amount} ج.م — {row.category}
              </span>
              <span className="flex gap-1">
                {row.voided && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    {S.voided}
                  </span>
                )}
                {row.awaitingApproval && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                    {S.awaitingApproval}
                  </span>
                )}
                {row.approvedAt && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    ✓
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>{S.expenseDate}: {row.expenseDate}</span>
              <span>{S.employee}: {row.employee}</span>
              <span>{row.description}</span>
              {row.orderId && (
                <Link href={`/orders/${row.orderId}`} className="underline hover:text-foreground">
                  #{row.orderId.slice(-6)}
                </Link>
              )}
              {row.receiptAttachmentId && (
                <a
                  href={`/api/finance/expense-receipt/${row.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary hover:opacity-80"
                >
                  {S.receiptAttachment}
                </a>
              )}
            </div>
            {!row.voided && (canApprove || canModerate) && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {canApprove && row.awaitingApproval && (
                  <form action={approveExpenseAction}>
                    <input type="hidden" name="expenseId" value={row.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-primary/40 px-3 py-1 text-xs text-primary hover:bg-primary/10"
                    >
                      {S.approve}
                    </button>
                  </form>
                )}
                {canModerate && (
                  <form action={voidExpenseAction} className="flex items-end gap-2">
                    <input type="hidden" name="expenseId" value={row.id} />
                    <input
                      name="reason"
                      required
                      placeholder={S.voidReason}
                      className="w-36 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      {S.void}
                    </button>
                  </form>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {nextPage !== null && (
        <Link
          href={`/finance/expenses?${query.toString()}&page=${nextPage}`}
          className="mt-3 inline-block text-sm underline text-muted-foreground hover:text-foreground"
        >
          →
        </Link>
      )}
    </div>
  );
}
