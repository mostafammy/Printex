"use client";

/**
 * Board container rendering the press floor board.
 * Supports a station-rail presentation and the full 7-station grid, both
 * driven from the same store, plus keyboard focus tracking.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-001, FR-020, FR-034, FR-035c)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATIONS } from "~/lib/board/stations";
import { SLICES, type SliceId } from "~/lib/board/slices";
import type { StationId } from "~/server/board";
import type { BoardCard, GroupMoveResult } from "~/lib/board/types";
import { StationColumn } from "./StationColumn";
import { SheetHost } from "./SheetHost";
import { MoveToMenu } from "./MoveToMenu";
import { LiveIndicator } from "./LiveIndicator";
import { GroupResultSheet } from "./GroupResultSheet";
import { MobileStationTabs } from "./MobileStationTabs";
import { SliceSwitcher } from "./SliceSwitcher";
import { TabbedBoardView } from "./TabbedBoardView";
import { ViewModeSwitcher, type BoardViewMode } from "./ViewModeSwitcher";
import { useBoardController } from "./hooks/useBoardController";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { useFocusRestoration } from "./hooks/useFocusRestoration";
import type { FeedbackCenter } from "~/lib/board/feedback/FeedbackCenter";
import type { BoardFilters } from "~/lib/board/types";

export interface BoardProps {
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
}

function FullBoardGrid(props: BoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  // A 7-station board is wider than most screens, and the overflow was
  // invisible: the last column rendered sliced mid-card with a truncated
  // header and no hint that it continued. In RTL the overflow runs to the
  // left, so the scroll direction and the "more stations" hint have to be
  // on the start side.
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft > 4,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <div className="relative hidden min-h-0 min-w-0 flex-1 lg:flex">
      {/* Edge fades are the affordance: they mark the cut and say which way
          to scroll. `pointer-events-none` so they never eat a drag. */}
      {edges.start && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-0 z-10 w-10 bg-gradient-to-r from-background to-transparent"
        />
      )}
      {edges.end && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 end-0 z-10 w-10 bg-gradient-to-l from-background to-transparent"
        />
      )}
      <div
        ref={scrollRef}
        // min-h-0 on the scroller and on each column: a flex child defaults to
        // min-height:auto, so without it the columns grow to their content and
        // the horizontal scroller never becomes scrollable in either axis.
        className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-4 select-none"
      >
        {STATIONS.map((station) => (
          <StationColumn
            key={station.id}
            station={station}
            onOrderHover={props.onOrderHover}
            onCardClick={props.onCardClick}
            onMoveKey={props.onMoveKey}
          />
        ))}
      </div>
    </div>
  );
}

