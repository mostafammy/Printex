"use client";

/**
 * JobTicket physical print shop ticket component.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-003, FR-007, FR-008)
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
}: {
  readonly card: BoardCard;
  readonly onOrderHover?: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <OrderTag
        orderId={card.orderId}
        orderNumber={card.orderNumber}
        orderTagHue={card.orderTagHue}
        onHover={onOrderHover}
      />
      <div className="flex items-center gap-1.5">
        {card.priority === "URGENT" && (
          <span className="rounded-sm bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
            عاجل
          </span>
        )}
        {card.reworkCount > 0 && (
          <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
            تعديل #{card.reworkCount}
          </span>
        )}
        <span
          className="text-[10px] text-muted-foreground opacity-40 select-none"
          title="علامة تسجيل الطباعة"
          aria-hidden="true"
        >
          ⌖
        </span>
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
      className={`rounded px-1 text-[10px] font-medium ${
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
    <div className="flex items-center justify-between border-t border-dashed pt-2 text-[11px] text-muted-foreground">
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
      <span className="truncate text-xs font-semibold text-foreground/80">{customerName}</span>
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
}: Omit<JobTicketProps, "cardId"> & { readonly card: BoardCard }) {
  const stateLabel = STATE_AR_LABELS[card.state] ?? card.state;
  const accessibleName = `${card.customerName} — ${card.title} — ${stateLabel}`;

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
      className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-card p-3 text-start shadow-xs transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isSiblingHighlighted ? "ring-2 ring-primary ring-offset-1" : ""} ${isDragging ? "opacity-30" : ""}`}
      style={{ borderInlineStartWidth: "4px", borderInlineStartColor: "var(--ticket-bar, var(--primary))" }}
    >
      <TicketHeader card={card} onOrderHover={onOrderHover} />
      <TicketCustomerTitle customerName={card.customerName} title={card.title} />
      <TicketFooter card={card} />
    </div>
  );
});

function JobTicketStoreSubscriber(props: JobTicketProps & { readonly cardId: string }) {
  const card = useBoardSelector(`card:${props.cardId}`, (s) =>
    s.getCard(props.cardId),
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
