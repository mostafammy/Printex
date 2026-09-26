// My queue — 012-designer-assignment-timers US3 (T027).
// Server Component: no "use client". All mutations use inline Server
// Actions. Elapsed time is re-derived from `phaseDurations` at render time
// (constitution III) — never a client-side stopwatch.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  Clock,
  Layers,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Flame,
} from "lucide-react";
import { getActor } from "~/server/auth";
import {
  getMyQueue,
  startTimer,
  pauseTimer,
  phaseDurations,
} from "~/server/designers";
import type { MyQueueRow } from "~/server/designers";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    month: "short",
    day: "numeric",
  }).format(date);
}

/** `ms` -> "H:MM:SS" — re-derived from persisted timestamps at every render. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ── Server Actions ──────────────────────────────────────────────────────────

async function startTimerAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  await startTimer(actor, workItemId);
  revalidatePath("/my-queue");
}

async function pauseTimerAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  await pauseTimer(actor, workItemId);
  revalidatePath("/my-queue");
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function MyQueuePage() {
  const actor = await getActor();
  const rows = await getMyQueue(actor);

  const rowsWithDurations = await Promise.all(
    rows.map(async (row) => ({
      row,
      durations: await phaseDurations(actor, row.workItemId),
    })),
  );

  const urgentCount = rows.filter((r) => r.priority === "URGENT").length;
  const activeTimersCount = rows.filter((r) => r.hasOpenTimer).length;
  const reworkCount = rows.filter((r) => r.isRework).length;

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {S.myQueuePageTitle}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3 text-primary animate-pulse" />
              <span>{rows.length} مهام</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            تتبع مهام التصميم والإنتاج الحالية وتشغيل عدادات الإنجاز بدقة فائقة
          </p>
        </div>

        {activeTimersCount > 0 && (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-2xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span>{activeTimersCount} مؤقت قيد التشغيل حالياً</span>
          </div>
        )}
      </div>

      {/* Bento Stats Metric Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Card 1: Total Queue */}
        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              إجمالي الطابور
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {rows.length}
            </span>
            <span className="text-xs text-muted-foreground">مهمة عمل</span>
          </div>
        </div>

        {/* Card 2: Active Timers */}
        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              قيد التنفيذ الآن
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {activeTimersCount}
            </span>
            <span className="text-xs text-muted-foreground">مؤقت نشط</span>
          </div>
        </div>

        {/* Card 3: Urgent Tasks */}
        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              مهام عاجلة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {urgentCount}
            </span>
            <span className="text-xs text-muted-foreground">أولوية قصوى</span>
          </div>
        </div>

        {/* Card 4: Rework Required */}
        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              إعادة تعديل
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {reworkCount}
            </span>
            <span className="text-xs text-muted-foreground">تعديلات مطلوبة</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {rows.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/10 via-indigo-500/10 to-transparent border border-primary/20 shadow-xs">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {S.myQueueEmpty}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            جميع مهامك الحالية منجزة بنجاح. يمكنك استعراض طلبات الاستقبال أو مراجعة الطلبات الجديدة.
          </p>
          <div className="mt-6">
            <Button variant="outline" size="sm" render={<Link href="/reception" />}>
              الانتقال إلى قسم الاستقبال
            </Button>
          </div>
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground">
                  <th className="px-5 py-4 text-start">{S.myQueueTableHeaderCustomer}</th>
                  <th className="px-5 py-4 text-start">{S.myQueueTableHeaderProduct}</th>
                  <th className="px-5 py-4 text-start">{S.myQueueTableHeaderDueDate}</th>
                  <th className="px-5 py-4 text-start">{S.myQueueTableHeaderStatus}</th>
                  <th className="px-5 py-4 text-start">{S.myQueueTableHeaderElapsed}</th>
                  <th className="px-5 py-4 text-start">{S.myQueueTableHeaderActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rowsWithDurations.map(
                  ({
                    row,
                    durations,
                  }: {
                    row: MyQueueRow;
                    durations: Awaited<ReturnType<typeof phaseDurations>>;
                  }) => (
                    <tr
                      key={row.workItemId}
                      className={`group transition-colors duration-150 ${
                        row.hasOpenTimer
                          ? "bg-primary/[0.03] dark:bg-primary/[0.06]"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      {/* Customer & Order Number */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/orders/${row.orderId}`}
                          className="group/link flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          <span>{row.customerName}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/link:opacity-100" />
                        </Link>
                        <div className="mt-0.5 inline-flex items-center font-mono text-xs text-muted-foreground">
                          #{row.orderNumber}
                        </div>
                      </td>

                      {/* Product Type */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                          {row.productTypeName ?? S.myQueueNoProductType}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{formatDate(row.dueDate)}</span>
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.priority === "URGENT" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-2xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                              {S.badgeUrgent}
                            </span>
                          )}
                          {row.isRework && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 shadow-2xs">
                              <RotateCcw className="h-3 w-3" />
                              {S.myQueueBadgeRework}
                            </span>
                          )}
                          {row.priority !== "URGENT" && !row.isRework && (
                            <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                              عادي
                            </span>
                          )}
                        </div>
                        {row.rejectionDetails && (
                          <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-500/5 rounded-md px-2 py-1 border border-rose-500/15 max-w-xs">
                            {row.rejectionDetails.explanation ??
                              row.rejectionDetails.category}
                          </p>
                        )}
                      </td>

                      {/* Elapsed Duration with Live Indicator */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {row.hasOpenTimer && (
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                          )}
                          <span
                            className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium tabular-nums ${
                              row.hasOpenTimer
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-bold"
                                : "bg-muted/60 text-muted-foreground"
                            }`}
                          >
                            {formatDuration(durations.activeTimeMs)}
                          </span>
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="px-5 py-4">
                        <form
                          action={
                            row.hasOpenTimer
                              ? pauseTimerAction
                              : startTimerAction
                          }
                          className="flex"
                        >
                          <input
                            type="hidden"
                            name="workItemId"
                            value={row.workItemId}
                          />
                          <Button
                            type="submit"
                            variant={row.hasOpenTimer ? "outline" : "default"}
                            size="sm"
                            className={
                              row.hasOpenTimer
                                ? "border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                                : undefined
                            }
                          >
                            {row.hasOpenTimer ? (
                              <>
                                <Pause className="h-3.5 w-3.5" />
                                <span>{S.myQueuePauseButton}</span>
                              </>
                            ) : row.state === "IN_DESIGN" ? (
                              <>
                                <Play className="h-3.5 w-3.5" />
                                <span>{S.myQueueResumeButton}</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5" />
                                <span>{S.myQueueStartButton}</span>
                              </>
                            )}
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
