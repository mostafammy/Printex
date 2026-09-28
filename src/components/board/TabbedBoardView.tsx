"use client";

/**
 * TabbedBoardView: the focused presentation of the press floor board. Renders
 * ONE StationColumn at a time behind a station tab bar, so a 7-station board
 * stops demanding a wide horizontal scroll.
 *
 * This is a presentation layer only. The stations, lanes, cards, store, and
 * every drop target come from the same StationColumn / SubLane / BoardStore
 * the full board uses, so drag-and-drop, live updates, sheets, and card
 * interactions are identical in both views. Nothing about the board engine is
 * duplicated here.
 */

import React, { useMemo } from "react";
import { STATIONS, type StationId } from "~/lib/board/stations";
import { StationColumn } from "./StationColumn";
import { MobileStationTabs } from "./MobileStationTabs";
import type { BoardCard } from "~/lib/board/types";

export interface TabbedBoardViewProps {
  readonly activeStationId: StationId;
  readonly onSelectStation: (id: StationId) => void;
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
}

export function TabbedBoardView({
  activeStationId,
  onSelectStation,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: TabbedBoardViewProps) {
  const activeStation = useMemo(
    () => STATIONS.find((s) => s.id === activeStationId) ?? STATIONS[0]!,
    [activeStationId],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Station tabs. MobileStationTabs is the same component the phone
          board already uses, so the tab affordance is identical across
          breakpoints — phoneOnly={false} unhides it at every width rather
          than duplicating it. */}
      <MobileStationTabs
        activeStationId={activeStationId}
        onSelectStation={onSelectStation}
        phoneOnly={false}
      />

      <div className="flex min-h-0 flex-1 p-4">
        <StationColumn
          station={activeStation}
          onOrderHover={onOrderHover}
          onCardClick={onCardClick}
          onMoveKey={onMoveKey}
          fillWidth
        />
      </div>
    </div>
  );
}
