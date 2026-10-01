import Link from "next/link";
import { redirect } from "next/navigation";
import { Printer, Kanban } from "lucide-react";
import { getActor } from "~/server/auth";
import { getPrinterProductionQueue } from "~/server/production";
import { PrinterQueueView } from "~/components/production/PrinterQueueView";
import { Button } from "~/components/ui/button";

export default async function ProductionQueuePage() {
  const actor = await getActor();
  if (!actor.roles.includes("PRODUCTION_OPERATOR") && !actor.roles.includes("ADMIN_OWNER")) {
    redirect("/board");
  }
  const result = await getPrinterProductionQueue(actor);

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/[0.06] via-card to-card p-6 sm:p-8 shadow-xs">
        <div className="pointer-events-none absolute -top-8 -end-8 h-48 w-48 rounded-full bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-transparent blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <Printer className="h-8 w-8" />
              <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  صالة الإنتاج وأقسام الطباعة
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                  <span>أوامر التشغيل المعتمدة</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                استلام أوامر الطباعة المعتمدة من المحاسب المالي مقسمة حسب نوع الماكينة، وبدء التشغيل، والإتمام التلقائي للتسليم
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="default"
              size="default"
              render={<Link href="/board?slice=production" />}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xs"
            >
              <Kanban className="h-4 w-4" />
              <span>لوحة الإنتاج (Kanban)</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main 4-Tab Printer View */}
      <PrinterQueueView initialRows={result.rows} stats={result.stats} />
    </div>
  );
}
