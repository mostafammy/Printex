/**
 * BoardLiveHub: globalThis singleton managing a dedicated pg.Client for LISTEN board_transition.
 * (specs/017-press-floor-board/contracts/board-live-sse.md, research.md R4)
 */

import { Client, type Notification } from "pg";
import type { BoardUpdate } from "~/lib/board/types";
import { resolveActorName } from "./actorCache";
import { BoardTransitionPayloadSchema, type BoardTransitionPayload } from "./payload";

export interface HubSubscriber {
  readonly id: string;
  readonly onUpdate: (update: BoardUpdate, payload: BoardTransitionPayload) => void;
  readonly onResync: () => void;
}

export interface HubStatus {
  readonly listening: boolean;
  readonly subscribers: number;
  readonly lastEventAt: Date | null;
}

export class BoardLiveHub {
  readonly #connectionString: string;
  readonly #subscribers = new Map<string, HubSubscriber>();
  #client: Client | null = null;
  #status: "disconnected" | "connecting" | "listening" = "disconnected";
  #lastEventAt: Date | null = null;
  #reconnectTimer: NodeJS.Timeout | null = null;
  #backoffMs = 1000;
  #disposed = false;

  constructor(connectionString?: string) {
    this.#connectionString =
      connectionString ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/printex";
  }

  static instance(): BoardLiveHub {
    const globalWithHub = globalThis as unknown as { __boardLiveHub?: BoardLiveHub };
    if (!globalWithHub.__boardLiveHub) {
      globalWithHub.__boardLiveHub = new BoardLiveHub();
      void globalWithHub.__boardLiveHub.start();
    }
    return globalWithHub.__boardLiveHub;
  }

  async start(): Promise<void> {
    if (this.#disposed || this.#status !== "disconnected") return;
    await this.#connect();
  }

  subscribe(subscriber: HubSubscriber): () => void {
    this.#subscribers.set(subscriber.id, subscriber);
    return () => { this.#subscribers.delete(subscriber.id); };
  }

  status(): HubStatus {
    return {
      listening: this.#status === "listening",
      subscribers: this.#subscribers.size,
      lastEventAt: this.#lastEventAt,
    };
  }

  async #connect(): Promise<void> {
    if (this.#disposed) return;
    this.#status = "connecting";
    try {
      const client = new Client({ connectionString: this.#connectionString });
      this.#client = client;
      client.on("notification", (msg: Notification) => { void this.#handleNotification(msg); });
      client.on("error", () => { this.#handleDisconnect(); });
      client.on("end", () => { this.#handleDisconnect(); });
      await client.connect();
      await client.query("LISTEN board_transition");
      this.#status = "listening";
      this.#backoffMs = 1000;
      this.#emitResync();
    } catch {
      this.#handleDisconnect();
    }
  }

  #handleDisconnect(): void {
    if (this.#status === "disconnected") return;
    this.#status = "disconnected";
    void this.#client?.end().catch(() => undefined);
    this.#client = null;
    if (this.#disposed || this.#reconnectTimer) return;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      this.#backoffMs = Math.min(this.#backoffMs * 2, 30000);
      void this.#connect();
    }, this.#backoffMs);
  }

  #emitResync(): void {
    for (const sub of this.#subscribers.values()) {
      try { sub.onResync(); } catch { /* ignore */ }
    }
  }

  async #handleNotification(msg: Notification): Promise<void> {
    if (msg.channel !== "board_transition" || !msg.payload) return;
    let parsed: unknown;
    try { parsed = JSON.parse(msg.payload); } catch { return; }
    const result = BoardTransitionPayloadSchema.safeParse(parsed);
    if (!result.success) return;
    const payload = result.data;
    this.#lastEventAt = new Date();
    const actorName = await resolveActorName(payload.actorId);
    const update: BoardUpdate = {
      transitionId: payload.id,
      workItemId: payload.workItemId,
      orderId: payload.orderId,
      from: payload.from as BoardUpdate["from"],
      to: payload.to as BoardUpdate["to"],
      actor: { id: payload.actorId, name: actorName },
      at: payload.at,
    };
    for (const sub of this.#subscribers.values()) {
      try { sub.onUpdate(update, payload); } catch { /* ignore */ }
    }
  }

  /**
   * Tell every connected subscriber to refetch from scratch.
   *
   * Exists for out-of-band database changes that no single work-item transition
   * can describe — notably the admin demo tools (purge / reseed), which rewrite
   * the entire board at once. Without this, open operator screens keep rendering
   * cards for work items that no longer exist, because NOTIFY only fires per
   * transition and a bulk TRUNCATE emits none.
   */
  requestResync(): void {
    this.#emitResync();
  }

  dispose(): void {
    this.#disposed = true;
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    this.#subscribers.clear();
    void this.#client?.end().catch(() => undefined);
    this.#client = null;
    this.#status = "disconnected";
  }
}

export function getBoardLiveHub(): BoardLiveHub {
  return BoardLiveHub.instance();
}
