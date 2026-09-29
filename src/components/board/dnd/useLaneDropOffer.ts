"use client";

/**
 * useLaneDropOffer: live drop-target visual state for one lane section.
 * Mirrors useDragOffer one level down: offered while the dragged card has a
 * move landing exactly on this state, over while the pointer is inside it.
 */

import { useEffect, useState } from "react";
import type { WorkItemState } from "~/server/board";
import { useBoardController } from "../hooks/useBoardController";

export type LaneDropVisual = "idle" | "offered" | "over";

export function useLaneDropOffer(state: WorkItemState): LaneDropVisual {
  const controller = useBoardController();
  const session = controller.dragSession;
  const [, setTick] = useState(0);

  useEffect(() => session?.subscribe(() => setTick((t) => t + 1)), [session]);

  if (!session?.activeCard) return "idle";
  if (session.overState === state && session.isStateOffered(state)) return "over";
  return session.isStateOffered(state) ? "offered" : "idle";
}
