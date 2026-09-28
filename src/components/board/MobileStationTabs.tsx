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
  /**
   * Horizontal strip under a toolbar (the old phone affordance) rather than
   * the full-board side rail. Kept so the phone layout can stay compact.
   */
  readonly phoneOnly?: boolean;
}

function StationTab({
  id,
  labelAr,
  ink,
  lanes,
  active,
  now,
  onSelect,
}: {
  readonly id: StationId;
  readonly labelAr: string;
  readonly ink: string;
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
      className={`flex w-full items-center gap-2.5 rounded-lg border-s-4 px-3 py-2.5 text-start transition-colors ${
        active
          ? "border-s-[var(--ticket-bar)] bg-[var(--ticket-wash)]"
          : "border-s-transparent hover:bg-muted/50"
      }`}
      style={{ ["--ticket-bar" as string]: `var(--ink-${ink})` }}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
        {labelAr}
      </span>
      <span className="text-xs font-bold tabular-nums text-muted-foreground">{count}</span>
      <StationSummary stationStates={lanes.map((l) => l.state)} now={now} />
    </button>
  );
}

export const MobileStationTabs = React.memo(function MobileStationTabs({
  activeStationId,
  onSelectStation,
  stationIds,
  phoneOnly = false,
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
      className={`flex shrink-0 flex-col gap-1 overflow-y-auto p-2 ${
        phoneOnly ? "sm:hidden" : ""
      }`}
    >
      {list.map((st) => (
        <StationTab
          key={st.id}
          id={st.id}
          labelAr={st.labelAr}
          ink={st.ink}
          lanes={st.lanes}
          active={st.id === activeStationId}
          now={now}
          onSelect={onSelectStation}
        />
      ))}
    </nav>
  );
});
