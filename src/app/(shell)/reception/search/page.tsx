// Order search — 011-orders-reception US5 (T032).
// Server Component: no "use client".

import Link from "next/link";
import { getActor } from "~/server/auth";
import { searchOrders } from "~/server/orders";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0";

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: S.orderStatusNotStarted,
  IN_PRODUCTION: S.orderStatusInProduction,
  PARTIALLY_READY: S.orderStatusPartiallyReady,
  DELIVERED: S.orderStatusDelivered,
  COMPLETED: S.orderStatusCompleted,
  CANCELLED: S.orderStatusCancelled,
};

export default async function SearchOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const orderNumber = /^\d+$/.test(q) ? Number(q) : undefined;
  const results = q
    ? await searchOrders(actor, { orderNumber, customerName: orderNumber === undefined ? q : undefined })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{S.searchOrdersPageTitle}</h1>

      <form action="/reception/search" className="flex max-w-lg items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium text-foreground">
            {S.searchQueryLabel}
          </label>
          <input id="q" name="q" type="text" defaultValue={q} className={inputCls} />
        </div>
        <Button type="submit" variant="default">
          {S.searchSubmitButton}
        </Button>
      </form>

      {q && results.length === 0 && <p className="text-muted-foreground">{S.searchNoResults}</p>}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderOrderNumber}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderCustomer}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderOrderStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map((r) => (
                <tr key={r.orderId} className="bg-card hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/orders/${r.orderId}`} className="hover:underline">
                      #{r.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.customerName}</td>
                  <td className="px-4 py-3">{STATUS_LABELS[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
