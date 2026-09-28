"use client";

/**
 * useSheetRequest: subscribes to SheetManager and returns the current pending request.
 * Uses useSyncExternalStore for React-safe subscription to the engine's SheetManager.
 * (contracts/board-engine.md §React surface, plan.md S1)
 */

import { useSyncExternalStore } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";
import { useBoardController } from "./useBoardController";

export function useSheetRequest(): SheetRequest | null {
  const controller = useBoardController();
  const sheetManager = controller.sheetManager;

  return useSyncExternalStore(
    (onChange) => {
      if (!sheetManager) return () => undefined;
      return sheetManager.subscribe(() => onChange());
    },
    () => sheetManager?.current ?? null,
    () => null,
  );
}
