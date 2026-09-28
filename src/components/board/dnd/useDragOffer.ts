"use client";

/**
 * useDragOffer: live drop-target visual state for one station column.
 * Subscribes to DragSession — offered while dragging, over while hovered.
 */

import { useEffect, useState } from "react";
import type { StationId } from "~/lib/board/stations";
import { useBoardController } from "../hooks/useBoardController";

export type DropVisual = "idle" | "offered" | "dimmed" | "over";

export function useDragOffer(stationId: StationId): DropVisual {
  const controller = useBoardController();
  const session = controller.dragSession;
  const [, setTick] = useState(0);

  useEffect(() => session?.subscribe(() => setTick((t) => t + 1)), [session]);

  if (!session?.activeCard) return "idle";
  if (session.overStation === stationId && session.isOffered(stationId)) return "over";
  return session.isOffered(stationId) ? "offered" : "dimmed";
}
