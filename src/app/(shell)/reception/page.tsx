// Reception queue — 011-orders-reception US3 (T023, T023c).
// Server Component: no "use client". All mutations use inline Server Actions.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getActor } from "~/server/auth";
import { listReceptionQueue, changeOrderPriority } from "~/server/orders";
import type { OrderQueueRow } from "~/server/orders";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const CHANNEL_LABELS: Record<string, string> = {
  WALK_IN: S.channelWalkIn,
  WHATSAPP: S.channelWhatsapp,
  PHONE: S.channelPhone,
  RETURNING: S.channelReturning,
  DIRECT_TO_DESIGNER: S.channelDirectToDesigner,
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: S.orderStatusNotStarted,
  IN_PRODUCTION: S.orderStatusInProduction,
  PARTIALLY_READY: S.orderStatusPartiallyReady,
  DELIVERED: S.orderStatusDelivered,
  COMPLETED: S.orderStatusCompleted,
  CANCELLED: S.orderStatusCancelled,
};

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

async function togglePriorityAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const nextPriority = formStr(formData.get("nextPriority"));
  if (!orderId || (nextPriority !== "NORMAL" && nextPriority !== "URGENT")) return;
  await changeOrderPriority(actor, orderId, nextPriority);
  revalidatePath("/reception");
}

export default async function ReceptionQueuePage() {
  const actor = await getActor();
  const rows = await listReceptionQueue(actor);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{S.receptionQueuePageTitle}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" render={<Link href="/reception/quick-create" />}>
            {S.quickCreateLinkLabel}
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/reception/new" />}>
            {S.newOrderLinkLabel}
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/reception/search" />}>
            {S.searchOrdersLinkLabel}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{S.receptionQueueEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderOrderNumber}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderCustomer}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderChannel}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderPriority}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderOrderStatus}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row: OrderQueueRow) => (
                <tr key={row.orderId} className="bg-card hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/orders/${row.orderId}`} className="hover:underline">
                      #{row.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.customerName}</td>
                  <td className="px-4 py-3">{CHANNEL_LABELS[row.channel] ?? row.channel}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.priority === "URGENT" && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          {S.badgeUrgent}
                        </span>
                      )}
                      {row.isComplete === false && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          {S.badgeIncomplete}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{STATUS_LABELS[row.status] ?? row.status}</td>
                  <td className="px-4 py-3">
                    <form action={togglePriorityAction} className="flex">
                      <input type="hidden" name="orderId" value={row.orderId} />
                      <input
                        type="hidden"
                        name="nextPriority"
                        value={row.priority === "URGENT" ? "NORMAL" : "URGENT"}
                      />
                      <Button type="submit" variant="outline" size="sm">
                        {row.priority === "URGENT" ? S.makeNormalButton : S.makeUrgentButton}
                      </Button>
                    </form>
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
