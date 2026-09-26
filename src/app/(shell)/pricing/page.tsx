import Link from "next/link";
import { Tag, Sparkles, SlidersHorizontal, Flame, Clock } from "lucide-react";
import { getActor } from "~/server/auth";
import { getPricingQueue } from "~/server/pricing";
import { PricingQueue } from "~/components/pricing/pricing-queue";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

export default async function PricingQueuePage() {
  const actor = await getActor();
  const result = await getPricingQueue(actor);

  const urgentCount = result.rows.filter((r) => r.priority === "URGENT").length;

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* ── Hero Pricing Header ── */}
      <div className="apple-bento-card relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-amber-500/[0.06] via-card to-card border-amber-500/25">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 apple-glow-amber">
              <Tag className="h-8 w-8" />
              <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {ar.ui.pricingQueuePageTitle}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-3 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <Sparkles className="h-3 w-3" />
                  <span>محرك التسعير التجاري</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                مراجعة واعتماد تسعير الأصناف المخصصة وقوائم الأسعار وسياسات التسعير
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="default"
              render={<Link href="/pricing/price-lists" />}
              className="border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/5"
            >
              <SlidersHorizontal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>إدارة قوائم الأسعار والسياسات</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Bento Stats Row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="apple-bento-card p-5 bg-gradient-to-br from-amber-500/[0.04] via-card to-card border-amber-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">معلق للتسعير</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Tag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {result.rows.length}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">صنف ينتظر التسعير</span>
          </div>
        </div>

        <div className="apple-bento-card p-5 bg-gradient-to-br from-rose-500/[0.04] via-card to-card border-rose-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">طلبات عاجلة</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
              {urgentCount}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">أولوية قصوى</span>
          </div>
        </div>

        <div className="apple-bento-card p-5 bg-gradient-to-br from-blue-500/[0.04] via-card to-card border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">حالة المحرك</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-base font-bold text-foreground">نشط ومحدث</span>
            <span className="text-2xs text-muted-foreground">· استجابة فورية</span>
          </div>
        </div>
      </div>

      {/* ── Main Queue Table ── */}
      <PricingQueue rows={result.rows} />
    </div>
  );
}