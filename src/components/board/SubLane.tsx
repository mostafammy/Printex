"use client";

/**
 * SubLane virtualized card list subscribing to "lane:<state>".
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, R8, plan.md S1, S5)
 *
 * Infinite scroll fix: replaces the useEffect-on-lastIndex approach (which
 * fired on every render) with a scroll event listener that only triggers when
 * the scroll container genuinely reaches the bottom. An `isFetchingRef` ref
 * prevents concurrent `loadMore()` calls.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { WorkItemState } from "~/server/board";
import type { BoardCard } from "~/lib/board/types";
import { useBoardController } from "./hooks/useBoardController";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { JobTicket } from "./JobTicket";

export interface SubLaneProps {
  readonly state: WorkItemState;
  readonly labelAr?: string;
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
  /**
   * Lay cards out in a responsive grid instead of one per row. Set by the
   * tabbed board view, where a single station owns the full viewport width
   * and a single column would leave most of it empty.
   */
  readonly grid?: boolean;
}

/** Narrowest a job ticket can be before its fields start wrapping badly. */
const CARD_MIN_WIDTH = 260;
const CARD_GAP = 8;

/**
 * Tracks an element's content-box width. `contentRect` excludes padding, so
 * this is the width actually available to cards.
 */
function useContentWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (w: number) =>
      setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    measure(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measure(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

interface VirtualizedCardListProps extends SubLaneProps {
  readonly cardIds: readonly string[];
}

function VirtualRow({
  virtualItem,
  cardId,
  measureRef,
  grid,
  lanes,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: {
  readonly virtualItem: { readonly index: number; readonly start: number };
  readonly cardId: string;
  readonly measureRef: (node: HTMLDivElement | null) => void;
  readonly grid: boolean;
  readonly lanes: number;
  readonly onOrderHover?: (id: string | null) => void;
  readonly onCardClick?: (c: BoardCard) => void;
  readonly onMoveKey?: (c: BoardCard) => void;
}) {
  return (
    <div
      data-index={virtualItem.index}
      ref={measureRef}
      role="listitem"
      // Single column: `inset-x-0` pins each row to the full lane width,
      // which is what a one-ticket-per-row list wants.
      // Grid: the virtualizer positions the row vertically only, so the
      // width has to come from the lane count and the box needs an explicit
      // start inset — an absolutely positioned element with no inset falls
      // to its static position, which in RTL is the right edge.
      className={`absolute start-0 pb-2 ${grid ? "" : "inset-e-0"}`}
      style={{
        transform: `translateY(${virtualItem.start}px)`,
        width: grid ? `calc(100% / ${lanes})` : undefined,
      }}
    >
      <JobTicket
        cardId={cardId}
        onOrderHover={onOrderHover}
        onClick={onCardClick}
        onMoveKey={onMoveKey}
      />
    </div>
  );
}

function EmptyLanePlaceholder({ labelAr, state }: { readonly labelAr?: string; readonly state: string }) {
  return (
    <div
      role="list"
      aria-label={labelAr ?? state}
      className="flex h-20 items-center justify-center text-xs text-muted-foreground select-none"
    >
      لا توجد عناصر
    </div>
  );
}

function VirtualizedCardList(props: VirtualizedCardListProps) {
  const controller = useBoardController();
  const parentRef = useRef<HTMLDivElement>(null);
  const [measureRef, containerWidth] = useContentWidth<HTMLDivElement>();
  // Prevent concurrent loadMore calls.
  const isFetchingRef = useRef(false);

  // Card grid: as many tickets per row as fit at CARD_MIN_WIDTH. Falls back
  // to 1 before the first measurement so the first paint is a single column
  // rather than a grid sized against a zero-width container.
  const lanes = props.grid
    ? containerWidth > 0
      ? Math.max(1, Math.floor(containerWidth / CARD_MIN_WIDTH))
      : 1
    : 1;

  const virtualizer = useVirtualizer({
    count: props.cardIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 4,
    lanes,
    gap: props.grid ? CARD_GAP : 0,
  });

  // Stable scroll handler — fires only when user scrolls near the bottom.
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el || isFetchingRef.current) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Trigger when within 120px of the bottom (one card height).
    if (distanceFromBottom < 120) {
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

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      role="list"
      aria-label={props.labelAr ?? props.state}
      className="relative flex-1 overflow-y-auto px-1 py-1"
    >
      <div
        ref={props.grid ? measureRef : undefined}
        style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}
      >
        {virtualItems.map((vItem) => {
          const cardId = props.cardIds[vItem.index];
          if (!cardId) return null;
          return (
            <VirtualRow
              key={cardId}
              virtualItem={vItem}
              cardId={cardId}
              measureRef={virtualizer.measureElement}
              grid={props.grid === true}
              lanes={lanes}
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

export function SubLane(props: SubLaneProps) {
  const cardIds = useBoardSelector(
    `lane:${props.state}`,
    (s) => s.getLane(props.state),
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {props.labelAr && (
        <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground">
          <span>{props.labelAr}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px]">
            {cardIds.length}
          </span>
        </div>
      )}
      {cardIds.length === 0 ? (
        <EmptyLanePlaceholder labelAr={props.labelAr} state={props.state} />
      ) : (
        <VirtualizedCardList {...props} cardIds={cardIds} />
      )}
    </div>
  );
}
