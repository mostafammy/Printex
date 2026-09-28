"use client";

/**
 * SubLane virtualized card list subscribing to "lane:<state>".
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, R8, plan.md S1, S5)
 *
 * A sub-lane is a FIFO work queue, so it lays out as one column. The previous
 * grid mode computed up to four lanes from the container width, which filled a
 * wide monitor by putting jobs in Z-order — destroying the one reading that
 * matters on a stalled lane, which job has been sitting there longest.
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
}

const CARD_HEIGHT = 168;

/** Stable empty result, so a missing provider does not allocate a new array
    every render and defeat the selector's reference check. */
const EMPTY_IDS: readonly string[] = Object.freeze([]);

function LaneHeader({ labelAr, count }: { readonly labelAr: string; readonly count: number }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <h3 className="text-sm font-bold text-foreground">{labelAr}</h3>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
          count === 0
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

/**
 * An empty lane is a good fact, not an absence of one. An operator reading
 * "0" against a green pill learns the station is genuinely clear; the same
 * "0" in grey next to a busy station is ambiguous.
 */
function EmptyLane({ labelAr }: { readonly labelAr: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--ticket-edge)] bg-background/40 px-3 py-4 text-xs text-muted-foreground">
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
  cardId,
  measureRef,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: {
  readonly virtualItem: { readonly index: number; readonly start: number };
  readonly cardId: string;
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
      className="absolute inset-e-0 pb-2"
      style={{ transform: `translateY(${virtualItem.start}px)` }}
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

function VirtualizedCardList(props: VirtualizedCardListProps) {
  const controller = useBoardController();
  const parentRef = useRef<HTMLDivElement>(null);
  // Prevent concurrent loadMore calls.
  const isFetchingRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: props.cardIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 4,
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
      // Always the Arabic label. The previous `labelAr ?? state` fallback
      // announced raw enums ("NEW", "WAITING_PRICING") for single-lane
      // stations; every lane has a label in stations.ts.
      aria-label={props.labelAr ?? props.state}
      className="relative flex-1 overflow-y-auto px-1"
    >
      <div
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
    EMPTY_IDS,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LaneHeader labelAr={props.labelAr ?? ""} count={cardIds.length} />
      {cardIds.length === 0 ? (
        <EmptyLane labelAr={props.labelAr ?? ""} />
      ) : (
        <VirtualizedCardList {...props} cardIds={cardIds} />
      )}
    </div>
  );
}
