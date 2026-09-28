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
import { STATE_PLACEMENT } from "~/lib/board/stations";
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

const STATE_AR_LABELS: Readonly<Record<WorkItemState, string>> = {
  NEW: "جديد",
  ASSIGNED: "معين",
  IN_DESIGN: "قيد التصميم",
  REWORK_REQUIRED: "تعديل مطلوب",
  DESIGN_COMPLETED: "مكتمل التصميم",
  WAITING_REVIEW: "بانتظار المراجعة",
  APPROVED: "معتمد",
  WAITING_PRICING: "بانتظار التسعير",
  READY_FOR_PRODUCTION: "جاهز للإنتاج",
  IN_PRODUCTION: "قيد الإنتاج",
  PRODUCTION_COMPLETED: "مكتمل الإنتاج",
  READY_FOR_COLLECTION: "جاهز للتسليم",
  DELIVERED: "تم التسليم",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
};

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
    <div className="flex items-center justify-between gap-2">
      <OrderTag
        orderId={card.orderId}
        orderNumber={card.orderNumber}
        orderTagHue={card.orderTagHue}
        hiddenSiblingCount={hiddenSiblingCount}
        onHover={onOrderHover}
        onGroupClick={onGroupClick}
      />
      <div className="flex items-center gap-1.5">
        {/* Registration mark — the print-shop ⌖, aria-hidden because it
            carries no information a screen reader needs. */}
        <span
          aria-hidden="true"
          title="بطاقة عمل"
          className="select-none font-mono text-sm text-muted-foreground/40"
        >
          ⌖
        </span>
        {card.priority === "URGENT" && (
          <span className="rounded-sm bg-destructive/15 px-1.5 py-0.5 text-xs font-bold text-destructive">
            عاجل
          </span>
        )}
        {card.reworkCount > 0 && (
          <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
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

function TicketFooter({ card }: { readonly card: BoardCard }) {
  return (
    <div className="flex items-center justify-between border-t border-dashed border-[var(--ticket-edge)] pt-2 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1">
        {card.quantity && <span>{card.quantity} نسخة</span>}
        {card.assignee && (
          <span className="truncate max-w-[90px]">· {card.assignee.name}</span>
        )}
      </div>
      <PricingBadge pricing={card.pricing} />
    </div>
  );
}

function TicketCustomerTitle({ customerName, title }: { readonly customerName: string; readonly title: string }) {
  return (
    <div className="my-2 flex flex-col">
      <span className="truncate text-xs text-foreground">{customerName}</span>
      <span className="truncate text-sm font-bold text-foreground">{title}</span>
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
      className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border border-[var(--ticket-edge)] bg-[var(--surface-ticket)] p-3 text-start transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        isSiblingHighlighted ? "ring-2 ring-primary ring-offset-1" : ""
      } ${isDragging ? "opacity-30" : ""}`}
      style={{ borderInlineStartWidth: "4px", borderInlineStartColor: "var(--ticket-bar, var(--primary))" }}
    >
      <TicketHeader card={card} onOrderHover={onOrderHover} onGroupClick={onGroupClick} />
      <TicketCustomerTitle customerName={card.customerName} title={card.title} />
      <TicketFooter card={card} />
      {/* The non-drag move path. `min-h-11` clears the 44px touch floor that
          every other control on this board was failing. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveKey?.(card);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--ticket-edge)] bg-[var(--ticket-wash)] text-sm font-semibold text-foreground transition-colors hover:bg-muted"
      >
        نقل
      </button>
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
