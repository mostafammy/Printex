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
    // Industrial form: the header is a label plate, not a card. Flat wash,
    // hairline rule under it, no shadow, 2px corners on the tile.
    <header className="flex items-center gap-2.5 border-b border-[var(--board-line-strong)] bg-[var(--ticket-wash)] px-3 py-2">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-[2px] text-white"
        style={{ backgroundColor: "var(--ticket-bar)" }}
      >
        <IconComponent className="size-4" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Arabic is cursive: no tracking, and no negative letter-spacing. */}
        <h2 className="truncate text-base font-bold leading-tight text-foreground">
          {station.labelAr}
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            data-testid={`station-count-${station.id}`}
            className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground"
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
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden p-3">      {station.lanes.map((lane) => (
        <SubLane
          key={lane.state}
          state={lane.state}
          labelAr={isMultiLane ? lane.labelAr : undefined}
          onOrderHover={onOrderHover}
          onCardClick={onCardClick}
          onMoveKey={onMoveKey}
        />
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
      className={`flex h-full flex-col overflow-hidden rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-[var(--board-surface)] transition-colors ${
        props.fillWidth ? "w-full" : "min-w-[280px] max-w-[340px]"
      } ${stateCls}`}
    >
      <ColumnHeader station={props.station} count={cardCount} now={now} />
      {isDimmed && <BlockedBanner hint={props.blockedHint} />}
      <SubLaneList {...props} />
    </section>
  );
}
