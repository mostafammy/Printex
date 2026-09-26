// Reception queue — 011-orders-reception US3 (T023, T023c).
// Server Component: no "use client". All mutations use inline Server Actions.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  Inbox,
  Plus,
  Search,
  Sparkles,
  Flame,
  AlertCircle,
  ArrowUpRight,
  Building,
  CheckCircle2,
} from "lucide-react";
import { getActor } from "~/server/auth";
import {
  listReceptionQueuePage,
  getReceptionQueueStats,
  changeOrderPriority,
} from "~/server/orders";
import type { OrderQueueRow } from "~/server/orders";
import { DEFAULT_PAGE_SIZE } from "~/server/pagination";
import { Button } from "~/components/ui/button";
import { PaginationBar } from "~/components/pagination-bar";
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

export default async function ReceptionQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const params = await searchParams;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);

  const [{ rows, nextCursor }, { totalCount, urgentCount, incompleteCount, inProductionCount }] =
    await Promise.all([listReceptionQueuePage(actor, { page }), getReceptionQueueStats(actor)]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {S.receptionQueuePageTitle}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
              <Inbox className="h-3 w-3" />
              <span>صفحة {page}</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة استقبال الطلبات الواردة، التحقق من المواصفات وتوجيهها للمراحل التالية
          </p>
        </div>

        {/* Apple Primary & Secondary Action Group */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="default"
            size="sm"
            render={<Link href="/reception/quick-create" />}
            className="shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>{S.quickCreateLinkLabel}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            render={<Link href="/reception/new" />}
          >
            <Plus className="h-4 w-4" />
            <span>{S.newOrderLinkLabel}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            render={<Link href="/reception/search" />}
          >
            <Search className="h-4 w-4" />
            <span>{S.searchOrdersLinkLabel}</span>
          </Button>
        </div>
      </div>

      {/* Bento Stats Metric Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              طلبات الاستقبال
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-400">
              <Inbox className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {totalCount}
            </span>
            <span className="text-xs text-muted-foreground">طلب نشط</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              طلبات عاجلة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {urgentCount}
            </span>
            <span className="text-xs text-muted-foreground">أولوية فائقة</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              بيانات غير مكتملة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {incompleteCount}
            </span>
            <span className="text-xs text-muted-foreground">تحتاج استكمال</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              في مرحلة الإنتاج
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {inProductionCount}
            </span>
            <span className="text-xs text-muted-foreground">في المطبعة</span>
          </div>
        </div>
      </div>

      {/* Main Table / Empty State */}
      {rows.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500/15 to-primary/15 text-cyan-600 border border-cyan-500/20 shadow-xs">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {S.receptionQueueEmpty}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            لا توجد طلبات معلقة في صالة الاستقبال. يمكنك إنشاء طلب جديد بالضغط على الزر أدناه.
          </p>
          <div className="mt-6">
            <Button
              variant="default"
              size="sm"
              render={<Link href="/reception/quick-create" />}
            >
              <Sparkles className="h-4 w-4" />
              <span>{S.quickCreateLinkLabel}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground">
                  <th className="px-5 py-4 text-start">{S.tableHeaderOrderNumber}</th>
                  <th className="px-5 py-4 text-start">{S.tableHeaderCustomer}</th>
                  <th className="px-5 py-4 text-start">{S.tableHeaderChannel}</th>
                  <th className="px-5 py-4 text-start">{S.tableHeaderPriority}</th>
                  <th className="px-5 py-4 text-start">{S.tableHeaderOrderStatus}</th>
                  <th className="px-5 py-4 text-start">{S.tableHeaderActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row: OrderQueueRow) => (
                  <tr
                    key={row.orderId}
                    className="group transition-colors duration-150 hover:bg-muted/40"
                  >
                    {/* Order Number */}
                    <td className="px-5 py-4">
                      <Link
                        href={`/orders/${row.orderId}`}
                        className="group/link inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground hover:text-primary transition-colors"
                      >
                        <span className="rounded-md border border-border/70 bg-muted/50 px-2 py-1">
                          #{row.orderNumber}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/link:opacity-100" />
                      </Link>
                    </td>

                    {/* Customer */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                          {row.customerName.charAt(0) || "ع"}
                        </div>
                        <span className="font-semibold text-foreground">
                          {row.customerName}
                        </span>
                      </div>
                    </td>

                    {/* Channel */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                        {CHANNEL_LABELS[row.channel] ?? row.channel}
                      </span>
                    </td>

                    {/* Priority & Completeness */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.priority === "URGENT" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-2xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            {S.badgeUrgent}
                          </span>
                        )}
                        {row.isComplete === false && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 shadow-2xs">
                            <AlertCircle className="h-3 w-3" />
                            {S.badgeIncomplete}
                          </span>
                        )}
                        {row.priority !== "URGENT" && row.isComplete !== false && (
                          <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                            عادي
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-muted-foreground">
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>

                    {/* Toggle Priority Action */}
                    <td className="px-5 py-4">
                      <form action={togglePriorityAction} className="flex">
                        <input type="hidden" name="orderId" value={row.orderId} />
                        <input
                          type="hidden"
                          name="nextPriority"
                          value={row.priority === "URGENT" ? "NORMAL" : "URGENT"}
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className={
                            row.priority === "URGENT"
                              ? "border-slate-300 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              : "border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/30"
                          }
                        >
                          {row.priority === "URGENT" ? (
                            S.makeNormalButton
                          ) : (
                            <>
                              <Flame className="h-3.5 w-3.5" />
                              <span>{S.makeUrgentButton}</span>
                            </>
                          )}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalCount > DEFAULT_PAGE_SIZE && (
            <div className="border-t border-border/70 p-4">
              <PaginationBar
                basePath="/reception"
                page={page}
                hasNextPage={nextCursor !== null}
                totalPages={Math.ceil(totalCount / DEFAULT_PAGE_SIZE)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
