"use client";

/**
 * SubLane virtualized card list subscribing to "lane:<state>".
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, R8, plan.md S1, S5)
 *
 * Chunked per-lane infinite scroll: an IntersectionObserver sentinel at
 * the end of the list triggers exactly one loadMore(state) (one page for
 * this lane only) each time the user reaches the bottom.
 */

import React, { useCallback, useRef, useState } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import type { WorkItemState } from "~/server/board";
import type { BoardCard } from "~/lib/board/types";
import { useBoardController } from "./hooks/useBoardController";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { useFreshIds } from "./hooks/useFreshIds";
import { useSentinelLoadMore } from "./hooks/useSentinelLoadMore";
import { JobTicket } from "./JobTicket";
import { LanePageControl } from "./LanePageControl";
import { LaneSkeleton } from "./LaneSkeleton";

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
  freshIndex,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: {
  readonly virtualItem: { readonly index: number; readonly start: number };
  readonly cardId: string;
  readonly measureRef: (node: HTMLDivElement | null) => void;
  readonly freshIndex: number;
  readonly onOrderHover?: (id: string | null) => void;
  readonly onCardClick?: (c: BoardCard) => void;
  readonly onMoveKey?: (c: BoardCard) => void;
}) {
  const fresh = freshIndex >= 0;
  return (
    <div
      data-index={virtualItem.index}
      ref={measureRef}
      role="listitem"
      className={`absolute inset-x-0 pb-2${fresh ? " lane-card-enter" : ""}`}
      style={{
        transform: `translateY(${virtualItem.start}px)`,
        animationDelay: fresh ? `${Math.min(freshIndex, 5) * 45}ms` : undefined,
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

function VirtualCardItems({
  virtualItems,
  cardIds,
  measureRef,
  fresh,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: {
  readonly virtualItems: readonly VirtualItem[];
  readonly cardIds: readonly string[];
  readonly measureRef: (node: HTMLDivElement | null) => void;
  readonly fresh: readonly string[];
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
            freshIndex={fresh.indexOf(cardId)}
            onOrderHover={onOrderHover}
            onCardClick={onCardClick}
            onMoveKey={onMoveKey}
          />
        );
      })}
    </>
  );
}

function useLaneLoadNext(state: WorkItemState) {
  const controller = useBoardController();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadNext = useCallback(() => {
    if (loadingRef.current) return Promise.resolve();
    loadingRef.current = true;
    setLoading(true);
    return controller.loadMore(state).finally(() => {
      loadingRef.current = false;
      setLoading(false);
    });
  }, [controller, state]);

  return { loading, loadNext };
}

function VirtualizedCardList(props: VirtualizedCardListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { loading, loadNext } = useLaneLoadNext(props.state);
  const fresh = useFreshIds(props.cardIds);
  useSentinelLoadMore(parentRef, sentinelRef, loadNext);

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
      className="relative flex-1 overflow-y-auto overscroll-contain px-1 py-1"
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        <VirtualCardItems
          virtualItems={virtualizer.getVirtualItems()}
          cardIds={props.cardIds}
          measureRef={virtualizer.measureElement}
          fresh={fresh}
          onOrderHover={props.onOrderHover}
          onCardClick={props.onCardClick}
          onMoveKey={props.onMoveKey}
        />
      </div>
      {loading && <LaneSkeleton />}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      <LanePageControl state={props.state} loaded={props.cardIds.length} loading={loading} onLoadMore={loadNext} />
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
