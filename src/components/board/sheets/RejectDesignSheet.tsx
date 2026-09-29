"use client";

/**
 * RejectDesignSheet: collects rejection category and explanation for WAITING_REVIEW → REWORK_REQUIRED.
 * Apple-grade dialog with category pills, smooth validation, and clear feedback.
 * (FR-015, research.md R3, spec.md US3, plan.md S1)
 */

import React, { useState } from "react";
import { RotateCcw, AlertTriangle, ArrowLeft, X } from "lucide-react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

const CATEGORIES: ReadonlyArray<{ value: string; labelAr: string; desc: string }> = [
  { value: "DESIGN_ISSUE", labelAr: "مشكلة تصميمية", desc: "ألوان، خطوط، أو عناصر غير متوافقة" },
  { value: "DIMENSION_ISSUE", labelAr: "مشكلة في الأبعاد", desc: "المقاسات أو مسافات القص والقصاصات" },
  { value: "CUSTOMER_CHANGE", labelAr: "تعديل من العميل", desc: "طلب العميل تعديل النصوص أو الصور" },
  { value: "PRICING_ISSUE", labelAr: "مشكلة في التسعير", desc: "اختلاف في التكلفة أو تسعير إضافي" },
  { value: "PRODUCTION_ISSUE", labelAr: "مشكلة إنتاجية", desc: "عدم ملاءمة الملف لماكينات الطباعة" },
  { value: "MISSING_INFORMATION", labelAr: "معلومات ناقصة", desc: "نقص في تفاصيل الخامات أو التشطيب" },
  { value: "OTHER", labelAr: "أخرى", desc: "ملاحظات وتوجيهات عامة" },
];

export interface RejectDesignSheetProps {
  readonly request: SheetRequest;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

export function RejectDesignSheet({ request, onConfirm, onCancel }: RejectDesignSheetProps) {
  const [category, setCategory] = useState("");
  const [explanation, setExplanation] = useState("");
  const canSubmit = category !== "" && explanation.trim().length >= 5;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onConfirm({
        category,
        explanation: explanation.trim(),
        originDepartmentId: request.card.departmentId ?? undefined,
      });
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4.5" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3.5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/25">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-2xs font-bold">
              <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">المراجعة</span>
              <ArrowLeft className="h-3 w-3 text-muted-foreground" />
              <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                إرجاع للتصميم (تعديل)
              </span>
            </div>
            <h2 className="text-base font-bold text-foreground line-clamp-1">إرجاع للتصميم والتعديل</h2>
            <p className="text-xs text-muted-foreground line-clamp-1">
              <span className="font-mono font-bold text-foreground">#{request.card.orderNumber}</span> — {request.card.title}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="إلغاء وإغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-foreground flex items-center gap-1">
          <span>سبب الإرجاع</span>
          <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto pe-1">
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.value;
            return (
              <button
                type="button"
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex flex-col text-start rounded-xl border p-2.5 transition-all active:scale-98 ${
                  isSelected
                    ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/25 dark:bg-amber-500/15"
                    : "border-border/70 bg-card/60 hover:bg-muted/40"
                }`}
              >
                <span className={`text-xs font-bold ${isSelected ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>
                  {cat.labelAr}
                </span>
                <span className="text-2xs text-muted-foreground mt-0.5">{cat.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation Textarea */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-1" htmlFor="reject-explanation">
            <span>توضيح الملاحظات للمصمم</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-2xs text-muted-foreground">{explanation.trim().length} / 5 أحرف كحد أدنى</span>
        </div>
        <textarea
          id="reject-explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          required
          minLength={5}
          rows={3}
          placeholder="اشرح الملاحظات والتعديلات المطلوبة بدقة..."
          className="w-full rounded-xl border border-border/80 bg-background/90 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-2xs resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-border/70 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-98 shadow-2xs"
        >
          إلغاء (Esc)
        </button>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 disabled:opacity-40 disabled:pointer-events-none"
        >
          <RotateCcw className="h-4 w-4" />
          <span>إرجاع للتصميم</span>
        </button>
      </div>
    </form>
  );
}
