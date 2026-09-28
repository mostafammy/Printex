// Production queue — 014-production US1 (T043).
// Server Component: loads first page and stats, delegates infinite scroll table to client.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { Printer, Layers, Flame, FileCheck2 } from "lucide-react";
import { getActor } from "~/server/auth";
import { getOperatorQueuePage, getOperatorQueueStats } from "~/server/production";
import { ProductionQueueTable } from "./ProductionQueueTable";
import ar from "~/messages/ar.json";

const S = ar.ui;

export default async function ProductionQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const params = await searchParams;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);

  const [{ rows, nextCursor }, { totalCount, urgentCount, revisedCount }] = await Promise.all([
    getOperatorQueuePage(actor, { page }),
    getOperatorQueueStats(actor),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {S.productionQueuePageTitle}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
              <Printer className="h-3 w-3" />
              <span>{totalCount} في خط الإنتاج</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة طابور ماكينات الطباعة، متابعة بطاقات العمل ومطابقة الملفات المعدلة
          </p>
        </div>
      </div>

      {/* Bento Stats Metric Row */}
      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card shadow-xs group p-5.5 bg-gradient-to-br from-blue-500/10 via-card to-card border-blue-500/25 hover:border-blue-500/45 hover:shadow-blue-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              إجمالي في الطباعة
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {totalCount}
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              أمر تشغيل
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card shadow-xs group p-5.5 bg-gradient-to-br from-rose-500/10 via-card to-card border-rose-500/25 hover:border-rose-500/45 hover:shadow-rose-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                طباعة عاجلة
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
              أولوية فورية
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card shadow-xs group p-5.5 bg-gradient-to-br from-amber-500/10 via-card to-card border-amber-500/25 hover:border-amber-500/45 hover:shadow-amber-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              ملفات معدلة
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {revisedCount}
            </span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              تحتاج تأكيد
            </span>
          </div>
        </div>
      </div>

      {/* Main Table with Infinite Scroll */}
      <ProductionQueueTable
        initialRows={rows}
        initialNextCursor={nextCursor}
        totalCount={totalCount}
      />
    </div>
  );
}
