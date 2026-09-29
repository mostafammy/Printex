"use client";

/**
 * Board container rendering the press floor board.
 * Supports a station-rail presentation and the full 7-station grid, both
 * driven from the same store, plus keyboard focus tracking.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-001, FR-020, FR-034, FR-035c)
 *
 * The header, the two grid presentations, and the overlay layer live in
 * ./views. What is left here is the container's job: the store wiring, the
 * filters, and the move-menu card it holds open.
 */

import React, { useState } from "react";
import type { SliceId } from "~/lib/board/slices";
import type { BoardCard, BoardFilters, BoardMeta, GroupMoveResult } from "~/lib/board/types";
import type { StationId } from "~/server/board";
import { ViewModeSwitcher, type BoardViewMode } from "./ViewModeSwitcher";
import { BoardHeader } from "./views/BoardHeader";
import { BoardModals } from "./views/BoardModals";
import { BoardBody } from "./views/BoardViews";
import { DndBridge } from "./dnd/DndBridge";
import { useGroupResultListener, useStationsForSlice } from "./views/useBoardChrome";
import { useBoardController } from "./hooks/useBoardController";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { useFocusRestoration } from "./hooks/useFocusRestoration";

export interface BoardProps {
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
}

interface BoardChrome {
  readonly viewMode: BoardViewMode;
  readonly setViewMode: (mode: BoardViewMode) => void;
  readonly filters: BoardFilters;
  readonly setFilters: (filters: BoardFilters) => void;
  readonly menuCard: BoardCard | null;
  readonly setMenuCard: (card: BoardCard | null) => void;
  readonly detailsCard: BoardCard | null;
  readonly setDetailsCard: (card: BoardCard | null) => void;
}

interface BoardFrameProps extends BoardProps {
  readonly meta: BoardMeta;
  readonly chrome: BoardChrome;
  readonly stationIds: readonly StationId[];
  readonly activeStationId: StationId;
  readonly groupResult: GroupMoveResult | null;
  readonly onSelectSlice: (slice: SliceId) => void;
  readonly onUpdateFilters: (filters: BoardFilters) => void;
  readonly onSelectStation: (id: StationId) => void;
  readonly onOpenMoveMenu: (card: BoardCard) => void;
  readonly onCloseMenu: () => void;
  readonly onCloseGroup: () => void;
  readonly onCloseDetails: () => void;
  readonly onCardClick: (card: BoardCard) => void;
}

function useBoardChrome(controller: ReturnType<typeof useBoardController>): BoardChrome {
  const [viewMode, setViewMode] = useState<BoardViewMode>("tabbed");
  const [filters, setFilters] = useState<BoardFilters>(() => controller.currentFilters);
  const [menuCard, setMenuCard] = useState<BoardCard | null>(null);
  const [detailsCard, setDetailsCard] = useState<BoardCard | null>(null);
  return {
    viewMode,
    setViewMode,
    filters,
    setFilters,
    menuCard,
    setMenuCard,
    detailsCard,
    setDetailsCard,
  };
}
/* eslint-disable max-lines-per-function */
function BoardFrame(props: BoardFrameProps) {
  return (
    <div
      dir="rtl"
      data-testid="press-floor-board"
      className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background"
    >
      {/* No card frame and no page padding: the station column is the frame.
          A border around the board on top of the shell's own margins read as
          a card floating on a page, and cost the lane its width twice. */}
      <BoardHeader
        activeSlice={props.meta.slice}
        availableSlices={props.meta.availableSlices}
        onSelectSlice={props.onSelectSlice}
        filters={props.chrome.filters}
        onUpdateFilters={props.onUpdateFilters}
        pagination={props.meta.pagination}
        viewSwitcher={
          <ViewModeSwitcher
            mode={props.chrome.viewMode}
            onChange={props.chrome.setViewMode}
          />
        }
      />
      {/* A div, not a <main>: the shell already renders one at layout.tsx, and
          a second nested main is invalid HTML with a duplicate landmark. */}
      {/* The drag context lives around the body only: the header holds
          filters and pagination, which are not drop targets, and keeping
          them outside keeps hover tracking scoped to the lanes. */}
      <DndBridge>
      <div
        tabIndex={0}
        role="region"
        aria-label="لوحة أرضية المطبعة"
        className="flex min-h-0 min-w-0 flex-1 overflow-hidden focus-visible:outline-hidden"
      >
        <BoardBody
          viewMode={props.chrome.viewMode}
          stationIds={props.stationIds}
          activeStationId={props.activeStationId}
          onSelectStation={props.onSelectStation}
          onOrderHover={props.onOrderHover}
          onCardClick={props.onCardClick}
          onMoveKey={props.onOpenMoveMenu}
        />
      </div>
      </DndBridge>
      <BoardModals
        card={props.chrome.menuCard}
        onCloseMenu={props.onCloseMenu}
        detailsCard={props.chrome.detailsCard}
        onCloseDetails={props.onCloseDetails}
        onOpenMoveMenu={props.onOpenMoveMenu}
        groupResult={props.groupResult}
        onCloseGroup={props.onCloseGroup}
      />
    </div>
  );
}

export function Board({ onOrderHover, onCardClick, onMoveKey }: BoardProps) {
  const controller = useBoardController();
  useFocusRestoration(controller);
  const meta = useBoardSelector("meta", () => controller.getMeta(), controller.getMeta());
  const chrome = useBoardChrome(controller);
  const [groupResult, setGroupResult] = useGroupResultListener(controller);
  const { stationIds, activeStationId, setActiveStationId } = useStationsForSlice(meta.slice);

  // Station rail by default: a 7-station board asks for a wide horizontal
  // scroll, which is the whole reason that view exists. The full board stays
  // one click away and keeps every interaction it has today.
  const openMoveMenu = (card: BoardCard) => {
    onMoveKey?.(card);
    chrome.setMenuCard(card);
  };

  const handleCardClick = (card: BoardCard) => {
    onCardClick?.(card);
    chrome.setDetailsCard(card);
  };

  return (
    <BoardFrame
      meta={meta}
      chrome={chrome}
      stationIds={stationIds}
      activeStationId={activeStationId}
      groupResult={groupResult}
      onOrderHover={onOrderHover}
      onCardClick={handleCardClick}
      onSelectSlice={(s) => void controller.switchSlice(s)}
      onUpdateFilters={(f) => {
        chrome.setFilters(f);
        void controller.updateFilters(f);
      }}
      onSelectStation={setActiveStationId}
      onOpenMoveMenu={openMoveMenu}
      onCloseMenu={() => chrome.setMenuCard(null)}
      onCloseGroup={() => setGroupResult(null)}
      onCloseDetails={() => chrome.setDetailsCard(null)}
    />
  );
}
