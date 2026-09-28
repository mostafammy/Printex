"use client";

/**
 * SubLane virtualized card list subscribing to "lane:<state>".
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, R8, plan.md S1, S5)
 *
 * Cards tile as many per row as the station is wide. A job ticket is four
 * short lines; one card stretched across a whole station is mostly empty
 * space with content pinned to a corner, which is what made this read as
 * broken. Tiling puts more jobs on screen at a smaller card, which is the
 * whole point of a floor board.
 *
 * Virtualization is over ROWS, not cards: the row count is
 * ceil(cards / columns), and columns come from the measured width. Within a
 * row, cards flow in reading order (first right in RTL) so a lane is still
 * scanned oldest-first.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import type { WorkItemState } from "~/server/board";
import type { BoardCard } from "~/lib/board/types";
import { useBoardController } from "./hooks/useBoardController";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { JobTicket } from "./JobTicket";
import { STATE_AR_LABELS } from "~/lib/board/stations";

export interface SubLaneProps {
  readonly state: WorkItemState;
  readonly labelAr?: string;
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
}

// A fixed row height is what makes a lane read as a grid rather than a
// staircase. Every card is the same height, so a row's bottom edges line up
// and the eye can scan across instead of down.
//
// Sized for the tallest card the ticket can produce: header row, a two-line
// title, the identity row, then the move control. A fixed estimate keeps the
// first paint from jumping.
const CARD_HEIGHT = 148;
const CARD_MIN_WIDTH = 240;
const CARD_GAP = 8;

/** Stable empty result, so a missing provider does not allocate a new array
    every render and defeat the selector's reference check. */
const EMPTY_IDS: readonly string[] = Object.freeze([]);

