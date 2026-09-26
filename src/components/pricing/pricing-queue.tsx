import Link from "next/link";
import { Tag, Clock, Flame, ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { PricingQueueRow } from "~/server/pricing";
import { Button } from "~/components/ui/button";

export function PricingQueue({
  rows,
}: {
  readonly rows: readonly PricingQueueRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="apple-bento-card flex flex-col items-center justify-center p-14 text-center border-amber-500/20 bg-gradient-to-br from-amber-500/[0.02] via-card to-card">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-xs apple-glow-amber">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          لا توجد أصناف معلقة للتسعير حالياً
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
          تم احتساب واعتماد كافة الأسعار للمواصفات الحالية بنجاح وفق السياسات المعتمدة.
        </p>
      </div>
    );
  }

  return (
    <div className="apple-bento-card overflow-hidden border-border/70">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-xs font-bold text-muted-foreground">
              <th className="px-6 py-4 text-start">العميل والطلب</th>
              <th className="px-6 py-4 text-start">المنتج والمواصفات</th>
              <th className="px-6 py-4 text-start">الأولوية</th>
              <th className="px-6 py-4 text-start">مدة الانتظار</th>
              <th className="px-6 py-4 text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const initials = (row.customerName || "ع")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join("");

              return (
                <tr
                  key={row.workItemId}
                  className="apple-interactive-row group transition-colors duration-150"
                >
                  {/* Customer */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-xs shadow-xs">
                        {initials}
                      </div>
                      <div>
                        <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {row.customerName}
                        </div>
                        <div className="mt-0.5 inline-flex items-center font-mono text-xs text-muted-foreground">
                          الطلب #{row.orderNumber}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-muted/30 px-3 py-1 text-xs font-semibold text-foreground">
                      <Tag className="h-3.5 w-3.5 text-amber-500" />
                      <span>{row.productName ?? "صنف مخصص"}</span>
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="px-6 py-4">
                    {row.priority === "URGENT" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 apple-glow-rose">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                        </span>
                        <Flame className="h-3.5 w-3.5" />
                        <span>عاجل</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        عادي
                      </span>
                    )}
                  </td>

                  {/* Age */}
                  <td className="px-6 py-4">
                    <div
                      className="inline-flex items-center gap-1.5 rounded-xl bg-muted/40 border border-border/50 px-3 py-1 font-mono text-xs font-semibold text-muted-foreground"
                      dir="ltr"
                    >
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span>{row.ageLabel}</span>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 text-center">
                    <Button
                      variant="default"
                      size="sm"
                      render={<Link href={`/orders/${row.orderId}`} />}
                      className="shadow-sm shadow-primary/20"
                    >
                      <span>تسعير الصنف</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}