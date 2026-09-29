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
import { useDroppable } from "@dnd-kit/core";
import { STATIONS } from "~/lib/board/stations";
import type { StationId, WorkItemState } from "~/server/board";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { StationSummary } from "./StationSummary";
import { useDragOffer, type DropVisual } from "./dnd/useDragOffer";

export interface MobileStationTabsProps {
  readonly activeStationId: StationId;
  readonly onSelectStation: (id: StationId) => void;
  /** Restricts the list to the active slice's stations. */
  readonly stationIds?: readonly StationId[];
}

/**
 * How many jobs a station holds right now, summed over its lanes. Exported
 * because the station column's header counts the same thing, and two copies
 * of a per-lane sum are two chances for the rail and the column to disagree.
 */
export function useStationCardCount(
  id: StationId,
  lanes: readonly { readonly state: WorkItemState }[],
) {
  return useBoardSelector(
    `station-count:${id}`,
    (store) => lanes.reduce((sum, lane) => sum + store.getLane(lane.state).length, 0),
    0,
  );
}

function tabInk(id: StationId, active: boolean): React.CSSProperties {
  return {
    borderInlineStartColor: active
      ? `var(--station-${id}-fill)`
      : `color-mix(in oklch, var(--station-${id}-fill) 45%, transparent)`,
    "--station-wash": `var(--station-${id}-wash)`,
  } as React.CSSProperties;
}

/**
 * A label plate, not a chip: square corner, the station's ink as a 3px rule
 * on the reading edge, and a flat wash only when selected. The ink is present
 * whether or not the station is active, so the rail reads as a colour key for
 * the whole floor at a glance.
 *
 * The rail sits outside any [data-station] ancestor, so the --ticket-*
 * component tokens are not set here; point them at the station's semantic
 * fill and wash directly, scoped to this one button.
 *
 * The oldest-job age only earns its place when the station is busy. A 180px
 * rail showing the same "4 د" on all seven rows is noise; a stalled station
 * is the one worth surfacing, so it shows there and the empty ones stay quiet.
 */
/**
 * Rail drop highlight for one tab. Kept outside the component: the tab
 * already juggles count, ink, and active state, and the drop visuals would
 * push it past the size budget.
 */
function tabDropState(offer: DropVisual): { readonly cls: string; readonly hint: string | null } {
  if (offer === "over") return { cls: "bg-primary/15 ring-2 ring-primary", hint: "أفلت هنا" };
  if (offer === "offered") return { cls: "bg-primary/5 ring-1 ring-primary/50", hint: null };
  return { cls: "", hint: null };
}

/**
 * A rail tab is also a drop target: the tabbed view shows one station at a
 * time, so dropping a dragged card onto another station's tab is the only
 * pointer path to a different column there. The drop flows through the same
 * DragSession + DropPolicyResolver as a column drop, so sheet-gated moves
 * still pop their detail modal and refusals still fly back.
 *
 * The rail never dims: unlike columns, tabs stay the operator's map of the
 * floor mid-drag, so non-offered tabs keep full ink and only valid targets
 * light up.
 */
function tabCls(active: boolean, dropCls: string): string {
  return `mb-2 flex w-full items-center gap-2.5 rounded-[var(--board-radius)] border-s-4 px-3 py-2.5 text-start transition-colors ${
    active ? "bg-[var(--station-wash)]" : "hover:bg-muted/50"
  } ${dropCls}`;
}

function TabStatus({
  dropHint,
  count,
  laneStates,
  now,
}: {
  readonly dropHint: string | null;
  readonly count: number;
  readonly laneStates: readonly WorkItemState[];
  readonly now: number;
}) {
  return (
    <>
      {dropHint ? (
        <span className="shrink-0 text-[11px] font-bold text-primary">{dropHint}</span>
      ) : (
        <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
      {count > 0 && <StationSummary stationStates={laneStates} now={now} />}
    </>
  );
}
function useStationTabDrop(id: StationId, lanes: readonly { readonly state: WorkItemState }[]) {
  const count = useStationCardCount(id, lanes);
  const { setNodeRef } = useDroppable({ id });
  const offer = useDragOffer(id);
  return { count, setNodeRef, offer, drop: tabDropState(offer) };
}

interface StationTabProps {
  readonly id: StationId;
  readonly labelAr: string;
  readonly lanes: readonly { readonly state: WorkItemState }[];
  readonly active: boolean;
  readonly now: number;
  readonly onSelect: (id: StationId) => void;
}

function StationTab({ id, labelAr, lanes, active, now, onSelect }: StationTabProps) {
  const tab = useStationTabDrop(id, lanes);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(id)}
      ref={tab.setNodeRef}
      data-station={id}
      data-drop={tab.offer}
      aria-dropeffect={tab.drop.hint ? "move" : undefined}
      className={tabCls(active, tab.drop.cls)}
      style={tabInk(id, active)}
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
        {labelAr}
      </span>
      <TabStatus
        dropHint={tab.drop.hint}
        count={tab.count}
        laneStates={lanes.map((l) => l.state)}
        now={now}
      />
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
      // No gap: each rail button carries its own mb-2, which separates them
      // in both the stacked and any future wrapped layout.
      className="flex shrink-0 flex-col overflow-y-auto p-2"
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
