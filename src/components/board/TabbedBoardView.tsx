"use client";

/**
 * TabbedBoardView: the station-rail presentation of the press floor board.
 * One StationColumn at a time beside a rail of station cards, so a 7-station
 * board stops demanding a wide horizontal scroll.
 *
 * This is a presentation layer only. The stations, lanes, cards, store, and
 * every drop target come from the same StationColumn / SubLane / BoardStore
 * the full board uses, so drag-and-drop, live updates, sheets, and card
 * interactions are identical in both views. Nothing about the board engine
 * is duplicated here.
 */

import React, { useMemo } from "react";
import { STATIONS, type StationId } from "~/lib/board/stations";
import { StationColumn } from "./StationColumn";
import { MobileStationTabs } from "./MobileStationTabs";
import type { BoardCard } from "~/lib/board/types";

export interface TabbedBoardViewProps {
  readonly activeStationId: StationId;
  readonly onSelectStation: (id: StationId) => void;
  readonly stationIds?: readonly StationId[];
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
}

export function TabbedBoardView({
  activeStationId,
  onSelectStation,
  stationIds,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: TabbedBoardViewProps) {
  const visibleStations = useMemo(
    () => (stationIds ? STATIONS.filter((s) => stationIds.includes(s.id)) : STATIONS),
    [stationIds],
  );

  // A slice that no longer contains the selected station would render an
  // empty column, so the first visible station is the floor when it matches.
  const activeStation = useMemo(() => {
    const match = visibleStations.find((s) => s.id === activeStationId);
    return match ?? visibleStations[0] ?? STATIONS[0]!;
  }, [visibleStations, activeStationId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <MobileStationTabs
        activeStationId={activeStation.id}
        onSelectStation={onSelectStation}
        stationIds={visibleStations.map((s) => s.id)}
      />
      <div
        role="tabpanel"
        aria-label={activeStation.labelAr}
        className="flex min-h-0 flex-1 flex-col p-3 sm:p-4"
      >
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
