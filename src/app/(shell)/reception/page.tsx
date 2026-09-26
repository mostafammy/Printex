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
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="default"
            size="sm"
            render={<Link href="/reception/quick-create" />}
            className="h-9.5 gap-2 px-4 rounded-xl shadow-md shadow-primary/25 font-bold hover:shadow-lg hover:shadow-primary/35 hover:-translate-y-0.5"
          >
            <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
            <span>{S.quickCreateLinkLabel}</span>
          </Button>

          <Button
            variant="accent"
            size="sm"
            render={<Link href="/reception/new" />}
            className="h-9.5 gap-2 px-4 rounded-xl shadow-md shadow-emerald-500/25 font-bold hover:shadow-lg hover:shadow-emerald-500/35 hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            <span>{S.newOrderLinkLabel}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            render={<Link href="/reception/search" />}
            className="h-9.5 gap-2 px-4 rounded-xl font-semibold shadow-2xs hover:-translate-y-0.5"
          >
            <Search className="h-4 w-4 text-primary" />
            <span>{S.searchOrdersLinkLabel}</span>
          </Button>
        </div>
      </div>

      {/* Apple VisionOS Bento Stats Metric Row */}
      <div className="grid grid-cols-2 gap-4.5 lg:grid-cols-4">
        {/* Card 1: Reception Total */}
        <div className="apple-bento-card group p-5.5 bg-gradient-to-br from-cyan-500/10 via-card to-card border-cyan-500/25 hover:border-cyan-500/45 hover:shadow-cyan-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              طلبات الاستقبال
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Inbox className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {totalCount}
            </span>
            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">
              طلب نشط
            </span>
          </div>
        </div>

        {/* Card 2: Urgent Orders */}
        <div className="apple-bento-card group p-5.5 bg-gradient-to-br from-rose-500/10 via-card to-card border-rose-500/25 hover:border-rose-500/45 hover:shadow-rose-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                طلبات عاجلة
              </span>
              {urgentCount > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-80" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                </span>
              )}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Flame className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {urgentCount}
            </span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              أولوية فائقة
            </span>
          </div>
        </div>

        {/* Card 3: Incomplete Specs */}
        <div className="apple-bento-card group p-5.5 bg-gradient-to-br from-amber-500/10 via-card to-card border-amber-500/25 hover:border-amber-500/45 hover:shadow-amber-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              بيانات غير مكتملة
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {incompleteCount}
            </span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              تحتاج استكمال
            </span>
          </div>
        </div>

        {/* Card 4: In Production */}
        <div className="apple-bento-card group p-5.5 bg-gradient-to-br from-blue-500/10 via-card to-card border-blue-500/25 hover:border-blue-500/45 hover:shadow-blue-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              في مرحلة الإنتاج
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Building className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {inProductionCount}
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              في المطبعة
            </span>
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
                    className={`group transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      row.priority === "URGENT"
                        ? "bg-rose-500/[0.02] hover:bg-muted/40 shadow-[inset_3px_0_0_#ff3b30]"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    {/* Order Number */}
                    <td className="px-5 py-4">
                      <Link
                        href={`/orders/${row.orderId}`}
                        className="group/link inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground hover:text-primary transition-colors"
                      >
                        <span className="rounded-lg border border-border/70 bg-card/80 px-2.5 py-1 shadow-2xs group-hover/link:border-primary/40 group-hover/link:text-primary transition-all">
                          #{row.orderNumber}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/link:opacity-100" />
                      </Link>
                    </td>

                    {/* Customer */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500/15 to-primary/15 text-xs font-bold text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 shadow-2xs">
                          {row.customerName.charAt(0) || "ع"}
                        </div>
                        <span className="font-bold text-foreground text-sm">
                          {row.customerName}
                        </span>
                      </div>
                    </td>

                    {/* Channel */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground">
                        {CHANNEL_LABELS[row.channel] ?? row.channel}
                      </span>
                    </td>

                    {/* Priority & Completeness */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.priority === "URGENT" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500/15 to-orange-500/15 border border-rose-500/30 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 shadow-2xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            {S.badgeUrgent}
                          </span>
                        )}
                        {row.isComplete === false && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 shadow-2xs">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {S.badgeIncomplete}
                          </span>
                        )}
                        {row.priority !== "URGENT" && row.isComplete !== false && (
                          <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            عادي
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {row.status === "IN_PRODUCTION" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 shadow-2xs">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-80" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                          </span>
                          {STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      ) : row.status === "DELIVERED" || row.status === "COMPLETED" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-2xs">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
                          {STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      )}
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
                              ? "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 font-semibold"
                              : "border-rose-400/50 bg-rose-500/5 text-rose-600 hover:bg-rose-500/15 hover:border-rose-500 font-bold dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          }
                        >
                          {row.priority === "URGENT" ? (
                            S.makeNormalButton
                          ) : (
                            <>
                              <Flame className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
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
