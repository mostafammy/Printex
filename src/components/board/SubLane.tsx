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
 *
 * Chunked per-lane pagination rides along: an IntersectionObserver sentinel
 * at the end of the list triggers exactly one loadMore(state) — one page for
 * this lane only — each time the operator reaches the bottom.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { WorkItemState } from "~/server/board";
import type { BoardCard } from "~/lib/board/types";
import { useBoardController } from "./hooks/useBoardController";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { STATE_AR_LABELS } from "~/lib/board/stations";
import { useLaneDropOffer } from "./dnd/useLaneDropOffer";
import { useFreshIds } from "./hooks/useFreshIds";
import { useSentinelLoadMore } from "./hooks/useSentinelLoadMore";
import { LanePageControl } from "./LanePageControl";
import { LaneSkeleton } from "./LaneSkeleton";
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
            count === 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </div>
  );
}

/**
 * An empty lane is a good fact, not the absence of one. An operator reading
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

/**
 * One page per lane, and one lane per call: `loadMore(state)` is scoped to the
 * station the operator is looking at, so loading a long lane never starves a
 * short one beside it. The ref guard collapses a burst of scroll events into
 * a single in-flight request.
 */
function useLaneLoadNext(state: WorkItemState) {
  const controller = useBoardController();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadNext = useCallback(() => {
    if (loadingRef.current) return Promise.resolve();
    loadingRef.current = true;
    setLoading(true);
    return controller
      .loadMore(state)
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  }, [controller, state]);

  return { loading, loadNext };
}

/** How many cards fit across the lane. Measured, not assumed: a station is
    full width on wide screens and one column on a phone. */
function useColumns(parentRef: React.RefObject<HTMLDivElement | null>) {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      // +1 so a lane exactly CARD_MIN_WIDTH wide still gets one column; the
      // pre-layout 0 would otherwise make `Math.max(1, 0)` read as a
      // single-column lane for a frame and re-render.
      setColumns(Math.max(1, Math.floor((w + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP))));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [parentRef]);

  return columns;
}

function VirtualizedCardList(props: SubLaneProps & { readonly cardIds: readonly string[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { loading, loadNext } = useLaneLoadNext(props.state);
  useSentinelLoadMore(parentRef, sentinelRef, loadNext);

  // Ids that arrived after the first paint, so a newly loaded chunk plays one
  // entrance animation instead of popping in mid-row.
  const fresh = useFreshIds(props.cardIds);

  const columns = useColumns(parentRef);
  const { virtualizer } = useLaneVirtualizer(parentRef, props.cardIds.length, columns);

  return (
    <div
      ref={parentRef}
      role="list"
      // Always the Arabic label. The previous `labelAr ?? state` fallback
      // announced the raw enum ("NEW", "WAITING_PRICING") for single-lane
      // stations; every lane label is in stations.ts.
      aria-label={props.labelAr ?? STATE_AR_LABELS[props.state] ?? props.state}
      // min-h-0 for the same reason as the lane wrapper: without it a flex
      // child grows to the full list height, the container itself never
      // becomes scrollable, and the virtualizer windows nothing.
      className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2"
    >
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        <VirtualCardItems
          virtualItems={virtualizer.getVirtualItems()}
          cardIds={props.cardIds}
          columns={columns}
          measureRef={virtualizer.measureElement}
          freshIds={fresh}
          onOrderHover={props.onOrderHover}
          onCardClick={props.onCardClick}
          onMoveKey={props.onMoveKey}
        />
      </div>

      {loading && <LaneSkeleton label={`جاري تحميل ${props.labelAr ?? props.state}`} />}
      {/* 1px sentinel: it sits at the very end of the scroll box, so its
          intersection is exactly "the operator reached the bottom". */}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      <LanePageControl
        state={props.state}
        loaded={props.cardIds.length}
        loading={loading}
        onLoadMore={loadNext}
      />
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

  // Every section is its own drop target: without this a drop anywhere in
  // the station resolves to the station's first matching edge, so a card
  // dragged onto "مكتمل التصميم" lands in "تعديل مطلوب". The station
  // column stays registered too, as the fallback for header and gaps.
  const { setNodeRef } = useDroppable({ id: props.state });
  const laneOffer = useLaneDropOffer(props.state);
  const laneRing =
    laneOffer === "over"
      ? "ring-2 ring-primary rounded-lg"
      : laneOffer === "offered"
        ? "ring-1 ring-primary/40 rounded-lg"
        : "";

  return (
    <div
      ref={setNodeRef}
      data-testid={`lane-section-${props.state}`}
      data-lane-drop={laneOffer}
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${laneRing}`}
    >
      <LaneHeader labelAr={label} count={cardIds.length} showCount={props.labelAr !== undefined} />
      {cardIds.length === 0 ? <EmptyLane labelAr={label} /> : <VirtualizedCardList {...props} cardIds={cardIds} />}
    </div>
  );
}