function LaneHeader({
  labelAr,
  count,
  showCount,
}: {
  readonly labelAr: string;
  readonly count: number;
  readonly showCount: boolean;
}) {
  return (
    // A lane is a queue, so its header is a section rule with a count on the
    // end — the count is set in mono so a column of numbers aligns and a
    // stalled lane is visible without reading any label.
    //
    // A single-lane station hides it: the station header already carries the
    // same number one line above, and printing it twice read as a mistake.
    <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-1">
      <h3 className="truncate text-xs font-semibold text-muted-foreground">{labelAr}</h3>
      {showCount && (
        <span
          className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
            count === 0
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </div>
  );
}

/**
 * An empty lane is a good fact, not an absence of one. An operator reading
 * "0" against a green mark learns the station is genuinely clear; the same
 * "0" in grey next to a busy station is ambiguous.
 */
function EmptyLane({ labelAr }: { readonly labelAr: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-2.5 py-2 text-[11px] text-muted-foreground">
      <span aria-hidden="true" className="text-emerald-600">
        ●
      </span>
      <span>{labelAr} — لا توجد عناصر الآن</span>
    </div>
  );
}

interface VirtualizedCardListProps extends SubLaneProps {
  readonly cardIds: readonly string[];
}

function VirtualRow({
  virtualItem,
  cardIds,
  measureRef,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: {
  readonly virtualItem: { readonly index: number; readonly start: number };
  readonly cardIds: readonly string[];
  readonly measureRef: (node: HTMLDivElement | null) => void;
  readonly onOrderHover?: (id: string | null) => void;
  readonly onCardClick?: (c: BoardCard) => void;
  readonly onMoveKey?: (c: BoardCard) => void;
}) {
  return (
    <div
      data-index={virtualItem.index}
      ref={measureRef}
      role="listitem"
      // inset-x-0, not inset-e-0: `inset-e-0` sets only the inline-END
      // edge, so the row keeps an auto inline-start and shrink-wraps to its
      // content — which is why cards came out ragged-width and left-hugging
      // inside a full-width station instead of stacking flush.
      className="absolute inset-x-0"
      style={{ transform: `translateY(${virtualItem.start}px)` }}
    >
      {/* flex, not grid: `1fr` in a grid cell can produce a zero-basis track
          against a min-content intrinsic size, which is what collapsed the
          cards. flex-basis:0 + min-w-0 makes the track purely fractional.

          The row is a fixed height and the card stretches to fill it, so every
          ticket in a row is the same height. */}
      <div
        className="flex"
        style={{ gap: `${CARD_GAP}px`, height: `${CARD_HEIGHT}px` }}
      >
        {cardIds.map((cardId) => (
          <div key={cardId} className="flex min-w-0 flex-1" style={{ flexBasis: 0 }}>
            <JobTicket
              cardId={cardId}
              onOrderHover={onOrderHover}
              onClick={onCardClick}
              onMoveKey={onMoveKey}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function useScrollLoadMore(parentRef: React.RefObject<HTMLDivElement | null>) {
  const controller = useBoardController();
  const isFetchingRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el || isFetchingRef.current) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      isFetchingRef.current = true;
      void controller.loadMore().finally(() => {
        isFetchingRef.current = false;
      });
    }
  }, [parentRef, controller]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [parentRef, handleScroll]);
}

/**
 * How many cards fit across the lane. Measured from the lane itself rather
 * than a viewport breakpoint: a lane in the full board and the same lane
 * filling a station are very different widths, and the lane is the thing that
 * knows its own width.
 */
function useColumns(parentRef: React.RefObject<HTMLDivElement | null>) {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setColumns(
        Math.max(1, Math.floor((w + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP))),
      );
    };
    measure();
    // jsdom and any pre-layout first paint report width 0; one column is the
    // safe answer there because it never under-reads the available space.
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [parentRef]);

  return columns;
}

function VirtualCardItems({
  virtualItems,
  cardIds,
  columns,
  measureRef,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: {
  readonly virtualItems: readonly VirtualItem[];
  readonly cardIds: readonly string[];
  readonly columns: number;
  readonly measureRef: (node: HTMLDivElement | null) => void;
  readonly onOrderHover?: (id: string | null) => void;
  readonly onCardClick?: (c: BoardCard) => void;
  readonly onMoveKey?: (c: BoardCard) => void;
}) {
  return (
    <>
      {virtualItems.map((vItem) => {
        // The virtual index is a row index; map it back to the cards it holds.
        const start = vItem.index * columns;
        const rowIds = cardIds.slice(start, start + columns);
        if (rowIds.length === 0) return null;
        return (
          <VirtualRow
            key={vItem.key}
            virtualItem={vItem}
            cardIds={rowIds}
            measureRef={measureRef}
            onOrderHover={onOrderHover}
            onCardClick={onCardClick}
            onMoveKey={onMoveKey}
          />
        );
      })}
    </>
  );
}

function VirtualizedCardList(props: VirtualizedCardListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  useScrollLoadMore(parentRef);
  const columns = useColumns(parentRef);

  const virtualizer = useVirtualizer({
    count: Math.ceil(props.cardIds.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 3,
  });

  // A column change re-flows every row, so the previous scroll offset is no
  // longer meaningful; returning to the top beats landing mid-card.
  useEffect(() => {
    const el = parentRef.current;
    // scrollTo is a no-op stub in jsdom, so feature-detect rather than assume.
    if (el && typeof el.scrollTo === "function") el.scrollTo({ top: 0 });
  }, [columns]);

  return (
    <div
      ref={parentRef}
      role="list"
      // Always the Arabic label. The previous `labelAr ?? state` fallback
      // announced raw enums ("NEW", "WAITING_PRICING") for single-lane
      // stations; every lane has a label in stations.ts.
      aria-label={props.labelAr ?? STATE_AR_LABELS[props.state] ?? props.state}
      // min-h-0 for the same reason as the lane wrapper: without it this
      // flex child grows to the full list height and the container itself
      // never becomes scrollable.
      className="relative min-h-0 flex-1 overflow-y-auto px-1 pb-2"
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        <VirtualCardItems
          virtualItems={virtualizer.getVirtualItems()}
          cardIds={props.cardIds}
          columns={columns}
          measureRef={virtualizer.measureElement}
          onOrderHover={props.onOrderHover}
          onCardClick={props.onCardClick}
          onMoveKey={props.onMoveKey}
        />
      </div>
    </div>
  );
}

export function SubLane(props: SubLaneProps) {
  const cardIds = useBoardSelector(
    `lane:${props.state}`,
    (s) => s.getLane(props.state),
    EMPTY_IDS,
  );
  const label = props.labelAr ?? STATE_AR_LABELS[props.state] ?? props.state;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <LaneHeader labelAr={label} count={cardIds.length} showCount={props.labelAr !== undefined} />
      {cardIds.length === 0 ? (
        <EmptyLane labelAr={label} />
      ) : (
        <VirtualizedCardList {...props} cardIds={cardIds} />
      )}
    </div>
  );
}
