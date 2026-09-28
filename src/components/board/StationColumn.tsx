"use client";

/**
 * StationColumn rendering the station header, ink-tinted frame, count, oldest
 * job age, and sub-lanes.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-001, FR-002, FR-006)
 *
 * The station is the primary visual object on this board, so it owns the
 * colour: `ink.css` exposes `--station-<id>-{wash,edge,fill,text}` through the
 * `[data-station]` remap, and this component is where those tokens finally
 * reach the screen. Previously the station rendered `bg-muted/30` like every
 * other column and the ink system only survived as a 4px ticket hairline.
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
import type { WorkItemState } from "~/server/board";
import type { BoardCard } from "~/lib/board/types";
import { useBoardSelector } from "./hooks/useBoardSelector";
import { SubLane } from "./SubLane";
import { StationSummary } from "./StationSummary";

const ICONS: Readonly<Record<string, LucideIcon>> = {
  Inbox,
  Palette,
  CheckCheck,
  Calculator,
  Printer,
  PackageCheck,
  Truck,
};

export interface StationColumnProps {
  readonly station: Station;
  readonly dropState?: "idle" | "offered" | "dimmed";
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
  count,
  now,
}: {
  readonly station: Station;
  readonly count: number;
  readonly now: number;
}) {
  const IconComponent = ICONS[station.icon] ?? Inbox;
  return (
    // Soft header: the station's ink tint behind a rounded tile icon, with a
    // hairline rule under it. The station reads as the primary object.
    <header className="flex items-center gap-2.5 border-b border-[var(--board-line-strong)] bg-[var(--ticket-wash)] px-3.5 py-2.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[var(--board-radius)] text-white"
        style={{ backgroundColor: "var(--ticket-bar)" }}
      >
        <IconComponent className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Arabic is cursive: no tracking, and no negative letter-spacing. */}
        <h2 className="truncate text-base font-bold leading-tight text-foreground">
          {station.labelAr}
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            data-testid={`station-count-${station.id}`}
            className="text-[11px] font-semibold tabular-nums text-muted-foreground"
          >
            {count}
          </span>
          <StationSummary stationStates={station.lanes.map((l) => l.state)} now={now} />
        </div>
      </div>
    </header>
  );
}

function BlockedBanner({ hint }: { readonly hint?: string }) {
  if (!hint) return null;
  return (
    <div
      role="status"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400"
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
  // Lane arrangement follows the column's width, not a fixed rule.
  //
  // One station filling the screen (fillWidth) has room to put its lanes
  // side by side as columns, and comparing lane depths at a glance is the
  // point. A 280-340px column in the full board cannot: four lanes across
  // 300px is a 75px card, which is where the design station degraded into
  // unreadable chips with ellipsised text. There the lanes stack as rows
  // instead, and each gets the full column width.
  const lanesAsColumns = isMultiLane && fillWidth === true;
  return (
    <div
      className={`flex min-h-0 flex-1 gap-3 overflow-hidden p-3 ${
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

export function StationColumn(props: StationColumnProps) {
  // The age summary is relative to when this column last re-rendered for a
  // store change, not a ticking clock. A `Date.now()` selector would return a
  // fresh value on every snapshot read and re-render forever; the board's
  // idle-animation invariant (SC-007) exists precisely to catch that.
  const now = Date.now();

  const cardCount = useBoardSelector(
    `station-count:${props.station.id}`,
    (store) => {
      let sum = 0;
      for (const lane of props.station.lanes) {
        sum += store.getLane(lane.state).length;
      }
      return sum;
    },
    0,
  );

  const isOffered = props.dropState === "offered";
  const isDimmed = props.dropState === "dimmed";
  const stateCls = isOffered
    ? "ring-2 ring-[var(--ticket-bar)]"
    : isDimmed
      ? "opacity-40"
      : "";

  const { setNodeRef } = useDroppable({
    id: props.station.id,
  });

  return (
    <section
      ref={setNodeRef}
      data-testid={`station-column-${props.station.id}`}
      data-station={props.station.id}
      aria-label={`${props.station.labelAr} (${cardCount})`}
      // The column is a soft bordered panel: the station owns its frame, and
      // a rounded edge plus a hairline separates one station from the next
      // without a heavy rule between them.
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-[var(--board-surface)] transition-shadow ${
        props.fillWidth ? "w-full min-w-0" : "w-[clamp(260px,22vw,340px)] shrink-0"
      } ${stateCls}`}
    >
      <ColumnHeader station={props.station} count={cardCount} now={now} />
      {isDimmed && <BlockedBanner hint={props.blockedHint} />}
      <SubLaneList {...props} />
    </section>
  );
}
