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
import { useDragOffer, type DropVisual } from "./dnd/useDragOffer";
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
          onOrderHover={onOrderHover}
          onCardClick={onCardClick}
          onMoveKey={onMoveKey}
        />
      ))}
    </div>
  );
}

function resolveDropStyle(dropState: DropVisual): { cls: string; over: boolean; dimmed: boolean } {
  if (dropState === "over") {
    return { cls: "column-drop-over ring-2 ring-primary border-transparent", over: true, dimmed: false };
  }
  if (dropState === "offered") {
    return { cls: "ring-2 ring-primary/50 ring-offset-1 bg-primary/5 border-primary/30", over: false, dimmed: false };
  }
  if (dropState === "dimmed") {
    return { cls: "opacity-40 grayscale-[40%] cursor-not-allowed", over: false, dimmed: true };
  }
  return { cls: "border-border/60", over: false, dimmed: false };
}

export function StationColumn(props: StationColumnProps) {
  const cardCount = useBoardSelector("meta", (store) => {
    let sum = 0;
    for (const lane of props.station.lanes) {
      sum += store.getLane(lane.state).length;
    }
    return sum;
  });
  const liveDrop = useDragOffer(props.station.id);
  const drop = resolveDropStyle(props.dropState ?? liveDrop);

  const { setNodeRef } = useDroppable({
    id: props.station.id,
  });

  return (
    <section
      ref={setNodeRef}
      data-testid={`station-column-${props.station.id}`}
      data-station={props.station.id}
      aria-label={`${props.station.labelAr} (${cardCount})`}
      className={`relative flex flex-col h-full min-w-[280px] max-w-[340px] flex-1 rounded-xl border bg-muted/30 transition-all duration-200 ease-out ${drop.cls}`}
    >
      <ColumnHeader station={props.station} count={cardCount} />
      {drop.dimmed && <BlockedBanner hint={props.blockedHint} />}
      {drop.over && (
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
