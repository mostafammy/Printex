"use client";

/**
 * The job ticket's three rows: reference header, identity, perforated footer.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-003, FR-007, FR-008;
 *  card treatment from 817f251 / main)
 *
 * Split out of JobTicket.tsx, which owns the card's drag/click shell and its
 * store wiring; this is the card's content. The move control rides on the
 * footer rather than adding a row of its own: the card is three rows —
 * reference, identity, perforated footer — and a separate move block below
 * them made a large empty box the biggest thing in the card.
 */

import React from "react";
import { STATE_AR_LABELS } from "~/lib/board/stations";
import type { BoardCard } from "~/lib/board/types";
import { useBoardSelector } from "../hooks/useBoardSelector";
import { OrderTag } from "../OrderTag";

const PRIORITY_CLASS = "rounded-sm bg-destructive/15 px-1.5 py-0.5 text-[11px] font-bold text-destructive";
const REWORK_CLASS =
  "rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400";

function TicketFlags({ card }: { readonly card: BoardCard }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {/* Registration mark — the print-shop ⌖, aria-hidden because it
          carries no information a screen reader needs. */}
      <span
        aria-hidden="true"
        title="اسحب للنقل أو انقر لفتح التفاصيل"
        className="select-none font-mono text-xs text-muted-foreground/40 transition-colors group-hover:text-primary"
      >
        ⌖
      </span>
      {card.priority === "URGENT" && <span className={PRIORITY_CLASS}>عاجل</span>}
      {card.reworkCount > 0 && <span className={REWORK_CLASS}>تعديل #{card.reworkCount}</span>}
    </div>
  );
}

function TicketHeader({
  card,
  onOrderHover,
  onGroupClick,
}: {
  readonly card: BoardCard;
  readonly onOrderHover?: (id: string | null) => void;
  readonly onGroupClick?: (orderId: string) => void;
}) {
  const hiddenSiblingCount = useBoardSelector(
    `hidden-siblings:${card.orderId}`,
    (store) => store.getMeta().hiddenSiblingCounts[card.orderId] ?? 0,
    0,
  );

  return (
    // min-w-0 + overflow-hidden: the order tag and the status group are both
    // intrinsically wide, and with no bound the row overflowed its card and
    // painted a horizontal scrollbar that stayed visible while the lane
    // scrolled vertically — a stray line standing beside the column.
    <div className="flex min-w-0 items-center justify-between gap-1.5 overflow-hidden">
      <OrderTag
        orderId={card.orderId}
        orderNumber={card.orderNumber}
        orderTagHue={card.orderTagHue}
        hiddenSiblingCount={hiddenSiblingCount}
        onHover={onOrderHover}
        onGroupClick={onGroupClick}
      />
      <TicketFlags card={card} />
    </div>
  );
}

function PricingBadge({ pricing }: { readonly pricing: BoardCard["pricing"] }) {
  if (!pricing || pricing === "NOT_REQUIRED") return null;
  const isPriced = pricing === "PRICED";
  const isPending = pricing === "PENDING";
  return (
    <span
      className={`rounded px-1 text-[11px] font-medium ${
        isPriced
          ? "bg-emerald-500/10 text-emerald-600"
          : isPending
            ? "bg-amber-500/10 text-amber-600"
            : "bg-destructive/10 text-destructive"
      }`}
    >
      {isPriced ? "مسعّر" : isPending ? "قيد التسعير" : "نزاع"}
    </span>
  );
}

function TicketFooter({
  card,
  onMove,
}: {
  readonly card: BoardCard;
  readonly onMove?: (card: BoardCard) => void;
}) {
  return (
    // The perforation: a dashed rule is what makes the card read as a torn job
    // docket rather than a generic card.
    <div className="mt-auto flex items-center justify-between gap-1 border-t border-dashed pt-2 text-[11px] text-muted-foreground">
      <div className="flex min-w-0 items-center gap-1">
        {card.quantity && <span className="shrink-0">{card.quantity} نسخة</span>}
        {card.assignee && <span className="truncate">· {card.assignee.name}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <PricingBadge pricing={card.pricing} />
        {/* 44px tall hit area over a 26px visible box, via a pseudo-element
            that extends past the box without affecting layout. The touch
            floor matters more here than the visual height, and a taller
            button made it overflow the fixed-height card. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMove?.(card);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="relative flex h-6 shrink-0 items-center rounded border border-border/70 bg-card px-1.5 text-[10px] font-semibold text-muted-foreground transition-colors after:absolute after:inset-y-[-9px] after:inset-x-0 after:content-[''] hover:bg-muted hover:text-foreground"
        >
          نقل
        </button>
      </div>
    </div>
  );
}

function TicketCustomerTitle({
  customerName,
  title,
}: {
  readonly customerName: string;
  readonly title: string;
}) {
  return (
    // The customer is the quieter of the two, the title is what the operator
    // scans for. Clamped to two lines so a long title cannot make its card
    // taller than the rest of the row.
    <div className="my-2 flex min-w-0 flex-col">
      <span className="truncate text-xs font-semibold text-foreground/80">{customerName}</span>
      <span className="line-clamp-2 text-sm font-bold text-foreground" title={title}>
        {title}
      </span>
    </div>
  );
}

export function TicketBody({
  card,
  onOrderHover,
  onGroupClick,
  onMoveKey,
}: {
  readonly card: BoardCard;
  readonly onOrderHover?: (id: string | null) => void;
  readonly onGroupClick?: (orderId: string) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
}) {
  return (
    <>
      <TicketHeader card={card} onOrderHover={onOrderHover} onGroupClick={onGroupClick} />
      <TicketCustomerTitle customerName={card.customerName} title={card.title} />
      <TicketFooter card={card} onMove={onMoveKey} />
    </>
  );
}

/**
 * The accessible name carries the facts the visual card shows but a screen
 * reader would otherwise miss: the order reference, the quantity, and the
 * two states that mean "act now" (URGENT, pricing dispute).
 */
export function getAccessibleName(card: BoardCard): string {
  const facts = [
    `#${card.orderNumber}`,
    card.quantity ? `${card.quantity} نسخة` : null,
    card.priority === "URGENT" ? "عاجل" : null,
    card.pricing === "DISPUTED" ? "نزاع تسعير" : null,
    card.pricing === "PENDING" ? "قيد التسعير" : null,
    card.reworkCount > 0 ? `تعديل ${card.reworkCount}` : null,
  ].filter(Boolean);
  const stateLabel = STATE_AR_LABELS[card.state] ?? card.state;
  return `${card.customerName} — ${card.title} — ${stateLabel} — ${facts.join("، ")}`;
}
