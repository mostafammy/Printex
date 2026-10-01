// My queue — 012-designer-assignment-timers US3 (T027).
// Server Component: loads initial page, durations, and stats, delegates infinite scroll table to client.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { redirect } from "next/navigation";
import {
  Clock,
  Layers,
  RotateCcw,
  Sparkles,
  Flame,
} from "lucide-react";
import { getActor } from "~/server/auth";
import {
  getMyQueuePage,
  getMyQueueStats,
  phaseDurationsByIds,
} from "~/server/designers";
import { MyQueueTable } from "./MyQueueTable";
import ar from "~/messages/ar.json";

const S = ar.ui;

export default async function MyQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const allowedRoles = [
    "DESIGNER",
    "HEAD_DESIGNER",
    "RECEPTION",
    "PRINT_RECEPTION_DELIVERY",
    "ADMIN_OWNER",
  ];
  if (!actor.roles.some((r) => allowedRoles.includes(r))) {
    redirect("/board");
  }
  const params = await searchParams;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);

  const [{ rows, nextCursor }, { totalCount, urgentCount, reworkCount }] = await Promise.all([
    getMyQueuePage(actor, { page }),
    getMyQueueStats(actor),
  ]);

  // One batched duration read for the whole page (FR-016/FR-017): rows are
  // already actor-scoped by getMyQueuePage, so their ids are the batch's
  // complete scoping (FR-018).
  const durationsById = await phaseDurationsByIds(
    actor,
    rows.map((row) => row.workItemId),
  );
  const rowsWithDurations = rows.map((row) => ({
    row,
    durations: durationsById.get(row.workItemId)!,
  }));

  const activeTimersCount = rows.filter((r) => r.hasOpenTimer).length;

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
              <span>{totalCount} مهام</span>
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
      <div className="grid grid-cols-2 gap-4.5 lg:grid-cols-4">
        {/* Card 1: Total Queue */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-xs group p-5.5 bg-gradient-to-br from-indigo-500/10 via-card to-card border-indigo-500/25 hover:border-indigo-500/45 hover:shadow-indigo-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              إجمالي الطابور
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {totalCount}
            </span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              مهام قيد الانتظار
            </span>
          </div>
        </div>

        {/* Card 2: Active Timers */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-xs group p-5.5 bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/25 hover:border-emerald-500/45 hover:shadow-emerald-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                قيد التنفيذ الآن
              </span>
              {activeTimersCount > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              )}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {activeTimersCount}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              مؤقت نشط
            </span>
          </div>
        </div>

        {/* Card 3: Urgent Tasks */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-xs group p-5.5 bg-gradient-to-br from-rose-500/10 via-card to-card border-rose-500/25 hover:border-rose-500/45 hover:shadow-rose-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              مهام عاجلة
            </span>
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

        {/* Card 4: Rework Required */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-xs group p-5.5 bg-gradient-to-br from-amber-500/10 via-card to-card border-amber-500/25 hover:border-amber-500/45 hover:shadow-amber-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              إعادة تعديل
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <RotateCcw className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {reworkCount}
            </span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              تعديلات مطلوبة
            </span>
          </div>
        </div>
      </div>

      {/* Main Table with Infinite Scroll */}
      <MyQueueTable
        initialRowsWithDurations={rowsWithDurations}
        initialNextCursor={nextCursor}
        totalCount={totalCount}
      />
    </div>
  );
}
