"use client";

/**
 * Secondary card components for DetailsSpecsTab (Pricing, Material).
 * (specs/017-press-floor-board)
 */

import React from "react";
import { BadgeCheck, Clock, Coins, Sparkles, AlertCircle, FileText, Layers, Scissors } from "lucide-react";
import type { BoardCard, MoveOption, WorkItemFullDetail } from "~/lib/board/types";
import { useBoardController } from "../hooks/useBoardController";

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

const BADGE_CONFIG: Record<string, { cls: string; label: string; Icon: typeof BadgeCheck }> = {
  PRICED: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", label: "تم التسعير", Icon: BadgeCheck },
  PENDING: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "قيد التسعير", Icon: Clock },
  DISPUTED: { cls: "border-destructive/30 bg-destructive/10 text-destructive", label: "نزاع تسعير", Icon: AlertCircle },
};

export function PricingBadge({ pricing }: { readonly pricing: BoardCard["pricing"] }) {
  const conf = BADGE_CONFIG[pricing] ?? { cls: "border-border/60 bg-muted/60 text-muted-foreground", label: "غير مطلوب", Icon: Clock };
  const { cls, label, Icon } = conf;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-2xs ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  );
}

function PriceValue({ price }: { readonly price: NonNullable<WorkItemFullDetail["currentPrice"]> }) {
  return (
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-black text-foreground tracking-tight">{price.amount}</span>
        <span className="font-bold text-sm text-primary">{price.currency}</span>
      </div>
      <div className="rounded-xl border border-border/50 bg-background/80 px-3 py-1.5 text-2xs text-muted-foreground backdrop-blur-xs">
        بواسطة: <span className="font-bold text-foreground/90">{price.setByName}</span> في {formatDate(price.setAt)}
      </div>
    </div>
  );
}

interface PricingActionButtonsProps {
  readonly card: BoardCard;
  readonly hasCurrentPrice: boolean;
  readonly pricingMove?: MoveOption;
  readonly onExecuteMove?: (move: MoveOption) => void;
}

function buildPricingMove(pricingMove: MoveOption | undefined, labelAr: string): MoveOption {
  return (
    pricingMove ?? {
      edgeId: "WAITING_PRICING->READY_FOR_PRODUCTION",
      to: "READY_FOR_PRODUCTION",
      kind: "SHEET",
      sheet: "quick-price",
      screenHref: null,
      labelAr,
      destructive: false,
      backward: false,
      groupable: false,
    }
  );
}

function PricingActionButtons({
  card,
  hasCurrentPrice,
  pricingMove,
  onExecuteMove,
}: PricingActionButtonsProps) {
  const controller = useBoardController();
  const trigger = (label: string) => {
    const move = buildPricingMove(pricingMove, label);
    onExecuteMove?.(move);
    void controller.executeMove(card, move);
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => trigger("اعتماد السعر والنقل للطباعة")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition-all hover:bg-emerald-500 active:scale-95"
        >
          <BadgeCheck className="h-4 w-4" />
          <span>{hasCurrentPrice ? "اعتماد السعر والنقل للطباعة" : "تسعير الصنف والنقل للطباعة"}</span>
        </button>
        {hasCurrentPrice && (
          <button
            type="button"
            onClick={() => trigger("تعديل السعر والنقل للطباعة")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs transition-all hover:bg-muted active:scale-95"
          >
            <span>تعديل السعر...</span>
          </button>
        )}
      </div>
      <span className="text-2xs text-muted-foreground font-medium">مراجعة المحاسب</span>
    </div>
  );
}

export interface SpecsPricingCardProps {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly onExecuteMove?: (move: MoveOption) => void;
}

export function SpecsPricingCard({ card, detail, onExecuteMove }: SpecsPricingCardProps) {
  const pricingMove = card.moves?.find((m) => m.edgeId === "WAITING_PRICING->READY_FOR_PRODUCTION");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-4 sm:p-5 shadow-xs backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Coins className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">حالة التسعير والقيمة المالية</h3>
            <p className="text-2xs text-muted-foreground">التكلفة والرسوم المعتمدة للطلب</p>
          </div>
        </div>
        <PricingBadge pricing={card.pricing} />
      </div>

      {detail?.currentPrice ? (
        <PriceValue price={detail.currentPrice} />
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
          <Clock className="h-4 w-4 text-muted-foreground/60" />
          <span>لا يوجد سعر نهائي مسجل حتى الآن، بانتظار اعتماد التكلفة من الإدارة المالية.</span>
        </div>
      )}

      {card.state === "WAITING_PRICING" && (
        <PricingActionButtons
          card={card}
          hasCurrentPrice={Boolean(detail?.currentPrice)}
          pricingMove={pricingMove}
          onExecuteMove={onExecuteMove}
        />
      )}
    </div>
  );
}

export function SpecsMaterialCard({ detail }: { readonly detail: WorkItemFullDetail | null }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs backdrop-blur-md">
      <div className="flex items-center gap-2 border-b border-border/40 pb-3 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-foreground">مواصفات الخامة والتشطيب</h3>
          <p className="text-2xs text-muted-foreground">المواصفات الفنية للورق والخامات واللمسات الخاصة</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 text-xs">
        <div className="flex items-center justify-between rounded-xl bg-muted/30 p-2.5 border border-border/40">
          <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
            <FileText className="h-3.5 w-3.5 text-primary" />
            الخامة / الورق:
          </span>
          <span className="font-bold text-foreground">{detail?.material ?? "غير محدد"}</span>
        </div>

        <div className="flex flex-col gap-1 rounded-xl bg-muted/30 p-2.5 border border-border/40">
          <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            ملاحظات التشطيب:
          </span>
          <span className="font-semibold text-foreground pe-2 pt-0.5">{detail?.finishNotes ?? "لا توجد ملاحظات خاصة"}</span>
        </div>

        {detail?.productionNotes && (
          <div className="flex flex-col gap-1 rounded-xl bg-blue-500/5 p-2.5 border border-blue-500/20">
            <span className="text-blue-700 dark:text-blue-300 flex items-center gap-1.5 font-bold">
              <Scissors className="h-3.5 w-3.5 text-blue-500" />
              ملاحظات الإنتاج:
            </span>
            <span className="font-medium text-foreground pe-2 pt-0.5">{detail.productionNotes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
