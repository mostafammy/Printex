// Production queue — 014-production US1 (T043).
// Server Component: no "use client". Mirrors review/page.tsx's shape.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import Link from "next/link";
import { getActor } from "~/server/auth";
import { getOperatorQueue } from "~/server/production";
import ar from "~/messages/ar.json";

const S = ar.ui;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function ProductionQueuePage() {
  const actor = await getActor();
  const rows = await getOperatorQueue(actor);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{S.productionQueuePageTitle}</h1>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{S.productionQueueEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{S.productionQueueTableHeaderCustomer}</th>
                <th className="px-4 py-3 text-start font-medium">{S.productionQueueTableHeaderProduct}</th>
                <th className="px-4 py-3 text-start font-medium">{S.productionQueueTableHeaderEnteredQueue}</th>
                <th className="px-4 py-3 text-start font-medium">{S.productionQueueTableHeaderActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.workItemId} className="bg-card hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/orders/${row.orderId}`} className="hover:underline">
                      {row.customerName}
                    </Link>
                    <div className="text-xs text-muted-foreground">#{row.orderNumber}</div>
                  </td>
                  <td className="px-4 py-3">{row.productTypeName ?? S.myQueueNoProductType}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.priority === "URGENT" && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          {S.badgeUrgent}
                        </span>
                      )}
                      {row.hasPendingFileRevision && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          {S.badgeRevisedFile}
                        </span>
                      )}
                      <span>{formatDate(row.enteredQueueAt)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/production/${row.workItemId}`}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      {S.productionQueueOpenButton}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
