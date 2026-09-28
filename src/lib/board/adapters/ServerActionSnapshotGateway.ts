/**
 * Server Action adapter for SnapshotGateway port.
 * (specs/017-press-floor-board/contracts/board-engine.md §Ports, plan.md S1, S2-D)
 */

import type { SnapshotGateway } from "../ports";
import type { BoardSnapshot, SnapshotRequest } from "../types";

export type SnapshotFetcher = (
  req: SnapshotRequest,
) => Promise<BoardSnapshot>;

export class ServerActionSnapshotGateway implements SnapshotGateway {
  readonly #fetcher: SnapshotFetcher;

  constructor(fetcher: SnapshotFetcher) {
    this.#fetcher = fetcher;
  }

  async snapshot(req: SnapshotRequest): Promise<BoardSnapshot> {
    return this.#fetcher(req);
  }
}
