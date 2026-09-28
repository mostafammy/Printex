"use client";

/**
 * JobTicket physical print shop ticket component.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-003, FR-007, FR-008)
 *
 * The card is both a drag handle and a button. Tapping it used to be a no-op
 * because the page mounted `<Board />` without an `onCardClick`, which left
 * drag-and-drop and a physical keyboard's `m` as the only ways to move a job
 * on a touch screen. The explicit `نقل` control below is the non-drag path,
 * so a wet hand never has to attempt a drag.
 */

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import type { WorkItemState } from "~/server/board";
import { STATE_AR_LABELS, STATE_PLACEMENT } from "~/lib/board/stations";
import type { BoardCard } from "~/lib/board/types";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { OrderTag } from "./OrderTag";

export interface JobTicketProps {
  readonly cardId?: string;
  readonly card?: BoardCard;
  readonly isSiblingHighlighted?: boolean;
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
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
    // One line, no wrapping: order reference and status on the same row, so a
    // queue of jobs scans as a single column of references.
    //
    // min-w-0 + overflow-hidden: the order tag and the status group are both
    // intrinsically wide, and without a bound the row overflowed its card and
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
      <div className="flex shrink-0 items-center gap-1 overflow-hidden">
        {/* Registration mark — the print-shop ⌖, aria-hidden because it
            carries no information a screen reader needs. */}
        <span
          aria-hidden="true"
          title="بطاقة عمل"
          className="select-none font-mono text-xs text-muted-foreground/40"
        >
          ⌖
        </span>
        {card.priority === "URGENT" && (
          <span className="rounded-sm bg-destructive/15 px-1.5 py-0.5 text-[11px] font-bold text-destructive">
            عاجل
          </span>
        )}
        {card.reworkCount > 0 && (
          <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
            تعديل #{card.reworkCount}
          </span>
        )}
      </div>
    </div>
  );
}

function PricingBadge({ pricing }: { readonly pricing: BoardCard["pricing"] }) {
  if (!pricing || pricing === "NOT_REQUIRED") return null;
  const isPriced = pricing === "PRICED";
  const isPending = pricing === "PENDING";
  return (
    <span
      className={`px-1 text-[11px] font-semibold leading-4 ${
        isPriced
          ? "text-emerald-600"
          : isPending
            ? "text-amber-600"
            : "text-destructive"
      }`}
    >
      {isPriced ? "مسعّر" : isPending ? "قيد التسعير" : "نزاع"}
    </span>
  );
}

function TicketFooter({ card }: { readonly card: BoardCard }) {
  return (
    // Pricing sits with the identity line, not the footer: it is a state the
    // operator triages on, and the footer row now belongs to the move control.
    <div className="mt-1 flex items-center justify-between gap-2">
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
        {card.quantity ? `${card.quantity} نسخة` : ""}
      </span>
      <PricingBadge pricing={card.pricing} />
    </div>
  );
}

function TicketCustomerTitle({ customerName, title }: { readonly customerName: string; readonly title: string }) {
  return (
    // Title first and largest: it is what the operator is looking for. The
    // customer sits above it as a quiet qualifier.
    //
    // Clamped to two lines. An unbounded title made its card taller than
    // every other card in the row, which is what turned a lane of tickets
    // into a staircase of ragged edges.
    <div className="mt-1.5 flex min-w-0 flex-col">
      <span className="truncate text-[11px] text-muted-foreground">{customerName}</span>
      <span
        className="line-clamp-2 text-sm font-bold leading-snug text-foreground"
        title={title}
      >
        {title}
      </span>
    </div>
  );
}

function getCardStation(state: WorkItemState): string {
  const p = STATE_PLACEMENT[state];
  return p === "OFF_BOARD" ? "reception" : p.station;
}

