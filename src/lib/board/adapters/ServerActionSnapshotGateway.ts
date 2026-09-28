/**
 * Server Action adapter for SnapshotGateway port.
 * (specs/017-press-floor-board/contracts/board-engine.md §Ports, plan.md S1, S2-D)
 */

import type { SnapshotGateway } from "../ports";
import type { BoardSnapshot, LanePage, LanePageRequest, SnapshotRequest } from "../types";

export type SnapshotFetcher = (
  req: SnapshotRequest,
) => Promise<BoardSnapshot>;

export type LanePageFetcher = (
  req: LanePageRequest,
) => Promise<LanePage>;

function missingLaneFetcher(req: LanePageRequest): Promise<LanePage> {
  return Promise.reject(new Error(`lane page fetcher not configured (${req.state})`));
}

export class ServerActionSnapshotGateway implements SnapshotGateway {
  readonly #fetcher: SnapshotFetcher;
  readonly #laneFetcher: LanePageFetcher;

  constructor(fetcher: SnapshotFetcher, laneFetcher: LanePageFetcher = missingLaneFetcher) {
    this.#fetcher = fetcher;
    this.#laneFetcher = laneFetcher;
  }

  async snapshot(req: SnapshotRequest): Promise<BoardSnapshot> {
    return this.#fetcher(req);
  }

  async lanePage(req: LanePageRequest): Promise<LanePage> {
    return this.#laneFetcher(req);
  }
}
