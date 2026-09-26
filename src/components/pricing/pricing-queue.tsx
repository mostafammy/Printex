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
      <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-xs">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          لا توجد أصناف معلقة للتسعير حالياً
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground leading-relaxed">
          تم احتساب واعتماد كافة الأسعار للمواصفات الحالية بنجاح.
        </p>
      </div>
    );
  }

  return (
    <div className="apple-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground">
              <th className="px-5 py-4 text-start">العميل والطلب</th>
              <th className="px-5 py-4 text-start">المنتج والمواصفات</th>
              <th className="px-5 py-4 text-start">الأولوية</th>
              <th className="px-5 py-4 text-start">مدة الانتظار</th>
              <th className="px-5 py-4 text-start">الإجراء</th>
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
                  <div className="font-semibold text-foreground">
                    {row.customerName}
                  </div>
                  <div className="mt-0.5 inline-flex items-center font-mono text-xs text-muted-foreground">
                    #{row.orderNumber}
                  </div>
                </td>

                {/* Product */}
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    <span>{row.productName ?? "بدون نوع منتج"}</span>
                  </span>
                </td>

                {/* Priority */}
                <td className="px-5 py-4">
                  {row.priority === "URGENT" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-2xs">
                      <Flame className="h-3 w-3" />
                      <span>عاجل</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                      عادي
                    </span>
                  )}
                </td>

                {/* Age */}
                <td className="px-5 py-4">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 font-mono text-xs font-medium text-muted-foreground"
                    dir="ltr"
                  >
                    <Clock className="h-3 w-3" />
                    <span>{row.ageLabel}</span>
                  </div>
                </td>

                {/* Action */}
                <td className="px-5 py-4">
                  <Button
                    variant="default"
                    size="sm"
                    render={<Link href={`/orders/${row.orderId}`} />}
                  >
                    <span>فتح الصنف</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}