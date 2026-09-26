// Production queue — 014-production US1 (T043).
// Server Component: no "use client". Mirrors review/page.tsx's shape.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import Link from "next/link";
import {
  Printer,
  Calendar,
  Flame,
  FileCheck2,
  ArrowUpRight,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { getActor } from "~/server/auth";
import { getOperatorQueue } from "~/server/production";
import { Button } from "~/components/ui/button";
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

export default async function ProductionQueuePage() {
  const actor = await getActor();
  const rows = await getOperatorQueue(actor);

  const urgentCount = rows.filter((r) => r.priority === "URGENT").length;
  const revisedCount = rows.filter((r) => r.hasPendingFileRevision).length;

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
              <span>{rows.length} في خط الإنتاج</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة طابور ماكينات الطباعة، متابعة بطاقات العمل ومطابقة الملفات المعدلة
          </p>
        </div>
      </div>

      {/* Bento Stats Metric Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              إجمالي في الطباعة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {rows.length}
            </span>
            <span className="text-xs text-muted-foreground">أمر طباعة</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              طباعة عاجلة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {urgentCount}
            </span>
            <span className="text-xs text-muted-foreground">أولوية فورية</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              ملفات معدلة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {revisedCount}
            </span>
            <span className="text-xs text-muted-foreground">تحتاج تأكيد</span>
          </div>
        </div>
      </div>

      {/* Main Table / Empty State */}
      {rows.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-xs">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {S.productionQueueEmpty}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground leading-relaxed">
            جميع مهام وأوامر التشغيل في خط الإنتاج مكتملة حالياً.
          </p>
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground">
                  <th className="px-5 py-4 text-start">{S.productionQueueTableHeaderCustomer}</th>
                  <th className="px-5 py-4 text-start">{S.productionQueueTableHeaderProduct}</th>
                  <th className="px-5 py-4 text-start">{S.productionQueueTableHeaderEnteredQueue}</th>
                  <th className="px-5 py-4 text-start">{S.productionQueueTableHeaderActions}</th>
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

                    {/* Entered Queue & Badges */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.priority === "URGENT" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-2xs">
                            <Flame className="h-3 w-3" />
                            <span>{S.badgeUrgent}</span>
                          </span>
                        )}
                        {row.hasPendingFileRevision && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 shadow-2xs">
                            <FileCheck2 className="h-3 w-3" />
                            <span>{S.badgeRevisedFile}</span>
                          </span>
                        )}
                        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{formatDate(row.enteredQueueAt)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <Button
                        variant="default"
                        size="sm"
                        render={<Link href={`/production/${row.workItemId}`} />}
                      >
                        <span>{S.productionQueueOpenButton}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
