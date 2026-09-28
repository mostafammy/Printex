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
    <div className="flex items-center justify-between gap-1.5">
      <OrderTag
        orderId={card.orderId}
        orderNumber={card.orderNumber}
        orderTagHue={card.orderTagHue}
        hiddenSiblingCount={hiddenSiblingCount}
        onHover={onOrderHover}
        onGroupClick={onGroupClick}
      />
      <div className="flex shrink-0 items-center gap-1">
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
          // Solid, not tinted: urgency is the one fact that must win the
          // attention contest against 30 identical cards.
          <span className="bg-destructive px-1 py-px text-[11px] font-bold leading-4 text-destructive-foreground">
            عاجل
          </span>
        )}
        {card.reworkCount > 0 && (
          <span className="bg-amber-500/15 px-1 py-px text-[11px] font-bold leading-4 text-amber-700 dark:text-amber-400">
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
    <div className="mt-1.5 flex flex-col">
      <span className="truncate text-[11px] text-muted-foreground">{customerName}</span>
      <span className="truncate text-sm font-bold leading-snug text-foreground">{title}</span>
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
      // Industrial card: 2px corner, hairline border, no shadow. The
      // station's ink enters as a 4px rule on the reading edge — in RTL the
      // start edge is the right, so a job announces its station by position
      // before it announces it by hue.
      className={`group relative flex w-full flex-col justify-between overflow-hidden rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-[var(--board-surface)] p-2 text-start transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        isSiblingHighlighted ? "ring-2 ring-primary ring-offset-1" : ""
      } ${isDragging ? "opacity-30" : ""}`}
      // --ticket-edge rather than --ticket-bar: the fill of a graphite ("key")
      // station is near-black, and a 4px near-black stripe read as a
      // rendering artifact rather than as the station's identity. The edge
      // token is the one authored for non-text marks, at 3px.
      style={{
        borderInlineStartWidth: "3px",
        borderInlineStartColor: "var(--ticket-edge, var(--primary))",
      }}
    >
      <TicketHeader card={card} onOrderHover={onOrderHover} onGroupClick={onGroupClick} />
      <TicketCustomerTitle customerName={card.customerName} title={card.title} />
      <TicketFooter card={card} />
      <div className="mt-1.5 flex items-center justify-end gap-2 border-t border-dashed border-[var(--board-line-strong)] pt-0.5">
        {card.assignee && (
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {card.assignee.name}
          </span>
        )}
        {/* The non-drag move path. Inline on the last row rather than a
            full-width block below it: the previous version made an empty
            white box the largest element in the card, inverting the
            hierarchy so the primary action shouted and the job title
            whispered. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveKey?.(card);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex min-h-11 shrink-0 items-center rounded-[var(--board-radius)] border border-[var(--board-line-strong)] px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
