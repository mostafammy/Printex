"use client";

import { useEffect, useState } from "react";
import type { CustomerPricingRuleRow } from "~/server/pricing";

type SpecialPricingTabProps = {
  customerId: string;
};

const KIND_LABELS: Record<string, string> = {
  FIXED: "سعر ثابت",
  PERCENT_DISCOUNT: "خصم نسبي",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "نشط",
  RETIRED: "متوقف",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function RuleRow({ rule }: { rule: CustomerPricingRuleRow }) {
  const isActive = rule.status === "ACTIVE";
  return (
    <tr className={isActive ? "" : "opacity-60"}>
      <td className="px-3 py-2 text-sm">{rule.productType?.name ?? rule.productTypeId}</td>
      <td className="px-3 py-2 text-sm">{KIND_LABELS[rule.kind] ?? rule.kind}</td>
      <td className="px-3 py-2 text-sm">
        {rule.kind === "FIXED"
          ? `${rule.fixedPrice} ج.م`
          : `${rule.discountPercent}%`}
      </td>
      <td className="px-3 py-2 text-sm">{formatDate(rule.effectiveFrom)}</td>
      <td className="px-3 py-2 text-sm">{rule.effectiveTo ? formatDate(rule.effectiveTo) : "—"}</td>
      <td className="px-3 py-2 text-sm">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
            isActive
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {STATUS_LABELS[rule.status] ?? rule.status}
        </span>
      </td>
    </tr>
  );
}

export function SpecialPricingTab({ customerId }: SpecialPricingTabProps) {
  const [rules, setRules] = useState<CustomerPricingRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/customers/${customerId}/pricing-rules`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as CustomerPricingRuleRow[];
        if (!cancelled) setRules(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "خطأ غير معروف");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" dir="rtl">
        جاري تحميل الأسعار الخاصة…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-destructive" dir="rtl">
        فشل تحميل الأسعار الخاصة: {error}
      </div>
    );
  }

  const activeRules = rules.filter((r) => r.status === "ACTIVE");
  const retiredRules = rules.filter((r) => r.status !== "ACTIVE");

  return (
    <section dir="rtl" className="space-y-4">
      <h3 className="text-lg font-medium">الأسعار الخاصة</h3>

      {rules.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          لا توجد قواعد أسعار خاصة لهذا العميل.
        </p>
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="px-3 py-2 font-medium">نوع المنتج</th>
                <th className="px-3 py-2 font-medium">النوع</th>
                <th className="px-3 py-2 font-medium">القيمة</th>
                <th className="px-3 py-2 font-medium">ساري من</th>
                <th className="px-3 py-2 font-medium">ساري حتى</th>
                <th className="px-3 py-2 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {activeRules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
              {retiredRules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </tbody>
          </table>

          <p className="text-xs text-muted-foreground">
            {activeRules.length} نشط · {retiredRules.length} متوقف
          </p>
        </>
      )}
    </section>
  );
}
