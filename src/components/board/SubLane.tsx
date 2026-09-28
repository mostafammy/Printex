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
import { useVirtualizer } from "@tanstack/react-virtual";
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

// A tiled card is shorter than a full-width one. The virtualizer
// self-corrects via measureElement, but a close first estimate avoids the
// scroll jump on first paint.
const CARD_HEIGHT = 132;
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
    <div className="flex items-center justify-between gap-2 border-b border-[var(--board-line-strong)] px-2 py-1">
      <h3 className="truncate text-xs font-bold text-foreground">{labelAr}</h3>
      {showCount && (
        <span
          className={`shrink-0 px-1 font-mono text-xs font-bold tabular-nums leading-4 ${
            count === 0
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "text-muted-foreground"
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
    <div className="flex items-center gap-1.5 border border-dashed border-[var(--board-line-strong)] px-2 py-2 text-[11px] text-muted-foreground">
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
          cards. flex-basis:0 + min-w-0 makes the track purely fractional. */}
      <div
        className="flex"
        style={{ gap: `${CARD_GAP}px`, paddingBottom: `${CARD_GAP}px` }}
      >
        {cardIds.map((cardId) => (
          <div
            key={cardId}
            className="min-w-0 flex-1"
            style={{ flexBasis: 0 }}
          >
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

function VirtualizedCardList(props: VirtualizedCardListProps) {
  const controller = useBoardController();
  const parentRef = useRef<HTMLDivElement>(null);
  // Prevent concurrent loadMore calls.
  const isFetchingRef = useRef(false);
  const [columns, setColumns] = useState(1);

  // Columns come from the measured width, not a viewport breakpoint: a lane
  // in the full board and the same lane filling a station are very different
  // widths, and the lane is the thing that knows its own width.
  //
  // Falls back to a single column when the measured width is 0, which is what
  // jsdom and any pre-layout first paint report; one column is the safe
  // answer there because it never under-reads the available space.
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
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowCount = Math.ceil(props.cardIds.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT + CARD_GAP,
    overscan: 3,
  });

  // Stable scroll handler — fires only when user scrolls near the bottom.
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el || isFetchingRef.current) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Trigger when within one row of the bottom.
    if (distanceFromBottom < CARD_HEIGHT) {
      isFetchingRef.current = true;
      void controller.loadMore().finally(() => {
        isFetchingRef.current = false;
      });
    }
  }, [controller]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // A column change re-flows every row, so the previous scroll offset is no
  // longer meaningful; returning to the top beats landing mid-card.
  useEffect(() => {
    const el = parentRef.current;
    // scrollTo is a no-op stub in jsdom, so feature-detect rather than assume.
    if (el && typeof el.scrollTo === "function") el.scrollTo({ top: 0 });
  }, [columns]);

  const virtualItems = virtualizer.getVirtualItems();

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
        {virtualItems.map((vItem) => {
          // Virtual index is a row index; map it back to the cards it holds.
          const start = vItem.index * columns;
          const rowIds = props.cardIds.slice(start, start + columns);
          if (rowIds.length === 0) return null;
          return (
            <VirtualRow
              key={vItem.key}
              virtualItem={vItem}
              cardIds={rowIds}
              measureRef={virtualizer.measureElement}
              onOrderHover={props.onOrderHover}
              onCardClick={props.onCardClick}
              onMoveKey={props.onMoveKey}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Every lane has a label in stations.ts, single-lane stations included. The
    old `labelAr ?? ""` left the header blank for reception/pricing/delivered,
    which is where the orphaned station count in the screenshot came from. */
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
        <EmptyLane labelAr={props.labelAr ?? ""} />
      ) : (
        <VirtualizedCardList {...props} cardIds={cardIds} />
      )}
    </div>
  );
}
