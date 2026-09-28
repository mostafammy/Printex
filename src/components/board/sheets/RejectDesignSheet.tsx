"use client";

/**
 * RejectDesignSheet: collects rejection category and explanation for WAITING_REVIEW → REWORK_REQUIRED.
 * (FR-015, research.md R3, spec.md US3, plan.md S1)
 */

import { useState } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

const CATEGORIES: ReadonlyArray<{ value: string; labelAr: string }> = [
  { value: "DESIGN_ISSUE", labelAr: "مشكلة تصميمية" },
  { value: "DIMENSION_ISSUE", labelAr: "مشكلة في الأبعاد" },
  { value: "CUSTOMER_CHANGE", labelAr: "تعديل من العميل" },
  { value: "PRICING_ISSUE", labelAr: "مشكلة في التسعير" },
  { value: "ACCOUNTING_ISSUE", labelAr: "مشكلة محاسبية" },
  { value: "PRODUCTION_ISSUE", labelAr: "مشكلة إنتاجية" },
  { value: "MISSING_INFORMATION", labelAr: "معلومات ناقصة" },
  { value: "OTHER", labelAr: "أخرى" },
];

export interface RejectDesignSheetProps {
  readonly request: SheetRequest;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function CategorySelect({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor="reject-category">
        سبب الإرجاع <span className="text-red-500">*</span>
      </label>
      <select
        id="reject-category"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
      >
        <option value="">اختر السبب...</option>
        {CATEGORIES.map((cat) => (
          <option key={cat.value} value={cat.value}>{cat.labelAr}</option>
        ))}
      </select>
    </div>
  );
}

function ExplanationInput({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor="reject-explanation">
        توضيح <span className="text-red-500">*</span>
      </label>
      <textarea
        id="reject-explanation"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={5}
        rows={3}
        placeholder="اشرح سبب الإرجاع بالتفصيل..."
        className="resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
      />
    </div>
  );
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4" dir="rtl">
      <h2 className="text-base font-semibold">إرجاع للتصميم — {request.card.title}</h2>
      <CategorySelect value={category} onChange={setCategory} />
      <ExplanationInput value={explanation} onChange={setExplanation} />
      <div className="flex justify-start gap-2 pt-1">
        <button type="submit" disabled={!canSubmit} className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-40">
          إرجاع للتصميم
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          إلغاء
        </button>
      </div>
    </form>
  );
}
