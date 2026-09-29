"use client";

/**
 * The two grid presentations of the press floor board: the horizontally
 * scrolling 7-station board for wide screens, and the single-station frame
 * for phones.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-001, FR-020, FR-034, FR-035c)
 *
 * Split out of Board.tsx, which is the container deciding *which* view is on
 * screen. Neither view is a container concern, and inlining both put the
 * container past the component size budget.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { STATIONS } from "~/lib/board/stations";
import type { StationId } from "~/server/board";
import type { BoardCard } from "~/lib/board/types";
import { StationColumn } from "../StationColumn";
import { MobileStationTabs } from "../MobileStationTabs";
import { TabbedBoardView } from "../TabbedBoardView";
import type { BoardViewMode } from "../ViewModeSwitcher";

export interface BoardSurfaceProps {
  readonly stationIds: readonly StationId[];
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey: (card: BoardCard) => void;
}

/** A vertical wheel gesture becomes horizontal board travel. */
function onWheelHorizontal(e: React.WheelEvent<HTMLDivElement>) {
  const el = e.currentTarget.querySelector<HTMLElement>("[data-board-scroll]");
  if (!el || el.scrollWidth <= el.clientWidth) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();
  el.scrollLeft += e.deltaY;
}

/**
 * A 7-station board is wider than most screens, and the overflow was
 * invisible: the last column rendered sliced mid-card with a truncated header
 * and no hint that it continued. In RTL the overflow runs to the left, so
 * the scroll direction and the "more stations" hint have to be on the start
 * side.
 */
function useScrollEdges(ref: React.RefObject<HTMLDivElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft > 4,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, [ref]);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, ref]);

  return edges;
}

export interface BoardViewProps extends BoardSurfaceProps {
  readonly viewMode: BoardViewMode;
  readonly activeStationId: StationId;
  readonly onSelectStation: (id: StationId) => void;
}

export function BoardBody(props: BoardViewProps) {
  if (props.viewMode === "tabbed") {
    return (
      <TabbedBoardView
        activeStationId={props.activeStationId}
        onSelectStation={props.onSelectStation}
        stationIds={props.stationIds}
        onOrderHover={props.onOrderHover}
        onCardClick={props.onCardClick}
        onMoveKey={props.onMoveKey}
      />
    );
  }
  return (
    <>
      <FullBoardGrid {...props} />
      <PhoneBoard {...props} />
    </>
  );
}

export function FullBoardGrid(props: BoardSurfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(scrollRef);

  return (
    <div
      className="relative hidden min-h-0 min-w-0 flex-1 lg:flex"
      // The board is a long horizontal strip on purpose; letting a wheel or
      // trackpad gesture page-scroll instead of shifting between stations
      // meant a two-station nudge scrolled the whole app away.
      onWheel={onWheelHorizontal}
    >
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
        data-board-scroll=""
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

export function PhoneBoard(props: BoardSurfaceProps) {
  const [activeId, setActiveId] = useState<StationId>(props.stationIds[0] ?? "reception");
  useEffect(() => {
    const first = props.stationIds[0];
    if (first && !props.stationIds.includes(activeId)) setActiveId(first);
  }, [props.stationIds, activeId]);

  const activeStation = STATIONS.find((s) => s.id === activeId) ?? STATIONS[0]!;

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
