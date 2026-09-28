/**
 * EventSourceLiveSource: adapter for LiveSource port using LiveChannel.
 * (specs/017-press-floor-board/contracts/board-engine.md §Ports, plan.md S1, S2-D)
 */

import type { LiveSource } from "../ports";
import type { BoardUpdate, LiveStatus } from "../types";
import { LiveChannel } from "./LiveChannel";

export class EventSourceLiveSource implements LiveSource {
  readonly #url: string;

  constructor(url = "/api/board/stream") {
    this.#url = url;
  }

  subscribe(
    onUpdate: (u: BoardUpdate) => void,
    onStatus: (s: LiveStatus) => void,
    onResync: () => void,
  ): () => void {
    const channel = new LiveChannel(this.#url, { onUpdate, onStatus, onResync });
    return () => {
      channel.dispose();
    };
  }
}
