"use client";

/**
 * StationColumn rendering column header, station ink theme, count, and sub-lanes.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-001, FR-002, FR-006)
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
import { useBoardSelector } from "./hooks/useBoardSelector";
import { SubLane } from "./SubLane";

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
   * viewport empty. Defaults to the shared-width behaviour so the full board
   * is unchanged.
   */
  readonly fillWidth?: boolean;
}

function ColumnHeader({
  station,
  count,
}: {
  readonly station: Station;
  readonly count: number;
}) {
  const IconComponent = ICONS[station.icon] ?? Inbox;
  return (
    <header className="flex items-center justify-between border-b px-3 py-2.5 bg-background/60 rounded-t-xl">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground">
          <IconComponent className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-bold tracking-tight text-foreground">{station.labelAr}</h2>
      </div>
      <span
        data-testid={`station-count-${station.id}`}
        className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground"
      >
        {count}
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
  return (
    <div className="flex flex-1 flex-col gap-2 overflow-hidden p-1.5">
      {station.lanes.map((lane) => (
        <SubLane
          key={lane.state}
          state={lane.state}
          labelAr={isMultiLane ? lane.labelAr : undefined}
          grid={fillWidth === true}
          onOrderHover={onOrderHover}
          onCardClick={onCardClick}
          onMoveKey={onMoveKey}
        />
      ))}
    </div>
  );
}

export function StationColumn(props: StationColumnProps) {
  const cardCount = useBoardSelector("meta", (store) => {
    let sum = 0;
    for (const lane of props.station.lanes) {
      sum += store.getLane(lane.state).length;
    }
    return sum;
  });

  const isOffered = props.dropState === "offered";
  const isDimmed = props.dropState === "dimmed";
  const stateCls = isOffered
    ? "ring-2 ring-primary ring-offset-2 bg-primary/5"
    : isDimmed
      ? "opacity-40 grayscale-[40%]"
      : "border-border/60";

  const { setNodeRef } = useDroppable({
    id: props.station.id,
  });

  return (
    <section
      ref={setNodeRef}
      data-testid={`station-column-${props.station.id}`}
      data-station={props.station.id}
      aria-label={`${props.station.labelAr} (${cardCount})`}
      className={`flex flex-col h-full flex-1 rounded-xl border bg-muted/30 transition-all ${
        props.fillWidth ? "w-full" : "min-w-[280px] max-w-[340px]"
      } ${stateCls}`}
    >
      <ColumnHeader station={props.station} count={cardCount} />
      {isDimmed && <BlockedBanner hint={props.blockedHint} />}
      <SubLaneList {...props} />
    </section>
  );
}
