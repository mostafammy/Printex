"use client";

/**
 * Board container rendering the 7-station RTL press floor board grid.
 * Supports responsive phone column switching and keyboard focus tracking.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-001, FR-020, FR-034, FR-035c)
 */

import React, { useEffect, useMemo, useState } from "react";
import { STATIONS } from "~/lib/board/stations";
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
import type { BoardFilters, SliceId } from "~/lib/board/types";

export interface BoardProps {
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
}

function DesktopBoardGrid(props: BoardProps) {
  return (
    <div className="hidden sm:flex flex-1 gap-3 overflow-x-auto p-4 select-none">
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
  );
}

function MobileBoardGrid({
  props,
  activeId,
}: {
  readonly props: BoardProps;
  readonly activeId: StationId;
}) {
  const activeStation = useMemo(
    () => STATIONS.find((s) => s.id === activeId) ?? STATIONS[0]!,
    [activeId],
  );

  return (
    <div className="flex sm:hidden flex-1 overflow-y-auto p-2">
      <StationColumn
        station={activeStation}
        onOrderHover={props.onOrderHover}
        onCardClick={props.onCardClick}
        onMoveKey={props.onMoveKey}
      />
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

/**
 * Chooses between the two presentations. Both branches render the same
 * StationColumn components from the same store, so only the arrangement
 * differs — the full board keeps DesktopBoardGrid + MobileBoardGrid exactly
 * as they were.
 */
function BoardBody({
  viewMode,
  activeStationId,
  onSelectStation,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: {
  readonly viewMode: BoardViewMode;
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
        onOrderHover={onOrderHover}
        onCardClick={onCardClick}
        onMoveKey={onMoveKey}
      />
    );
  }
  return (
    <>
      <DesktopBoardGrid onOrderHover={onOrderHover} onCardClick={onCardClick} onMoveKey={onMoveKey} />
      <MobileBoardGrid props={{ onOrderHover, onCardClick, onMoveKey }} activeId={activeStationId} />
    </>
  );
}

export function Board({ onOrderHover, onCardClick, onMoveKey }: BoardProps) {
  const controller = useBoardController();
  useFocusRestoration(controller);
  const meta = useBoardSelector("meta", () => controller.getMeta());

  const [menuCard, setMenuCard] = useState<BoardCard | null>(null);
  const [activeMobileId, setActiveMobileId] = useState<StationId>("reception");
  const [groupResult, setGroupResult] = useGroupResultListener(controller);
  const [filters, setFilters] = useState<BoardFilters>(() => controller.currentFilters);
  // Tabbed by default: a 7-station board asks for a wide horizontal scroll,
  // which is the whole reason this view exists. The full board stays one
  // click away and keeps every interaction it has today.
  const [viewMode, setViewMode] = useState<BoardViewMode>("tabbed");

  const handleSlice = (s: SliceId) => { void controller.switchSlice(s); };
  const handleFilters = (f: BoardFilters) => { setFilters(f); void controller.updateFilters(f); };
  const handleKey = (c: BoardCard) => { onMoveKey?.(c); setMenuCard(c); };

  return (
    <div dir="rtl" data-testid="press-floor-board" className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      <SliceSwitcher
        activeSlice={meta.slice}
        availableSlices={meta.availableSlices}
        onSelectSlice={handleSlice}
        filters={filters}
        onUpdateFilters={handleFilters}
        pagination={meta.pagination}
        viewSwitcher={<ViewModeSwitcher mode={viewMode} onChange={setViewMode} />}
      />
      {viewMode === "full" && (
        <MobileStationTabs activeStationId={activeMobileId} onSelectStation={setActiveMobileId} />
      )}
      <main tabIndex={0} aria-label="لوحة أرضية المطبعة" className="flex flex-1 overflow-hidden focus-visible:outline-hidden">
        <BoardBody
          viewMode={viewMode}
          activeStationId={activeMobileId}
          onSelectStation={setActiveMobileId}
          onOrderHover={onOrderHover}
          onCardClick={onCardClick}
          onMoveKey={handleKey}
        />
      </main>
      <BoardModals card={menuCard} onCloseMenu={() => setMenuCard(null)} groupResult={groupResult} onCloseGroup={() => setGroupResult(null)} />
    </div>
  );
}
