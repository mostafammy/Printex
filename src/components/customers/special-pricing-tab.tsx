"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Percent, AlertCircle } from "lucide-react";
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
    <tr className={`transition-colors hover:bg-muted/30 ${isActive ? "" : "opacity-60"}`}>
      <td className="px-3.5 py-3 text-xs font-semibold text-foreground">
        {rule.productType?.name ?? rule.productTypeId}
      </td>
      <td className="px-3.5 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium">
          {rule.kind === "PERCENT_DISCOUNT" && <Percent className="h-3 w-3 text-primary" />}
          <span>{KIND_LABELS[rule.kind] ?? rule.kind}</span>
        </span>
      </td>
      <td className="px-3.5 py-3 text-xs font-bold text-foreground">
        {rule.kind === "FIXED"
          ? `${rule.fixedPrice} ج.م`
          : `${rule.discountPercent}%`}
      </td>
      <td className="px-3.5 py-3 text-xs text-muted-foreground">{formatDate(rule.effectiveFrom)}</td>
      <td className="px-3.5 py-3 text-xs text-muted-foreground">
        {rule.effectiveTo ? formatDate(rule.effectiveTo) : "—"}
      </td>
      <td className="px-3.5 py-3 text-xs">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
            isActive
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          <span>{STATUS_LABELS[rule.status] ?? rule.status}</span>
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
        const data: unknown = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid pricing response");
        const parsedRules = data as CustomerPricingRuleRow[];
        if (!cancelled) setRules(parsedRules);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "خطأ غير معروف");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground" dir="rtl">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>جاري تحميل الأسعار الخاصة…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive" dir="rtl">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>فشل تحميل الأسعار الخاصة: {error}</span>
      </div>
    );
  }

  const activeRules = rules.filter((r) => r.status === "ACTIVE");
  const retiredRules = rules.filter((r) => r.status !== "ACTIVE");

  return (
    <section dir="rtl" className="flex flex-col gap-3">
      {rules.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          لا توجد قواعد أسعار خاصة مسجلة لهذا العميل.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
          <table className="w-full border-collapse text-start text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-semibold">
                <th className="px-3.5 py-2.5 text-start">نوع المنتج</th>
                <th className="px-3.5 py-2.5 text-start">النوع</th>
                <th className="px-3.5 py-2.5 text-start">القيمة</th>
                <th className="px-3.5 py-2.5 text-start">ساري من</th>
                <th className="px-3.5 py-2.5 text-start">ساري حتى</th>
                <th className="px-3.5 py-2.5 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {activeRules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
              {retiredRules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rules.length > 0 && (
        <div className="flex items-center justify-between text-2xs text-muted-foreground pt-1">
          <span>{activeRules.length} نشط · {retiredRules.length} متوقف</span>
        </div>
      )}
    </section>
  );
}