export const JobTicketView = React.memo(function JobTicketView({
  card,
  isSiblingHighlighted = false,
  onOrderHover,
  onClick,
  onMoveKey,
  onGroupClick,
}: Omit<JobTicketProps, "cardId"> & {
  readonly card: BoardCard;
  readonly onGroupClick?: (orderId: string) => void;
}) {
  const stateLabel = STATE_AR_LABELS[card.state] ?? card.state;

  // The accessible name carries the facts the visual card shows but a screen
  // reader would otherwise miss: the order reference, how much time is left,
  // and the two states that mean "act now" (URGENT, pricing dispute).
  const facts = [
    `#${card.orderNumber}`,
    card.quantity ? `${card.quantity} نسخة` : null,
    card.priority === "URGENT" ? "عاجل" : null,
    card.pricing === "DISPUTED" ? "نزاع تسعير" : null,
    card.pricing === "PENDING" ? "قيد التسعير" : null,
    card.reworkCount > 0 ? `تعديل ${card.reworkCount}` : null,
  ].filter(Boolean);
  const accessibleName = `${card.customerName} — ${card.title} — ${stateLabel} — ${facts.join("، ")}`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      onMoveKey?.(card);
    }
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      data-testid={`job-ticket-${card.id}`}
      data-station={getCardStation(card.state)}
      aria-label={accessibleName}
      onClick={() => onClick?.(card)}
      onKeyDown={onKeyDown}
      // A soft card: rounded corners and a lift on hover, with the station's
      // ink as a rule on the reading edge. In RTL the start edge is the right,
      // so a job announces its station by position before it announces it by
      // hue.
      //
      // h-full plus a clamped title is what makes a row of tickets the same
      // height. Without it each card is as tall as its own longest line, and
      // a row of jobs reads as a ragged staircase instead of a grid.
      //
      // overflow-hidden is a guard as much as a style: any row that outgrows
      // the card is clipped rather than painting outside the box, which is
      // what produced the stray line that stayed beside the column while the
      // lane scrolled.
      className={`group relative flex h-full w-full cursor-grab flex-col overflow-hidden rounded-lg border bg-card p-2.5 text-start shadow-xs transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing ${
        isSiblingHighlighted ? "ring-2 ring-primary ring-offset-1" : ""
      } ${isDragging ? "opacity-30" : ""}`}
      // One style prop: a second one silently replaces the first, which is
      // how the soft elevation went missing. --ticket-bar is the station's
      // fill, the token 817f251 paired with the 4px reading-edge rule.
      style={{
        borderInlineStartWidth: "4px",
        borderInlineStartColor: "var(--ticket-bar, var(--primary))",
      }}
    >
      <TicketHeader card={card} onOrderHover={onOrderHover} onGroupClick={onGroupClick} />
      <TicketCustomerTitle customerName={card.customerName} title={card.title} />
      <TicketFooter card={card} />
      {/* The non-drag move path. The card is a fixed height and this row is
          mt-auto, so the button lands flush at the bottom on every card
          instead of overflowing the box — the overflow was drawing as a
          stray line beside the card that stayed put while the lane scrolled. */}
      <div className="mt-auto flex items-center justify-end gap-2 border-t border-dashed border-border/60 pt-1.5">
        {card.assignee && (
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {card.assignee.name}
          </span>
        )}
        {/* 44px tall hit area over a 32px visible box, via a pseudo-element
            that extends past the box without affecting layout. Shrinking the
            button to fit instead would break the touch floor this board is
            held to; letting it stay 44px made it overflow the fixed-height
            card and paint a stray line beside it. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveKey?.(card);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="relative flex h-8 min-w-16 shrink-0 items-center justify-center rounded-md border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors after:absolute after:inset-y-[calc(-50%+0.75rem)] after:inset-x-0 after:content-[''] hover:bg-muted hover:text-foreground"
        >
          نقل
        </button>
      </div>
    </div>
  );
});

function JobTicketStoreSubscriber(props: JobTicketProps & {
  readonly cardId: string;
  readonly onGroupClick?: (orderId: string) => void;
}) {
  const card = useBoardSelector(
    `card:${props.cardId}`,
    (s) => s.getCard(props.cardId),
    undefined,
  );
  if (!card) return null;
  return <JobTicketView {...props} card={card} />;
}

export const JobTicket = React.memo(function JobTicket(props: JobTicketProps) {
  if (props.card) {
    return <JobTicketView {...props} card={props.card} />;
  }
  if (props.cardId) {
    return <JobTicketStoreSubscriber {...props} cardId={props.cardId} />;
  }
  return null;
});
