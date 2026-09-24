import Link from "next/link";
import type { PricingQueueRow } from "~/server/pricing";

export function PricingQueue({ rows }: { readonly rows: readonly PricingQueueRow[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground">لا توجد أصناف معلقة للتسعير حالياً.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-start font-medium">المنتج</th>
            <th className="px-4 py-3 text-start font-medium">الأولوية</th>
            <th className="px-4 py-3 text-start font-medium">مدة الانتظار</th>
            <th className="px-4 py-3 text-start font-medium">الإجراء</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.workItemId} className="bg-card hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{row.productName ?? "بدون نوع منتج"}</td>
              <td className="px-4 py-3">{row.priority === "URGENT" ? "عاجل" : "عادي"}</td>
              <td className="px-4 py-3" dir="ltr">{row.ageLabel}</td>
              <td className="px-4 py-3">
                <Link href={`/orders/${row.workItemId}`} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                  فتح الصنف
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}