/**
 * LiveChannel: manages EventSource lifecycle and connection state machine.
 * (specs/017-press-floor-board/contracts/board-live-sse.md §LiveChannel, plan.md S1, S3)
 */

import type { BoardUpdate, LiveStatus } from "../types";

export type LiveChannelState = "connecting" | "open" | "stale" | "resyncing" | "closed";

export interface LiveChannelCallbacks {
  readonly onUpdate: (update: BoardUpdate) => void;
  readonly onStatus: (status: LiveStatus) => void;
  readonly onResync: () => void;
}

export class LiveChannel {
  readonly #url: string;
  readonly #callbacks: LiveChannelCallbacks;
  #eventSource: EventSource | null = null;
  #state: LiveChannelState = "connecting";
  #heartbeatTimer: NodeJS.Timeout | null = null;
  #disposed = false;

  constructor(url: string, callbacks: LiveChannelCallbacks) {
    this.#url = url;
    this.#callbacks = callbacks;
    this.#callbacks.onStatus("connecting");
    this.#connect();
  }

  get state(): LiveChannelState {
    return this.#state;
  }

  #transition(newState: LiveChannelState): void {
    if (this.#state === newState) return;
    if (this.#disposed && newState !== "closed") return;
    this.#state = newState;
    this.#callbacks.onStatus(newState);
  }

  #connect(): void {
    if (this.#disposed || typeof window === "undefined") return;

    this.#transition("connecting");
    const es = new EventSource(this.#url);
    this.#eventSource = es;

    es.addEventListener("hello", () => {
      this.#resetHeartbeat();
      if (this.#state === "resyncing" || this.#state === "stale") {
        this.#callbacks.onResync();
      }
      this.#transition("open");
    });

    es.addEventListener("transition", (e: MessageEvent) => {
      this.#resetHeartbeat();
      try {
        const update = JSON.parse(e.data as string) as BoardUpdate;
        this.#callbacks.onUpdate(update);
      } catch {
        // Drop malformed frame
      }
    });

    es.addEventListener("resync", () => {
      this.#resetHeartbeat();
      this.#callbacks.onResync();
    });

    es.onerror = () => {
      if (this.#state !== "closed") {
        this.#transition("stale");
      }
    };

    this.#resetHeartbeat();
  }

  #resetHeartbeat(): void {
    if (this.#heartbeatTimer) {
      clearTimeout(this.#heartbeatTimer);
    }
    this.#heartbeatTimer = setTimeout(() => {
      if (this.#state === "open") {
        this.#transition("stale");
      }
    }, 45000);
  }

  dispose(): void {
    this.#disposed = true;
    if (this.#heartbeatTimer) {
      clearTimeout(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
    if (this.#eventSource) {
      this.#eventSource.close();
      this.#eventSource = null;
    }
    this.#transition("closed");
  }
}
