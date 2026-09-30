"use client";

/**
 * World-class Apple-grade Rework and returns history tab for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import { AlertTriangle, Clock, User, ArrowLeft, Tag } from "lucide-react";
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

function ReturnHeader({ ret }: { readonly ret: DetailReturn }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <span className="font-bold text-amber-900 dark:text-amber-200">
          من: {ret.originDepartmentName}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-2xs font-black text-amber-800 dark:text-amber-300">
          <Tag className="h-3 w-3" />
          {getCategoryLabel(ret.category)}
        </span>
      </div>

      <span className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded-md border border-border/40">
        <Clock className="h-3 w-3" />
        {formatDate(ret.createdAt)}
      </span>
    </div>
  );
}

function ReturnItem({ ret }: { readonly ret: DetailReturn }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 text-xs shadow-xs backdrop-blur-sm">
      <ReturnHeader ret={ret} />

      <div className="mt-3">
        <p className="font-bold text-foreground text-sm leading-relaxed">{ret.explanation}</p>
        {ret.note && (
          <div className="mt-2 rounded-xl bg-background/60 p-2.5 border border-border/40 text-2xs text-muted-foreground leading-relaxed">
            <span className="font-bold text-foreground/80">ملاحظة:</span> {ret.note}
          </div>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/15 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <User className="h-3 w-3 text-muted-foreground/70" />
          سجل بواسطة: <strong className="text-foreground/90">{ret.raisedByName}</strong>
        </span>
        <span className="inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3 text-muted-foreground/70" />
          أُسند إلى: <strong className="text-foreground/90">{ret.assignedToName}</strong>
        </span>
      </div>
    </div>
  );
}

export function DetailsReworkTab({ detail }: DetailsReworkTabProps) {
  const returns = detail?.returns ?? [];

  if (returns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 py-12 text-center text-xs text-muted-foreground">
        لا توجد طلبات تعديل أو إرجاع سابقة لهذا الصنف
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {returns.map((ret) => (
        <ReturnItem key={ret.id} ret={ret} />
      ))}
    </div>
  );
}
