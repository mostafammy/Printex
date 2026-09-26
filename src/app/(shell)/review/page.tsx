// Review queue — 013-review-rework US1/US5 (T039).
// Server Component: no "use client". Mirrors my-queue/page.tsx's shape.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import Link from "next/link";
import {
  CheckCircle2,
  Calendar,
  RotateCcw,
  Flame,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { getActor } from "~/server/auth";
import { getReviewQueuePage, getReviewQueueStats } from "~/server/review";
import { DEFAULT_PAGE_SIZE } from "~/server/pagination";
import { Button } from "~/components/ui/button";
import { PaginationBar } from "~/components/pagination-bar";
import ar from "~/messages/ar.json";

const S = ar.ui;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const params = await searchParams;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);

  const [{ rows, nextCursor }, { totalCount, urgentCount, reworkCount }] = await Promise.all([
    getReviewQueuePage(actor, { page }),
    getReviewQueueStats(actor),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {S.reviewQueuePageTitle}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>صفحة {page}</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            مراجعة بروفات وتصاميم الطباعة، التدقيق الفني، والاعتماد أو طلب التعديلات
          </p>
        </div>
      </div>

      {/* Bento Stats Metric Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              إجمالي للمراجعة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {totalCount}
            </span>
            <span className="text-xs text-muted-foreground">بروفة معلقة</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              مراجعات عاجلة
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

        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              معاد مراجعته
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {reworkCount}
            </span>
            <span className="text-xs text-muted-foreground">إعادة تدقيق</span>
          </div>
        </div>
      </div>

      {/* Main Table / Empty State */}
      {rows.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 border border-purple-500/20 shadow-xs">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {S.reviewQueueEmpty}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground leading-relaxed">
            تمت مراجعة واعتماد جميع البروفات والتصاميم الحالية بنجاح.
          </p>
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground">
                  <th className="px-5 py-4 text-start">{S.reviewQueueTableHeaderCustomer}</th>
                  <th className="px-5 py-4 text-start">{S.reviewQueueTableHeaderProduct}</th>
                  <th className="px-5 py-4 text-start">{S.reviewQueueTableHeaderEnteredQueue}</th>
                  <th className="px-5 py-4 text-start">{S.reviewQueueTableHeaderRework}</th>
                  <th className="px-5 py-4 text-start">{S.reviewQueueTableHeaderActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <tr
                    key={row.workItemId}
                    className="group transition-colors duration-150 hover:bg-muted/40"
                  >
                    {/* Customer */}
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

                    {/* Product */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                        {row.productTypeName ?? S.myQueueNoProductType}
                      </span>
                    </td>

                    {/* Entered Queue & Priority */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.priority === "URGENT" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-2xs">
                            <Flame className="h-3 w-3" />
                            <span>{S.badgeUrgent}</span>
                          </span>
                        )}
                        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{formatDate(row.enteredQueueAt)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Rework */}
                    <td className="px-5 py-4">
                      {row.isRework ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 shadow-2xs">
                          <RotateCcw className="h-3 w-3" />
                          <span>
                            {S.reworkCountBadgePrefix} {row.reworkCount} {S.reworkCountBadgeSuffix}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <Button
                        variant="default"
                        size="sm"
                        render={<Link href={`/review/${row.workItemId}`} />}
                      >
                        <span>{S.reviewQueueOpenButton}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalCount > DEFAULT_PAGE_SIZE && (
            <div className="border-t border-border/70 p-4">
              <PaginationBar
                basePath="/review"
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
