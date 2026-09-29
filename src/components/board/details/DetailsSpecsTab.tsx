"use client";

/**
 * Specifications and production tab for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import { Package, Ruler, User as UserIcon, Building2, Calendar, Clock } from "lucide-react";
import type { BoardCard, MoveOption, WorkItemFullDetail } from "~/lib/board/types";
import { useBoardController } from "../hooks/useBoardController";

export interface DetailsSpecsTabProps {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly onExecuteMove: (move: MoveOption) => void;
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

function PricingBadge({ pricing }: { readonly pricing: BoardCard["pricing"] }) {
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

function MoveButton({ move, onClick }: { readonly move: MoveOption; readonly onClick: () => void }) {
  const cls = move.destructive
    ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
    : move.backward
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
      : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors ${cls}`}
    >
      <span>{move.labelAr}</span>
      {move.kind !== "DIRECT" && (
        <span className="text-2xs opacity-75">{move.kind === "SHEET" ? "(بيانات إضافية)" : "(فتح شاشة)"}</span>
      )}
    </button>
  );
}

function SpecsInfoGrid({
  card,
  detail,
  dimensions,
}: {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly dimensions: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" /><span>الكمية المطلوبة</span></div>
        <div className="mt-1 text-base font-bold text-foreground">{card.quantity ? `${card.quantity} نسخة` : "—"}</div>
        {detail?.producedQuantity !== null && detail?.producedQuantity !== undefined && (
          <div className="mt-0.5 text-2xs text-emerald-600">تم إنتاج: {detail.producedQuantity} نسخة</div>
        )}
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Ruler className="h-3.5 w-3.5" /><span>المقاس والأبعاد</span></div>
        <div className="mt-1 font-mono text-sm font-bold text-foreground">{dimensions}</div>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><UserIcon className="h-3.5 w-3.5" /><span>المسؤول المعين</span></div>
        <div className="mt-1 truncate text-sm font-bold text-foreground">{card.assignee?.name ?? detail?.assignee?.name ?? "غير معيّن"}</div>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" /><span>القسم والنوع</span></div>
        <div className="mt-1 truncate text-sm font-bold text-foreground">{detail?.department?.name ?? detail?.productType?.name ?? "عام"}</div>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /><span>تاريخ التسليم المتوقع</span></div>
        <div className="mt-1 text-xs font-bold text-foreground">{formatDate(card.dueAt ?? detail?.dueDate)}</div>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /><span>الوقت بالمحطة</span></div>
        <div className="mt-1 text-xs font-bold text-foreground">{formatDate(card.enteredStationAt)}</div>
      </div>
    </div>
  );
}

function SpecsPricingCard({
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

function SpecsMaterialCard({ detail }: { readonly detail: WorkItemFullDetail | null }) {
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

function SpecsMovesList({
  card,
  onExecuteMove,
}: {
  readonly card: BoardCard;
  readonly onExecuteMove: (move: MoveOption) => void;
}) {
  const controller = useBoardController();
  if (!card.moves || card.moves.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
      <h3 className="mb-2 text-xs font-bold text-foreground">الوجهات المتاحة لهذا الصنف:</h3>
      <div className="flex flex-wrap gap-2">
        {card.moves.map((move) => (
          <MoveButton
            key={move.edgeId}
            move={move}
            onClick={() => {
              onExecuteMove(move);
              void controller.executeMove(card, move);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function DetailsSpecsTab({ card, detail, onExecuteMove }: DetailsSpecsTabProps) {
  const dimensions = detail?.widthValue && detail?.heightValue
    ? `${detail.widthValue} × ${detail.heightValue} ${detail.dimensionUnit ?? "سم"}`
    : "غير محدد";

  return (
    <div className="flex flex-col gap-4">
      <SpecsInfoGrid card={card} detail={detail} dimensions={dimensions} />
      <SpecsPricingCard card={card} detail={detail} />
      <SpecsMaterialCard detail={detail} />
      <SpecsMovesList card={card} onExecuteMove={onExecuteMove} />
    </div>
  );
}
