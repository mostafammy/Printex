"use client";

/**
 * Lane virtualization: windowing a lane's cards into measured rows.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, R8,
 *  plan.md S1, S5)
 *
 * Split out of SubLane.tsx, which is about lane identity and layout; this is
 * about the windowing maths and the row markup. Both follow 817f251/main:
 * a fixed row height so a lane reads as a grid rather than a staircase, flex
 * tracks rather than grid `1fr` (a grid cell can resolve `1fr` to a
 * zero-basis track against a min-content intrinsic size, which collapsed the
 * cards), and margins on the cards so a single-column lane breathes
 * vertically as well as horizontally.
 */

import { useEffect, type RefObject } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import type { BoardCard } from "~/lib/board/types";
import { JobTicket } from "../JobTicket";

/**
 * Card height, including the margins each card carries. A mismatch between
 * this estimate and the rendered row means the last visible row of a long
 * lane clips while its neighbours are fine, and the next scroll snaps it back.
 */
export const CARD_HEIGHT = 148;

export interface LaneVirtualizerResult {
  readonly virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, HTMLDivElement>>;
}

export function useLaneVirtualizer(
  parentRef: RefObject<HTMLDivElement | null>,
  cardCount: number,
  columns: number,
): LaneVirtualizerResult {
  // Explicit generics: without them TS infers TItemElement as the bare
  // `Element` and the result no longer matches LaneVirtualizerResult.
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: Math.ceil(cardCount / columns),
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
  }, [columns, parentRef]);

  return { virtualizer };
}

export function VirtualRow({
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

          Spacing is m-2 on each card rather than a gap on the row: a gap
          only separates horizontally, so a lane rendered as a single column
          had cards touching. Margin on the card itself gives the same
          breathing room in both axes.

          The row is a fixed height and the card stretches to fill it, so
          every ticket in a row is the same height. */}
      <div className="flex" style={{ height: `${CARD_HEIGHT}px` }}>
        {cardIds.map((cardId) => (
          <div key={cardId} className="m-2 flex min-w-0 flex-1" style={{ flexBasis: 0 }}>
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

export function VirtualCardItems({
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
