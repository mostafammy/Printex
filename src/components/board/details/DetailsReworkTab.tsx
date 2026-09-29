"use client";

/**
 * Rework and returns history tab for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import type { DetailReturn, WorkItemFullDetail } from "~/lib/board/detailTypes";

export interface DetailsReworkTabProps {
  readonly detail: WorkItemFullDetail | null;
}

const CATEGORY_MAP: Record<string, string> = {
  DESIGN_ISSUE: "مشكلة في التصميم",
  DIMENSION_ISSUE: "مشكلة في المقاسات",
  CUSTOMER_CHANGE: "طلب تعديل من العميل",
  PRICING_ISSUE: "مشكلة في التسعير",
  ACCOUNTING_ISSUE: "مشكلة حسابية",
  PRODUCTION_ISSUE: "مشكلة إنتاجية",
  MISSING_INFORMATION: "معلومات ناقصة",
  OTHER: "سبب آخر",
};

function getCategoryLabel(category: string): string {
  return CATEGORY_MAP[category] ?? category;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ReturnItem({ ret }: { readonly ret: DetailReturn }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs shadow-2xs">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span>من: {ret.originDepartmentName}</span>
          <span className="rounded-sm bg-amber-500/20 px-1.5 py-0.5 text-2xs">
            {getCategoryLabel(ret.category)}
          </span>
        </div>
        <span className="text-2xs text-muted-foreground">{formatDate(ret.createdAt)}</span>
      </div>

      <p className="font-medium text-foreground">{ret.explanation}</p>
      {ret.note && <p className="text-2xs text-muted-foreground">ملاحظة: {ret.note}</p>}

      <div className="flex items-center justify-between text-2xs text-muted-foreground">
        <span>سجل بواسطة: {ret.raisedByName}</span>
        <span>أُسند إلى: {ret.assignedToName}</span>
      </div>
    </div>
  );
}

export function DetailsReworkTab({ detail }: DetailsReworkTabProps) {
  const returns = detail?.returns ?? [];

  if (returns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
        لا توجد طلبات تعديل أو إرجاع سابقة لهذا الصنف
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {returns.map((ret) => (
        <ReturnItem key={ret.id} ret={ret} />
      ))}
    </div>
  );
}
