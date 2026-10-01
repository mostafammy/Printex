"use client";

/**
 * Specifications and production tab for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import { Package, Ruler, User as UserIcon, Building2, Calendar, Clock, ArrowRight, Sparkles } from "lucide-react";
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
    ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/50"
    : move.backward
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 hover:border-amber-500/50 dark:text-amber-400"
      : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold shadow-2xs transition-all active:scale-95 ${cls}`}
    >
      <span>{move.labelAr}</span>
      {move.kind !== "DIRECT" ? (
        <span className="text-[10px] font-medium opacity-70">
          {move.kind === "SHEET" ? "(بيانات إضافية)" : "(فتح شاشة)"}
        </span>
      ) : (
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
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
  accentColor = "text-primary bg-primary/10",
}: {
  readonly icon: React.ComponentType<{ readonly className?: string }>;
  readonly label: string;
  readonly value: string;
  readonly subtext?: string | null;
  readonly mono?: boolean;
  readonly accentColor?: string;
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border/90 hover:shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${accentColor}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="mt-3">
        <div className={`truncate font-black text-foreground ${mono ? "font-mono text-base sm:text-lg" : "text-base sm:text-lg"}`}>
          {value}
        </div>
        {subtext && (
          <div className="mt-1 flex items-center gap-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-3 w-3" />
            <span>{subtext}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getProducedSubtext(detail: WorkItemFullDetail | null): string | null {
  if (typeof detail?.producedQuantity === "number") {
    return `تم إنتاج: ${detail.producedQuantity} نسخة`;
  }
  return null;
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
  const due = formatDate(card.dueAt ?? detail?.dueDate);
  const entered = formatDate(card.enteredStationAt);

  const tiles = [
    { icon: Package, label: "الكمية المطلوبة", value: qty, subtext: qtySub, color: "text-blue-600 bg-blue-500/10 dark:text-blue-400" },
    { icon: Ruler, label: "المقاس والأبعاد", value: dimensions, mono: true, color: "text-purple-600 bg-purple-500/10 dark:text-purple-400" },
    { icon: UserIcon, label: "المسؤول المعين", value: getAssigneeName(card, detail), color: "text-amber-600 bg-amber-500/10 dark:text-amber-400" },
    { icon: Building2, label: "القسم والنوع", value: getDeptName(detail), color: "text-teal-600 bg-teal-500/10 dark:text-teal-400" },
    { icon: Calendar, label: "تاريخ التسليم المتوقع", value: due, color: "text-rose-600 bg-rose-500/10 dark:text-rose-400" },
    { icon: Clock, label: "الوقت بالمحطة", value: entered, color: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <SpecsTile key={t.label} icon={t.icon} label={t.label} value={t.value} subtext={t.subtext} mono={t.mono} accentColor={t.color} />
      ))}
    </div>
  );
}

function SpecsMovesList({ card, onExecuteMove }: { readonly card: BoardCard; readonly onExecuteMove: (move: MoveOption) => void }) {
  const controller = useBoardController();
  if (!card.moves || card.moves.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-foreground">الوجهات المتاحة لهذا الصنف:</h3>
        <span className="text-2xs text-muted-foreground">{card.moves.length} إجراء متاح</span>
      </div>
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
      <SpecsPricingCard card={card} detail={detail} onExecuteMove={onExecuteMove} />
      <SpecsMaterialCard detail={detail} />
      <SpecsMovesList card={card} onExecuteMove={onExecuteMove} />
    </div>
  );
}
