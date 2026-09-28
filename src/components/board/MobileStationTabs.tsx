"use client";

/**
 * MobileStationTabs: a vertical rail of station cards.
 * (specs/017-press-floor-board/spec.md FR-035c, SC-010, plan.md S1)
 *
 * Each entry carries count, oldest-job age, and its station ink, so an
 * operator can read the whole floor without tapping anything. Previously a
 * horizontally-scrolling strip of chips, which hid five of seven stations
 * behind a swipe with no scroll cue, and duplicated the slice row's shape
 * so the two could not be told apart.
 *
 * The station list comes from the active slice, so a role view showing one
 * station shows one tab rather than seven (six of them dead).
 */

import React from "react";
import { STATIONS } from "~/lib/board/stations";
import type { StationId } from "~/server/board";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { StationSummary } from "./StationSummary";

export interface MobileStationTabsProps {
  readonly activeStationId: StationId;
  readonly onSelectStation: (id: StationId) => void;
  /** Restricts the list to the active slice's stations. */
  readonly stationIds?: readonly StationId[];
}

function StationTab({
  id,
  labelAr,
  lanes,
  active,
  now,
  onSelect,
}: {
  readonly id: StationId;
  readonly labelAr: string;
  readonly lanes: readonly { readonly state: string }[];
  readonly active: boolean;
  readonly now: number;
  readonly onSelect: (id: StationId) => void;
}) {
  const count = useBoardSelector(
    `station-count:${id}`,
    (store) => {
      let sum = 0;
      for (const lane of lanes) sum += store.getLane(lane.state as never).length;
      return sum;
    },
    0,
  );

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(id)}
      data-station={id}
      // A label plate, not a chip: square corner, the station's ink as a 3px
      // rule on the reading edge, and a flat wash only when selected. The ink
      // is present whether or not the station is active, so the rail reads as
      // a colour key for the whole floor at a glance.
      //
      // The rail is outside any [data-station] ancestor, so the --ticket-*
      // component tokens are not set here; point them at the station's
      // semantic fill and wash directly, scoped to this one button.
      className={`flex w-full items-center gap-2 rounded-[var(--board-radius)] border-s-[3px] px-2 py-2 text-start transition-colors ${
        active ? "bg-[var(--station-wash)]" : "hover:bg-muted/50"
      }`}
      style={
        {
          borderInlineStartColor: active
            ? `var(--station-${id}-fill)`
            : `color-mix(in oklch, var(--station-${id}-fill) 45%, transparent)`,
          "--station-wash": `var(--station-${id}-wash)`,
        } as React.CSSProperties
      }
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
        {labelAr}
      </span>
      <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
        {count}
      </span>
      <StationSummary stationStates={lanes.map((l) => l.state)} now={now} />
    </button>
  );
}

export const MobileStationTabs = React.memo(function MobileStationTabs({
  activeStationId,
  onSelectStation,
  stationIds,
}: MobileStationTabsProps) {
  // Read once per render, not through a store selector: `Date.now()` returns
  // a fresh value on every snapshot read, which re-renders forever and trips
  // the board's idle-animation invariant (SC-007).
  const now = Date.now();
  const list = stationIds ? STATIONS.filter((s) => stationIds.includes(s.id)) : STATIONS;

  return (
    <nav
      role="tablist"
      aria-label="محطات المطبعة"
      className="flex shrink-0 flex-col gap-px overflow-y-auto p-2"
    >
      {list.map((st) => (
        <StationTab
          key={st.id}
          id={st.id}
          labelAr={st.labelAr}
          lanes={st.lanes}
          active={st.id === activeStationId}
          now={now}
          onSelect={onSelectStation}
        />
      ))}
    </nav>
  );
});
