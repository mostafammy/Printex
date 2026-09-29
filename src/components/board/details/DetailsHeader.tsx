"use client";

/**
 * Header section for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import Link from "next/link";
import {
  X,
  ExternalLink,
  RotateCcw,
  Paperclip,
  Phone,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { BoardCard, WorkItemFullDetail } from "~/lib/board/types";

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
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold" style={chipBg}>
        #{card.orderNumber}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
        {stateLabel}
      </span>
      {card.priority === "URGENT" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
          <Sparkles className="h-3 w-3" />
          عاجل
        </span>
      )}
      {card.reworkCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
          <RotateCcw className="h-3 w-3" />
          تعديل #{card.reworkCount}
        </span>
      )}
    </div>
  );
}

function QuickLinksRow({
  card,
  stationPageHref,
  onClose,
  onOpenMoveMenu,
}: {
  readonly card: BoardCard;
  readonly stationPageHref: string | null;
  readonly onClose: () => void;
  readonly onOpenMoveMenu?: (card: BoardCard) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/50 px-4 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/orders/${card.orderId}`}
          className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:border-primary/40 hover:bg-muted"
        >
          <ExternalLink className="h-3 w-3 text-primary" />
          <span>صفحة الطلب بالكامل</span>
        </Link>
        <Link
          href={`/work-items/${card.id}/files`}
          className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground shadow-2xs transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Paperclip className="h-3 w-3" />
          <span>الملفات والمرفقات</span>
        </Link>
        {stationPageHref && (
          <Link
            href={stationPageHref}
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <span>شاشة المحطة</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {onOpenMoveMenu && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenMoveMenu(card);
          }}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
        >
          نقل إلى محطة أخرى...
        </button>
      )}
    </div>
  );
}

export function DetailsHeader({
  card,
  detail,
  stateLabel,
  stationPageHref,
  onClose,
  onOpenMoveMenu,
}: DetailsHeaderProps) {
  return (
    <>
      <div className="flex shrink-0 items-start justify-between border-b border-border/70 bg-muted/40 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pe-4">
          <BadgesRow card={card} stateLabel={stateLabel} />
          <h2 className="line-clamp-2 text-lg font-bold text-foreground sm:text-xl">
            {detail?.title ?? card.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">{card.customerName}</span>
            {detail?.customer.phones[0] && (
              <span className="inline-flex items-center gap-1 font-mono">
                <Phone className="h-3 w-3" />
                {detail.customer.phones[0]}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <QuickLinksRow
        card={card}
        stationPageHref={stationPageHref}
        onClose={onClose}
        onOpenMoveMenu={onOpenMoveMenu}
      />
    </>
  );
}
