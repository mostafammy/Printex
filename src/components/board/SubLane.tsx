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
 * scanned oldest-first. The windowing itself lives in ./lanes.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import type { WorkItemState } from "~/server/board";
import type { BoardCard } from "~/lib/board/types";
import { useBoardController } from "./hooks/useBoardController";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { STATE_AR_LABELS } from "~/lib/board/stations";
import { useLaneVirtualizer, VirtualCardItems } from "./lanes/LaneVirtualizer";

export interface SubLaneProps {
  readonly state: WorkItemState;
  readonly labelAr?: string;
  readonly onOrderHover?: (id: string | null) => void;
  readonly onCardClick?: (c: BoardCard) => void;
  readonly onMoveKey?: (c: BoardCard) => void;
}

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

interface VirtualizedCardListProps extends SubLaneProps {
  readonly cardIds: readonly string[];
}

function VirtualizedCardList(props: VirtualizedCardListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  useScrollLoadMore(parentRef);
  const columns = useColumns(parentRef);
  const { virtualizer } = useLaneVirtualizer(parentRef, props.cardIds.length, columns);

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
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
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
