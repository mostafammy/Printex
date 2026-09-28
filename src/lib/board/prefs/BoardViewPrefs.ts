/**
 * BoardViewPrefs: manages per-device persistence of slice selection and active filters in localStorage.
 * Every read and write is wrapped in try/catch for safety.
 * (specs/017-press-floor-board/data-model.md §3.7, FR-023, plan.md S1)
 */

import type { SliceId } from "~/server/board";
import type { BoardFilters } from "../types";

export interface BoardView {
  readonly slice: SliceId;
  readonly filters: BoardFilters;
}

export class BoardViewPrefs {
  static readonly STORAGE_KEY = "printex.board.view.v1";

  static load(fallbackSlice: SliceId = "floor"): BoardView {
    if (typeof window === "undefined" || !window.localStorage) {
      return { slice: fallbackSlice, filters: {} };
    }
    try {
      const raw = window.localStorage.getItem(BoardViewPrefs.STORAGE_KEY);
      if (!raw) return { slice: fallbackSlice, filters: {} };
      const parsed = JSON.parse(raw) as Partial<BoardView>;
      return {
        slice: parsed.slice ?? fallbackSlice,
        filters: parsed.filters ?? {},
      };
    } catch {
      return { slice: fallbackSlice, filters: {} };
    }
  }

  static save(view: BoardView): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(BoardViewPrefs.STORAGE_KEY, JSON.stringify(view));
    } catch {
      // Ignore quota or private-mode errors
    }
  }

  static clear(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.removeItem(BoardViewPrefs.STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  }
}
