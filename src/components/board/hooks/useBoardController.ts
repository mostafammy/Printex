"use client";

/**
 * Context hook for accessing the typed BoardController mediator.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, plan.md S1)
 */

import { createContext, useContext } from "react";
import type { BoardController } from "~/lib/board/BoardController";

export const BoardContext = createContext<BoardController | null>(null);

export function useBoardController(): BoardController {
  const controller = useContext(BoardContext);
  if (!controller) {
    throw new Error("useBoardController must be used within a <BoardProvider>");
  }
  return controller;
}
