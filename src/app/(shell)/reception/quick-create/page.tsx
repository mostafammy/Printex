// Quick Create — 011-orders-reception US1 (T014).
// Server Component: no "use client". Inline Server Action.
// FR-001a: every control keyboard-reachable, no mouse-only interaction.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap, ArrowRight, User, FileText, Flame, Radio } from "lucide-react";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { quickCreateOrder } from "~/server/orders";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

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
    <div className="flex flex-col gap-6">
      {/* ── Breadcrumb ── */}
      <div>
        <Link
          href="/reception"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>العودة لطابور الاستقبال</span>
        </Link>
      </div>

      {/* ── Hero Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-amber-500/10 to-orange-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
            <Zap className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {S.quickCreatePageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              إنشاء سريع ومباشر للطلب وصنف العمل في أقل من 30 ثانية
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick Create Form Card ── */}
      <form
        action={quickCreateAction}
        className="apple-card flex max-w-xl flex-col gap-4 p-6 sm:p-8"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerId" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{S.customerLabel}</span>
          </label>
          <select id="customerId" name="customerId" required className={inputCls} defaultValue="">
            <option value="" disabled>
              اختر العميل...
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.isCashCustomer ? S.cashCustomerOption : c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{S.descriptionLabel}</span>
          </label>
          <input
            id="description"
            name="description"
            type="text"
            required
            maxLength={500}
            placeholder="مثال: طباعة 1000 فلاير A5 كوشيه 150 جرام..."
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="priority" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-rose-500" />
              <span>{S.priorityLabel}</span>
            </label>
            <select id="priority" name="priority" className={inputCls} defaultValue="NORMAL">
              <option value="NORMAL">{S.priorityNormal}</option>
              <option value="URGENT">{S.priorityUrgent}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="channel" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-primary" />
              <span>{S.channelLabel}</span>
            </label>
            <select id="channel" name="channel" className={inputCls} defaultValue="WALK_IN">
              <option value="WALK_IN">{S.channelWalkIn}</option>
              <option value="WHATSAPP">{S.channelWhatsapp}</option>
              <option value="PHONE">{S.channelPhone}</option>
              <option value="RETURNING">{S.channelReturning}</option>
              <option value="DIRECT_TO_DESIGNER">{S.channelDirectToDesigner}</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <Button type="submit" variant="default" className="w-full sm:w-auto">
            <Zap className="h-4 w-4" />
            <span>{S.quickCreateSubmitButton}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
