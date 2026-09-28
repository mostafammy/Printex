/**
 * Chunked board pagination (pure, no React/DOM/server coupling).
 *
 * Single home for the board's "one small mound at a time" invariant:
 * every snapshot request carries an explicit page/pageSize chunk, so no
 * caller can issue the unbounded fetch that previously loaded the whole
 * table after the first page.
 */

import type { BoardFilters, BoardMeta, BoardPagination, BoardSnapshot, SliceId } from "./types";
import { BOARD_PAGE_SIZE } from "./types";
import type { SnapshotGateway } from "./ports";

export interface PageChunk {
  readonly page: number;
  readonly pageSize: number;
}

export interface ChunkScope {
  readonly slice: SliceId;
  readonly filters: BoardFilters;
}

/** Next single chunk to append, or null at the end of the list. */
export function nextChunk(meta: BoardMeta, fallbackSize: number): PageChunk | null {
  const pagination = meta.pagination;
  if (!pagination?.hasMore || !pagination.nextCursor) return null;
  return { page: pagination.nextCursor, pageSize: pagination.pageSize ?? fallbackSize };
}

/**
 * Owns the board's chunk cursor and issues only bounded page requests.
 * resync() loads page 1, loadMore() appends one page, reconnect reloads
 * exactly the window already shown — never the whole table.
 */
export class BoardChunkLoader {
  #page: number;
  #size: number;
  readonly #gateway: SnapshotGateway;

  constructor(gateway: SnapshotGateway, initialPage = 1, initialSize: number = BOARD_PAGE_SIZE) {
    this.#gateway = gateway;
    this.#page = initialPage;
    this.#size = initialSize;
  }

  get page(): number {
    return this.#page;
  }

  #track(page: number | undefined, size: number | undefined): void {
    this.#page = page ?? 1;
    if (size) this.#size = size;
  }

  #request(scope: ChunkScope, chunk: PageChunk): Promise<BoardSnapshot> {
    return this.#gateway.snapshot({
      slice: scope.slice, filters: scope.filters, pagination: chunk,
    });
  }

  /** First chunk — every resync starts here, never unbounded. */
  async first(scope: ChunkScope): Promise<BoardSnapshot> {
    const snapshot = await this.#request(scope, { page: 1, pageSize: this.#size });
    this.#track(snapshot.pagination?.page, snapshot.pagination?.pageSize);
    return snapshot;
  }

  /** Exactly one next chunk, or null at the end of the list. */
  async next(scope: ChunkScope, meta: BoardMeta): Promise<BoardSnapshot | null> {
    const chunk = nextChunk(meta, this.#size);
    if (!chunk) return null;
    const snapshot = await this.#request(scope, chunk);
    this.#page = chunk.page;
    this.#size = chunk.pageSize;
    return snapshot;
  }

  /** Reconnect window: exactly the chunks shown so far, recounted as chunks. */
  async window(scope: ChunkScope): Promise<BoardSnapshot> {
    const width = this.#size * Math.max(this.#page, 1);
    const snapshot = await this.#request(scope, { page: 1, pageSize: width });
    const totalCount = snapshot.pagination?.totalCount;
    const hasMore = totalCount === undefined
      ? snapshot.cards.length >= width
      : snapshot.cards.length < totalCount;
    const pagination: BoardPagination = {
      page: this.#page, pageSize: this.#size, totalCount,
      hasMore, nextCursor: hasMore ? this.#page + 1 : null,
    };
    return { ...snapshot, pagination };
  }
}
