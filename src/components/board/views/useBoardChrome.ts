"use client";

/**
 * The board's own chrome state, separate from the container that renders it.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface)
 *
 * A slice change must not leave a station tab pointing at a station the new
 * slice does not contain: the column came back empty and nothing said why.
 */

import { useEffect, useMemo, useState } from "react";
import { STATIONS } from "~/lib/board/stations";
import { SLICES, type SliceId } from "~/lib/board/slices";
import type { StationId } from "~/server/board";
import type { FeedbackCenter } from "~/lib/board/feedback/FeedbackCenter";
import type { GroupMoveResult } from "~/lib/board/types";

const DEFAULT_STATION: StationId = "reception";

/** Use a hook, not a condition: the store exists on every render. */
export function useGroupResultListener(controller: { readonly feedback?: unknown }) {
  const [result, setResult] = useState<GroupMoveResult | null>(null);

  useEffect(() => {
    if (!controller?.feedback) return;
    const center = controller.feedback as FeedbackCenter;
    return center.subscribe?.((e) => {
      if (e.type === "GROUP_MOVE_DONE") setResult(e.result);
    });
  }, [controller]);

  return [result, setResult] as const;
}

/**
 * The slice already declares which stations it covers, so both the visible
 * station list and the open station follow the slice. Opening on a hardcoded
 * "reception" landed a designer on the one station they never touch, and
 * rendered six dead tabs under a single-station slice.
 *
 * A slice change must not leave the tab pointing at a station the new slice
 * does not contain: the column came back empty and nothing said why.
 */
export function useStationsForSlice(sliceId: SliceId) {
  const [activeStationId, setActiveStationId] = useState<StationId>(DEFAULT_STATION);

  const stationIds = useMemo<readonly StationId[]>(() => {
    const slice = SLICES.find((s) => s.id === sliceId);
    return slice ? slice.stations : STATIONS.map((s) => s.id);
  }, [sliceId]);

  useEffect(() => {
    const first = stationIds[0] ?? DEFAULT_STATION;
    setActiveStationId((current) => (stationIds.includes(current) ? current : first));
  }, [stationIds]);

  return { stationIds, activeStationId, setActiveStationId } as const;
}
