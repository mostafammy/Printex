"use client";

/**
 * Specifications and production tab for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import { Package, Ruler, User as UserIcon, Building2, Calendar, Clock } from "lucide-react";
import type { BoardCard, MoveOption, WorkItemFullDetail } from "~/lib/board/types";
import { useBoardController } from "../hooks/useBoardController";
import { SpecsPricingCard, SpecsMaterialCard } from "./SpecsCards";

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

function SpecsTile({
  icon: Icon,
  label,
  value,
  subtext,
  mono,
}: {
  readonly icon: React.ComponentType<{ readonly className?: string }>;
  readonly label: string;
  readonly value: string;
  readonly subtext?: string | null;
  readonly mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className={`mt-1 truncate font-bold text-foreground ${mono ? "font-mono text-sm" : "text-sm"}`}>
        {value}
      </div>
      {subtext && <div className="mt-0.5 text-2xs text-emerald-600">{subtext}</div>}
    </div>
  );
}

function getAssigneeName(card: BoardCard, detail: WorkItemFullDetail | null): string {
  if (card.assignee?.name) return card.assignee.name;
  if (detail?.assignee?.name) return detail.assignee.name;
  return "غير معيّن";
}

function getDeptName(detail: WorkItemFullDetail | null): string {
  if (detail?.department?.name) return detail.department.name;
  if (detail?.productType?.name) return detail.productType.name;
  return "عام";
}

function getProducedSubtext(detail: WorkItemFullDetail | null): string | null {
  if (typeof detail?.producedQuantity === "number") {
    return `تم إنتاج: ${detail.producedQuantity} نسخة`;
  }
  return null;
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
  const qtySub = getProducedSubtext(detail);
  const qty = card.quantity ? `${card.quantity} نسخة` : "—";
  const assignee = getAssigneeName(card, detail);
  const dept = getDeptName(detail);
  const due = formatDate(card.dueAt ?? detail?.dueDate);
  const entered = formatDate(card.enteredStationAt);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <SpecsTile icon={Package} label="الكمية المطلوبة" value={qty} subtext={qtySub} />
      <SpecsTile icon={Ruler} label="المقاس والأبعاد" value={dimensions} mono />
      <SpecsTile icon={UserIcon} label="المسؤول المعين" value={assignee} />
      <SpecsTile icon={Building2} label="القسم والنوع" value={dept} />
      <SpecsTile icon={Calendar} label="تاريخ التسليم المتوقع" value={due} />
      <SpecsTile icon={Clock} label="الوقت بالمحطة" value={entered} />
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
