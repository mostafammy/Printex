"use client";

/**
 * Header section for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import Link from "next/link";
import { X, ExternalLink, RotateCcw, Phone, Sparkles, ArrowLeft, Building2, ArrowRightLeft } from "lucide-react";
import type { BoardCard, WorkItemFullDetail } from "~/lib/board/types";
import { LifecycleStepper } from "./LifecycleStepper";

export interface DetailsHeaderProps {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly stateLabel: string;
  readonly stationPageHref: string | null;
  readonly onClose: () => void;
  readonly onOpenMoveMenu?: (card: BoardCard) => void;
}

function BadgesRow({ card, stateLabel }: { readonly card: BoardCard; readonly stateLabel: string }) {
  const chipBg = {
    backgroundColor: `hsl(${card.orderTagHue} 75% 95%)`,
    borderColor: `hsl(${card.orderTagHue} 50% 80%)`,
    color: `hsl(${card.orderTagHue} 85% 25%)`,
    borderWidth: "1px",
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-xs font-black shadow-2xs" style={chipBg}>
        #{card.orderNumber}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary shadow-2xs">
        <span className="h-2 w-2 rounded-full bg-primary" />
        {stateLabel}
      </span>
      {card.priority === "URGENT" && (
        <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/15 px-2.5 py-1 text-xs font-bold text-destructive animate-pulse">
          <Sparkles className="h-3 w-3" />
          عاجل
        </span>
      )}
      {card.reworkCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
          <RotateCcw className="h-3 w-3" />
          تعديل #{card.reworkCount}
        </span>
      )}
    </div>
  );
}

function HeaderTitleBlock({ title, customerName, phone }: { readonly title: string; readonly customerName: string; readonly phone?: string }) {
  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <h2 className="line-clamp-2 text-xl sm:text-2xl font-black text-foreground tracking-tight leading-snug">
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-bold text-foreground/90 bg-muted/50 px-2.5 py-1 rounded-lg border border-border/50">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span>{customerName}</span>
        </span>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold px-2.5 py-1 rounded-lg border border-border/50 bg-background/80 hover:bg-muted text-foreground/80 hover:text-primary transition-all duration-200"
            dir="ltr"
          >
            <Phone className="h-3 w-3 text-emerald-500" />
            <span>{phone}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function QuickLinksLeft({ orderId, stationPageHref }: { readonly orderId: string; readonly stationPageHref: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/orders/${orderId}`}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-95"
      >
        <ExternalLink className="h-3.5 w-3.5 text-primary" />
        <span>صفحة الطلب بالكامل</span>
      </Link>
      {stationPageHref && (
        <Link
          href={stationPageHref}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary shadow-2xs transition-all hover:bg-primary/20 active:scale-95"
        >
          <span>شاشة المحطة</span>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function QuickLinksRow({ card, stationPageHref, onClose, onOpenMoveMenu }: { readonly card: BoardCard; readonly stationPageHref: string | null; readonly onClose: () => void; readonly onOpenMoveMenu?: (card: BoardCard) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 bg-muted/20 px-4 py-2.5 sm:px-6 backdrop-blur-md">
      <QuickLinksLeft orderId={card.orderId} stationPageHref={stationPageHref} />
      {onOpenMoveMenu && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenMoveMenu(card);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-primary/90 px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:opacity-95 hover:shadow-primary/25 active:scale-95"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          <span>نقل إلى محطة أخرى...</span>
        </button>
      )}
    </div>
  );
}

export function DetailsHeader({ card, detail, stateLabel, stationPageHref, onClose, onOpenMoveMenu }: DetailsHeaderProps) {
  return (
    <>
      <div className="flex shrink-0 items-start justify-between border-b border-border/70 bg-gradient-to-b from-card to-muted/20 p-4 sm:p-6 pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2 pe-4">
          <BadgesRow card={card} stateLabel={stateLabel} />
          <HeaderTitleBlock title={detail?.title ?? card.title} customerName={card.customerName} phone={detail?.customer.phones[0]} />
          <LifecycleStepper currentState={card.state} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-2xs transition-all hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <QuickLinksRow card={card} stationPageHref={stationPageHref} onClose={onClose} onOpenMoveMenu={onOpenMoveMenu} />
    </>
  );
}
