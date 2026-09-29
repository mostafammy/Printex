/**
 * Per-lane chunked board pagination (pure, no React/DOM/server coupling).
 *
 * Every lane owns an independent cursor: resync seeds page 1 per lane,
 * next() appends exactly one page for one lane, and restoreWindows()
 * reloads only what each lane already showed. A lane's scroll position
 * never triggers a fetch for another lane.
 */

import type { BoardFilters, BoardPagination, BoardSnapshot, LanePage, SliceId } from "./types";
import { BOARD_LANE_PAGE_SIZE } from "./types";
import type { SnapshotGateway } from "./ports";
import type { WorkItemState } from "~/server/board";

export type LaneCursorMap = Readonly<Record<string, BoardPagination>>;

export interface ChunkScope {
  readonly slice: SliceId;
  readonly filters: BoardFilters;
}

export interface LaneCursor {
  readonly page: number;
  readonly size: number;
  readonly hasMore: boolean;
  readonly next: number | null;
  readonly loading: boolean;
}

function cursorFromPagination(page: BoardPagination | undefined, fallbackSize: number): LaneCursor {
  if (!page) return { page: 1, size: fallbackSize, hasMore: true, next: 1, loading: false };
  return { page: page.page, size: page.pageSize, hasMore: page.hasMore, next: page.nextCursor, loading: false };
}

export class BoardLaneChunkLoader {
  readonly #gateway: SnapshotGateway;
  readonly #defaultSize: number;
  readonly #cursors = new Map<string, LaneCursor>();

  constructor(
    gateway: SnapshotGateway,
    laneMap?: LaneCursorMap,
    defaultSize: number = BOARD_LANE_PAGE_SIZE,
  ) {
    this.#gateway = gateway;
    this.#defaultSize = defaultSize;
    this.seedFrom(laneMap);
  }

  seedFrom(laneMap?: LaneCursorMap): void {
    this.#cursors.clear();
    for (const [state, page] of Object.entries(laneMap ?? {})) {
      this.#cursors.set(state, cursorFromPagination(page, this.#defaultSize));
    }
  }

  cursorFor(state: WorkItemState): LaneCursor | undefined {
    return this.#cursors.get(state);
  }

  /** Lanes holding more than their first chunk (reconnect candidates). */
  loadedStates(): WorkItemState[] {
    return [...this.#cursors.entries()]
      .filter(([_, c]) => c.page > 1)
      .map(([state]) => state as WorkItemState);
  }

  /** Lane-mode resync: page 1 per lane, cursors reseeded. */
  async first(scope: ChunkScope): Promise<BoardSnapshot> {
    const snapshot = await this.#gateway.snapshot({
      slice: scope.slice, filters: scope.filters, lanePageSize: this.#defaultSize,
    });
    this.#cursors.clear();
    this.seedFrom(snapshot.lanePagination);
    return snapshot;
  }

  /** Exactly one next chunk for one lane, or null at that lane's end. */
  async next(scope: ChunkScope, state: WorkItemState): Promise<LanePage | null> {
    const cursor = this.#cursors.get(state) ?? cursorFromPagination(undefined, this.#defaultSize);
    if (cursor.loading || !cursor.hasMore || !cursor.next) return null;
    this.#cursors.set(state, { ...cursor, loading: true });
    try {
      const page = await this.#gateway.lanePage({
        slice: scope.slice, filters: scope.filters, state,
        pagination: { page: cursor.next, pageSize: cursor.size },
      });
      this.#cursors.set(state, cursorFromPagination(page.pagination, cursor.size));
      return page;
    } catch (error) {
      this.#cursors.set(state, { ...cursor, loading: false });
      throw error;
    }
  }

  /** Reconnect window for one lane: everything it already showed. */
  async window(scope: ChunkScope, state: WorkItemState): Promise<LanePage | null> {
    const cursor = this.#cursors.get(state);
    if (!cursor || cursor.page <= 1) return null;
    return this.#gateway.lanePage({
      slice: scope.slice, filters: scope.filters, state,
      pagination: { page: 1, pageSize: cursor.size * cursor.page },
    });
  }
}
