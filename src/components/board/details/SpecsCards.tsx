"use client";

/**
 * Secondary card components for DetailsSpecsTab (Pricing, Material).
 * (specs/017-press-floor-board)
 */

import React from "react";
import type { BoardCard, WorkItemFullDetail } from "~/lib/board/types";

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

export function PricingBadge({ pricing }: { readonly pricing: BoardCard["pricing"] }) {
  const isPriced = pricing === "PRICED";
  const isPending = pricing === "PENDING";
  const isDisputed = pricing === "DISPUTED";
  const cls = isPriced
    ? "bg-emerald-500/10 text-emerald-600"
    : isPending
      ? "bg-amber-500/10 text-amber-600"
      : isDisputed
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  const label = isPriced ? "تم التسعير" : isPending ? "قيد التسعير" : isDisputed ? "نزاع تسعير" : "غير مطلوب";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}

export function SpecsPricingCard({
  card,
  detail,
}: {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground">حالة التسعير والقيمة</h3>
        <PricingBadge pricing={card.pricing} />
      </div>
      {detail?.currentPrice ? (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-xl font-bold text-foreground">{detail.currentPrice.amount}</span>
          <span className="text-xs text-muted-foreground">{detail.currentPrice.currency}</span>
          <span className="text-2xs text-muted-foreground">· حدده: {detail.currentPrice.setByName} في {formatDate(detail.currentPrice.setAt)}</span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">لا يوجد سعر نهائي مسجل حتى الآن.</p>
      )}
    </div>
  );
}

export function SpecsMaterialCard({ detail }: { readonly detail: WorkItemFullDetail | null }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
      <h3 className="mb-2 text-xs font-bold text-foreground">مواصفات الخامة والتشطيب</h3>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-start justify-between border-b border-border/40 pb-2">
          <span className="text-muted-foreground">الخامة / الورق:</span>
          <span className="font-semibold text-foreground">{detail?.material ?? "غير محدد"}</span>
        </div>
        <div className="flex items-start justify-between border-b border-border/40 pb-2">
          <span className="text-muted-foreground">ملاحظات التشطيب:</span>
          <span className="font-semibold text-foreground">{detail?.finishNotes ?? "لا توجد ملاحظات خاصة"}</span>
        </div>
        {detail?.productionNotes && (
          <div className="flex items-start justify-between pt-1">
            <span className="text-muted-foreground">ملاحظات الإنتاج:</span>
            <span className="font-semibold text-foreground">{detail.productionNotes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
