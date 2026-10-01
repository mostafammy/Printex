import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt, Kanban, Calculator, WalletCards } from "lucide-react";
import { getActor } from "~/server/auth";
import { getAccountantOrders } from "~/server/accounting";
import { AccountantOrdersView } from "~/components/accounting/AccountantOrdersView";
import { Button } from "~/components/ui/button";

interface PageProps {
  readonly searchParams: Promise<{
    day?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function AccountantOrdersPage({ searchParams }: PageProps) {
  const actor = await getActor();
  if (!actor.roles.includes("ACCOUNTING") && !actor.roles.includes("ADMIN_OWNER")) {
    redirect("/board");
  }
  const params = await searchParams;

  const result = await getAccountantOrders(actor, {
    day: params.day,
    status: (params.status as "ALL" | "PENDING" | "APPROVED" | "COMPLETED") || "ALL",
    search: params.search,
  });

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-6 sm:p-8 shadow-xs">
        <div className="pointer-events-none absolute -top-8 -end-8 h-48 w-48 rounded-full bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
              <Receipt className="h-8 w-8" />
              <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  سجل وطلبات المحاسب المالي
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <WalletCards className="h-3 w-3" />
                  <span>تصفية يومية ومراجعة مالية</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                كافة الطلبات الواردة للمحاسب لاعتماد التسعير والإنتاج — تبقى الطلبات محفوظة ومفهرسة هنا حتى بعد اعتمادها ونقلها للطباعة
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="default"
              size="default"
              render={<Link href="/board?slice=accounting" />}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-xs"
            >
              <Kanban className="h-4 w-4" />
              <span>لوحة تسعير المحاسب (Kanban)</span>
            </Button>
            <Button
              variant="outline"
              size="default"
              render={<Link href="/pricing" />}
              className="border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/5"
            >
              <Calculator className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>قائمة انتظار التسعير</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Table / View Component */}
      <AccountantOrdersView
        initialOrders={result.orders}
        metrics={result.metrics}
        selectedDay={result.selectedDay}
        dayLabel={result.dayLabel}
      />
    </div>
  );
}
