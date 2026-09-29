"use client";

/**
 * StationColumn rendering the station header, ink-tinted frame, count, oldest
 * job age, sub-lanes, and live drop-target feedback.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-001, FR-002, FR-006;
 *  visual treatment from 817f251 "live drop-target feedback and polished drag motion")
 *
 * The station is the primary visual object on this board, so it owns the
 * colour: `ink.css` exposes `--station-<id>-{wash,edge,fill,text}` through the
 * `[data-station]` remap, and this component is where those tokens reach the
 * screen.
 *
 * The drop states are three, not two. "over" is distinct from "offered": a
 * column the card is currently hovering is pulsing under the pointer, while
 * a merely-valid column is merely ringed. Collapsing them loses the one
 * signal a floor operator reads mid-drag.
 */

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Inbox,
  Palette,
  CheckCheck,
  Calculator,
  Printer,
  PackageCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { Station } from "~/lib/board/stations";
import type { BoardCard } from "~/lib/board/types";
import { SubLane } from "./SubLane";
import { StationSummary } from "./StationSummary";
import { useStationCardCount, useStationCardTotal, formatLaneCount } from "./MobileStationTabs";

import { useDragOffer } from "./dnd/useDragOffer";

const ICONS: Readonly<Record<string, LucideIcon>> = {
  Inbox,
  Palette,
  CheckCheck,
  Calculator,
  Printer,
  PackageCheck,
  Truck,
};

/** Three visual states, not two: `over` is the column under the pointer. */
export type DropVisual = "idle" | "offered" | "dimmed" | "over";

export interface StationColumnProps {
  readonly station: Station;
  readonly dropState?: DropVisual;
  readonly blockedHint?: string;
  readonly onOrderHover?: (orderId: string | null) => void;
  readonly onCardClick?: (card: BoardCard) => void;
  readonly onMoveKey?: (card: BoardCard) => void;
  /**
   * Drop the fixed column width and fill the container. The 280–340px width
   * only makes sense when seven columns share the board; the tabbed view
   * shows one station at a time, and there capping it leaves the rest of the
   * viewport empty.
   */
  readonly fillWidth?: boolean;
}

function ColumnHeader({
  station,
  countLabel,
  now,
}: {
  readonly station: Station;
  readonly countLabel: string;
  readonly now: number;
}) {
  const IconComponent = ICONS[station.icon] ?? Inbox;
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
          <IconComponent className="h-4 w-4" aria-hidden="true" />
        </span>
        {/* Arabic is cursive: no tracking, and no negative letter-spacing. */}
        <h2 className="truncate text-sm font-bold text-foreground">{station.labelAr}</h2>
        <StationSummary stationStates={station.lanes.map((l) => l.state)} now={now} />
      </div>
      <span
        data-testid={`station-count-${station.id}`}
        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground"
      >
        {countLabel}
      </span>
    </header>
  );
}

function BlockedBanner({ hint }: { readonly hint?: string }) {
  if (!hint) return null;
  return (
    <div
      role="status"
      className="border-b bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
    >
      {hint}
    </div>
  );
}

function SubLaneList({
  station,
  fillWidth,
  onOrderHover,
  onCardClick,
  onMoveKey,
}: StationColumnProps) {
  const isMultiLane = station.lanes.length > 1;
  // A station that fills the screen (fillWidth) has the width to put its
  // lanes side by side, and comparing lane depths at a glance is the point —
  // a 280-340px column in the full board cannot, since four lanes across
  // 300px is a 75px card, which is where the design station degraded into
  // unreadable chips. There the lanes stack as rows instead.
  const lanesAsColumns = isMultiLane && fillWidth === true;
  return (
    <div
      className={`flex min-h-0 flex-1 gap-2 overflow-hidden p-1.5 ${
        lanesAsColumns ? "flex-row" : "flex-col"
      }`}
    >
      {station.lanes.map((lane) => (
        // min-h-0 is load-bearing: a flex child defaults to min-height:auto,
        // so it refuses to shrink below its content and flex-1 never bounds
        // it. Without it the lane's overflow-y-auto has nothing to scroll
        // against and the page stops scrolling vertically.
        <div key={lane.state} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SubLane
            state={lane.state}
            labelAr={isMultiLane ? lane.labelAr : undefined}
            onOrderHover={onOrderHover}
            onCardClick={onCardClick}
            onMoveKey={onMoveKey}
          />
        </div>
      ))}
    </div>
  );
}

function resolveDropStyle(dropState: DropVisual): {
  readonly cls: string;
  readonly over: boolean;
  readonly dimmed: boolean;
} {
  // .column-drop-over carries the lane-drop-pulse keyframes in ink.css.
  if (dropState === "over") {
    return { cls: "column-drop-over ring-2 ring-primary border-transparent", over: true, dimmed: false };
  }
  if (dropState === "offered") {
    return {
      cls: "ring-2 ring-primary/50 ring-offset-1 bg-primary/5 border-primary/30",
      over: false,
      dimmed: false,
    };
  }
  if (dropState === "dimmed") {
    // grayscale as well as opacity: a colour-only dim still reads as "coloured
    // but faded" on a board whose stations are identified by hue.
    return { cls: "opacity-40 grayscale-[40%] cursor-not-allowed", over: false, dimmed: true };
  }
  return { cls: "border-border/60", over: false, dimmed: false };
}

export function StationColumn(props: StationColumnProps) {
  // The age summary is relative to when this column last re-rendered for a
  // store change, not a ticking clock. A `Date.now()` selector would return a
  // fresh value on every snapshot read and re-render forever; the board's
  // idle-animation invariant (SC-007) exists precisely to catch that.
  const now = Date.now();

  // Loaded vs total: infinite scroll means the lane usually holds less
  // than exists, so the header reads "20 من 150" while more is unloaded
  // and collapses to "20" once everything is on screen.
  const loadedCount = useStationCardCount(props.station.lanes);
  const totalCount = useStationCardTotal(props.station.lanes);
  const countLabel = formatLaneCount(loadedCount, totalCount);

  // When no dropState is passed in, read it live from the drag session, so
  // every column reacts to a drag without the parent re-rendering them.
  // An explicit prop still wins, which is what the tests use.
  const liveDropState = useDragOffer(props.station.id);
  const { cls: stateCls, over: isOver, dimmed: isDimmed } = resolveDropStyle(
    props.dropState ?? liveDropState,
  );

  const { setNodeRef } = useDroppable({
    id: props.station.id,
  });

  return (
    <section
      ref={setNodeRef}
      data-testid={`station-column-${props.station.id}`}
      data-station={props.station.id}
      aria-label={`${props.station.labelAr} (${countLabel})`}
      // Flexible width, not a fixed clamp: seven columns share the width
      // available, so each takes an equal share between a readable floor and
      // a ceiling. A fixed width left the board with dead space on a wide
      // monitor and pushed the last column off-screen on a narrow one.
      className={`relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-muted/30 transition-all duration-200 ease-out ${stateCls} ${
        props.fillWidth ? "w-full min-w-0" : "min-w-[280px] max-w-[340px]"
      }`}
    >
      <ColumnHeader station={props.station} countLabel={countLabel} now={now} />
      {isDimmed && <BlockedBanner hint={props.blockedHint} />}
      {isOver && (
        // The one piece of copy on the whole board that tells the operator
        // what will happen if they let go right now.
        <div className="pointer-events-none absolute inset-x-3 top-14 z-10 flex justify-center animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-lg">
            أفلت البطاقة هنا
          </span>
        </div>
      )}
      <SubLaneList {...props} />
    </section>
  );
}
