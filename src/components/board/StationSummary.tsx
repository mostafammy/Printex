"use client";

/**
 * StationSummary: the headline strip of a station column. Carries the count
 * and the age of the oldest job in the station, which is the fact an
 * operator checks before anything else on a floor.
 */

import React from "react";
import { useBoardSelector } from "./hooks/useBoardSelector";

/** Compacts an age to the largest unit that still reads at a glance. */
export function formatAge(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} س`;
  return `${Math.floor(hours / 24)} ي`;
}

export interface StationSummaryProps {
  readonly stationStates: readonly string[];
  /** Injected so the summary does not re-render on a timer of its own. */
  readonly now: number;
}

export function StationSummary({ stationStates, now }: StationSummaryProps) {
  const oldest = useBoardSelector(
    `station-summary:${stationStates.join(",")}`,
    (store) => {
      let oldestIso: string | null = null;
      for (const state of stationStates) {
        for (const id of store.getLane(state as never)) {
          const card = store.getCard(id);
          if (!card) continue;
          if (!oldestIso || card.enteredStationAt < oldestIso) {
            oldestIso = card.enteredStationAt;
          }
        }
      }
      return oldestIso;
    },
    null,
  );

  const age = formatAge(oldest, now);

  if (!age) return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span aria-hidden="true">·</span>
      <span>أقدمها</span>
      <span className="font-semibold tabular-nums text-foreground">{age}</span>
    </span>
  );
}
