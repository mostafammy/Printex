// Quick Create — 011-orders-reception US1 (T014).
// Server Component: no "use client". Inline Server Action.
// FR-001a: every control keyboard-reachable, no mouse-only interaction.

import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { quickCreateOrder } from "~/server/orders";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

async function quickCreateAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "order.create");

  const customerId = formStr(formData.get("customerId"));
  const description = formStr(formData.get("description")).trim();
  const priority = formStr(formData.get("priority"));
  const channel = formStr(formData.get("channel"));
  if (!customerId || !description) return;

  const VALID_CHANNELS = ["WALK_IN", "WHATSAPP", "PHONE", "RETURNING", "DIRECT_TO_DESIGNER"] as const;
  const parsedChannel = (VALID_CHANNELS as readonly string[]).includes(channel)
    ? (channel as (typeof VALID_CHANNELS)[number])
    : undefined;

  const { orderId } = await quickCreateOrder(actor, {
    customerId,
    description,
    priority: priority === "URGENT" ? "URGENT" : "NORMAL",
    channel: parsedChannel,
  });

  redirect(`/orders/${orderId}`);
}

export default async function QuickCreatePage() {
  const actor = await getActor();
  authorize(actor, "order.create");

  const customers = await db.customer.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{S.quickCreatePageTitle}</h1>

      <form action={quickCreateAction} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerId" className="text-sm font-medium text-foreground">
            {S.customerLabel}
          </label>
          <select id="customerId" name="customerId" required className={inputCls} defaultValue="">
            <option value="" disabled>
              {S.customerLabel}
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.isCashCustomer ? S.cashCustomerOption : c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-foreground">
            {S.descriptionLabel}
          </label>
          <input id="description" name="description" type="text" required maxLength={500} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="priority" className="text-sm font-medium text-foreground">
            {S.priorityLabel}
          </label>
          <select id="priority" name="priority" className={inputCls} defaultValue="NORMAL">
            <option value="NORMAL">{S.priorityNormal}</option>
            <option value="URGENT">{S.priorityUrgent}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="channel" className="text-sm font-medium text-foreground">
            {S.channelLabel}
          </label>
          <select id="channel" name="channel" className={inputCls} defaultValue="WALK_IN">
            <option value="WALK_IN">{S.channelWalkIn}</option>
            <option value="WHATSAPP">{S.channelWhatsapp}</option>
            <option value="PHONE">{S.channelPhone}</option>
            <option value="RETURNING">{S.channelReturning}</option>
            <option value="DIRECT_TO_DESIGNER">{S.channelDirectToDesigner}</option>
          </select>
        </div>

        <Button type="submit" variant="default" className="self-start">
          {S.quickCreateSubmitButton}
        </Button>
      </form>
    </div>
  );
}