function PhoneBoard(props: BoardProps & { readonly stationIds: readonly StationId[] }) {
  const [activeId, setActiveId] = useState<StationId>(props.stationIds[0] ?? "reception");
  const activeStation = useMemo(
    () => STATIONS.find((s) => s.id === activeId) ?? STATIONS[0]!,
    [activeId],
  );
  const first = props.stationIds[0];
  useEffect(() => {
    if (first && !props.stationIds.includes(activeId)) setActiveId(first);
  }, [first, props.stationIds, activeId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:hidden">
      <MobileStationTabs
        activeStationId={activeStation.id}
        onSelectStation={setActiveId}
        stationIds={props.stationIds}
      />
      <div className="flex min-h-0 flex-1 flex-col p-2">
        <StationColumn
          station={activeStation}
          onOrderHover={props.onOrderHover}
          onCardClick={props.onCardClick}
          onMoveKey={props.onMoveKey}
          fillWidth
        />
      </div>
    </div>
  );
}

function useGroupResultListener(controller: ReturnType<typeof useBoardController>) {
  const [result, setResult] = useState<GroupMoveResult | null>(null);
  useEffect(() => {
    if (!controller?.feedback) return;
    const center = controller.feedback as FeedbackCenter;
    return center.subscribe?.((e) => {
      if (e.type === "GROUP_MOVE_DONE") setResult(e.result);
    });
  }, [controller]);
  return [result, setResult] as const;
}

function BoardModals({
  card,
  onCloseMenu,
  groupResult,
  onCloseGroup,
}: {
  readonly card: BoardCard | null;
  readonly onCloseMenu: () => void;
  readonly groupResult: GroupMoveResult | null;
  readonly onCloseGroup: () => void;
}) {
  return (
    <>
      <SheetHost />
      <MoveToMenu card={card} isOpen={Boolean(card)} onClose={onCloseMenu} />
      <GroupResultSheet result={groupResult} isOpen={Boolean(groupResult)} onClose={onCloseGroup} />
      <LiveIndicator />
    </>
  );
}

function BoardBody({
  viewMode,
  stationIds,
  activeStationId,
  onSelectStation,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: {
  readonly viewMode: BoardViewMode;
  readonly stationIds: readonly StationId[];
  readonly activeStationId: StationId;
  readonly onSelectStation: (id: StationId) => void;
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey: (card: BoardCard) => void;
}) {
  if (viewMode === "tabbed") {
    return (
      <TabbedBoardView
        activeStationId={activeStationId}
        onSelectStation={onSelectStation}
        stationIds={stationIds}
        onOrderHover={onOrderHover}
        onCardClick={onCardClick}
        onMoveKey={onMoveKey}
      />
    );
  }
  return (
    <>
      <FullBoardGrid onOrderHover={onOrderHover} onCardClick={onCardClick} onMoveKey={onMoveKey} />
      <PhoneBoard
        onOrderHover={onOrderHover}
        onCardClick={onCardClick}
        onMoveKey={onMoveKey}
        stationIds={stationIds}
      />
    </>
  );
}

export function Board({ onOrderHover, onCardClick, onMoveKey }: BoardProps) {
  const controller = useBoardController();
  useFocusRestoration(controller);
  const meta = useBoardSelector("meta", () => controller.getMeta(), controller.getMeta());

  const [menuCard, setMenuCard] = useState<BoardCard | null>(null);
  const [groupResult, setGroupResult] = useGroupResultListener(controller);
  const [filters, setFilters] = useState<BoardFilters>(() => controller.currentFilters);
  // Station rail by default: a 7-station board asks for a wide horizontal
  // scroll, which is the whole reason this view exists. The full board stays
  // one click away and keeps every interaction it has today.
  const [viewMode, setViewMode] = useState<BoardViewMode>("tabbed");

  // The slice already declares which stations it covers. Opening on a
  // hardcoded "reception" landed a designer on the one station they never
  // touch, and rendered six dead tabs under a single-station slice.
  const stationIds = useMemo(() => {
    const slice = SLICES.find((s) => s.id === meta.slice);
    return slice ? slice.stations : STATIONS.map((s) => s.id);
  }, [meta.slice]);

  const [activeStationId, setActiveStationId] = useState<StationId>(stationIds[0] ?? "reception");
  useEffect(() => {
    if (!stationIds.includes(activeStationId)) setActiveStationId(stationIds[0] ?? "reception");
  }, [stationIds, activeStationId]);

  const handleSlice = (s: SliceId) => { void controller.switchSlice(s); };
  const handleFilters = (f: BoardFilters) => { setFilters(f); void controller.updateFilters(f); };

  const openMoveMenu = (card: BoardCard) => {
    onCardClick?.(card);
    onMoveKey?.(card);
    setMenuCard(card);
  };

  return (
    <div dir="rtl" data-testid="press-floor-board" className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background">
      {/* No card frame and no page padding: the station column is the frame.
          A border around the board on top of the shell's own margins read as
          a card floating on a page, and cost the lane its width twice. */}
      <SliceSwitcher
        activeSlice={meta.slice}
        availableSlices={meta.availableSlices}
        onSelectSlice={handleSlice}
        filters={filters}
        onUpdateFilters={handleFilters}
        pagination={meta.pagination}
        viewSwitcher={<ViewModeSwitcher mode={viewMode} onChange={setViewMode} />}
      />
      {/* A div, not a <main>: the shell already renders one at layout.tsx, and
          a second nested main is invalid HTML with a duplicate landmark. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="لوحة أرضية المطبعة"
        className="flex min-h-0 min-w-0 flex-1 overflow-hidden focus-visible:outline-hidden"
      >
        <BoardBody
          viewMode={viewMode}
          stationIds={stationIds}
          activeStationId={activeStationId}
          onSelectStation={setActiveStationId}
          onOrderHover={onOrderHover}
          onCardClick={onCardClick}
          onMoveKey={openMoveMenu}
        />
      </div>
      <BoardModals card={menuCard} onCloseMenu={() => setMenuCard(null)} groupResult={groupResult} onCloseGroup={() => setGroupResult(null)} />
    </div>
  );
}
