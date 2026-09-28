"use client";

/**
 * SubLane virtualized card list subscribing to "lane:<state>".
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, R8, plan.md S1, S5)
 *
 * Chunked infinite scroll: an IntersectionObserver sentinel at the end of
 * the list triggers exactly one controller.loadMore() (one page) each time
 * the user reaches the bottom. No scroll-spam, no draining the table.
 */

import React, { useEffect, useRef } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
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
      className="absolute inset-x-0 pb-2"
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

function useSentinelLoadMore(
  parentRef: React.RefObject<HTMLDivElement | null>,
  sentinelRef: React.RefObject<HTMLDivElement | null>,
) {
  const controller = useBoardController();
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const root = parentRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (!visible || isFetchingRef.current) return;
        isFetchingRef.current = true;
        // One chunk per intersection; the controller no-ops at the end
        // (hasMore false), so reaching the true end stops fetching.
        void controller.loadMore().finally(() => {
          isFetchingRef.current = false;
        });
      },
      { root, rootMargin: "100px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [parentRef, sentinelRef, controller]);
}

function VirtualCardItems({
  virtualItems,
  cardIds,
  measureRef,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: {
  readonly virtualItems: readonly VirtualItem[];
  readonly cardIds: readonly string[];
  readonly measureRef: (node: HTMLDivElement | null) => void;
  readonly onOrderHover?: (id: string | null) => void;
  readonly onCardClick?: (c: BoardCard) => void;
  readonly onMoveKey?: (c: BoardCard) => void;
}) {
  return (
    <>
      {virtualItems.map((vItem) => {
        const cardId = cardIds[vItem.index];
        if (!cardId) return null;
        return (
          <VirtualRow
            key={cardId}
            virtualItem={vItem}
            cardId={cardId}
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  useSentinelLoadMore(parentRef, sentinelRef);

  const virtualizer = useVirtualizer({
    count: props.cardIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 4,
  });

  return (
    <div
      ref={parentRef}
      role="list"
      aria-label={props.labelAr ?? props.state}
      className="relative flex-1 overflow-y-auto px-1 py-1"
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        <VirtualCardItems
          virtualItems={virtualizer.getVirtualItems()}
          cardIds={props.cardIds}
          measureRef={virtualizer.measureElement}
          onOrderHover={props.onOrderHover}
          onCardClick={props.onCardClick}
          onMoveKey={props.onMoveKey}
        />
      </div>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
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
