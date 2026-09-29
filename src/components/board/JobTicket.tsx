"use client";

/**
 * JobTicket physical print shop ticket component.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-003, FR-007, FR-008;
 *  card treatment from 817f251 / main)
 *
 * The card is both a drag handle and a button. Tapping it used to be a no-op
 * because the page mounted `<Board />` without an `onCardClick`, which left
 * drag-and-drop and a physical keyboard's `m` as the only ways to move a job
 * on a touch screen. The `نقل` control in the footer is the non-drag path, so a
 * wet hand never has to attempt a drag.
 *
 * This file is the card's shell — drag wiring, click and key handling, store
 * subscription. The card's three rows live in ./tickets/TicketParts.
 */

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import type { WorkItemState } from "~/server/board";
import { STATE_PLACEMENT } from "~/lib/board/stations";
import type { BoardCard } from "~/lib/board/types";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { TicketBody, getAccessibleName } from "./tickets/TicketParts";

export interface JobTicketProps {
  readonly cardId?: string;
  readonly card?: BoardCard;
  readonly isSiblingHighlighted?: boolean;
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
}

function getCardStation(state: WorkItemState): string {
  const p = STATE_PLACEMENT[state];
  return p === "OFF_BOARD" ? "reception" : p.station;
}

/** One `m` key, the shortcut the card advertises. */
function useMoveShortcut(card: BoardCard, onMoveKey?: (c: BoardCard) => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      onMoveKey?.(card);
    }
  };
}

function ticketCls(isSiblingHighlighted: boolean, isDragging: boolean): string {
  // h-full against the lane's fixed row height is what makes a row of
  // tickets align. overflow-hidden is a guard as much as a style: any inner
  // row that outgrows the card is clipped rather than painting outside the
  // box.
  return `group relative flex h-full w-full cursor-grab flex-col justify-between overflow-hidden rounded-lg bg-card p-3 text-start shadow-xs transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing ${
    isSiblingHighlighted ? "ring-2 ring-primary ring-offset-1" : ""
  } ${isDragging ? "opacity-30" : ""}`;
}

// One style prop: a second one silently replaces the first. The station's
// fill enters as a 4px rule on the reading edge, which in RTL is the right,
// so a job announces its station by position before it announces it by hue.
const TICKET_STATION_RULE: React.CSSProperties = {
  borderInlineStartWidth: "4px",
  borderInlineStartColor: "var(--ticket-bar, var(--primary))",
};

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
  const onKeyDown = useMoveShortcut(card, onMoveKey);
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
      aria-label={getAccessibleName(card)}
      onClick={() => onClick?.(card)}
      onKeyDown={onKeyDown}
      className={ticketCls(isSiblingHighlighted, isDragging)}
      style={TICKET_STATION_RULE}
    >
      <TicketBody
        card={card}
        onOrderHover={onOrderHover}
        onGroupClick={onGroupClick}
        onMoveKey={onMoveKey}
      />
    </div>
  );
});

function JobTicketStoreSubscriber(props: JobTicketProps & { readonly cardId: string }) {
  const card = useBoardSelector(
    `card:${props.cardId}`,
    (s) => s.getCard(props.cardId),
    undefined,
  );
  // Null when the card moved to another lane between the row's render and
  // this read. The row that asked for it is unmounting anyway; rendering an
  // empty shell here left a card-sized hole in the lane.
  if (!card) return null;
  return <JobTicketView {...props} card={card} />;
}

export const JobTicket = React.memo(function JobTicket(props: JobTicketProps) {
  // A ticket renders only when it can resolve a card. A lane row mounts one
  // JobTicket per card id, and returning an empty fragment for an id the
  // store no longer holds left a 148px row of blank space behind.
  if (props.card) return <JobTicketView {...props} card={props.card} />;
  if (props.cardId) return <JobTicketStoreSubscriber {...props} cardId={props.cardId} />;
  return null;
});
