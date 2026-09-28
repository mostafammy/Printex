/**
 * DragSession: state machine managing card drag lifecycle and offered targets.
 * (contracts/board-engine.md §DragSession, research.md R1, plan.md S1, S3)
 */

import { STATE_PLACEMENT, type StationId } from "../stations";
import type { BoardCard, MoveOption } from "../types";

export type DragSessionState =
  | "idle"
  | "lifting"
  | "dragging"
  | "dropping"
  | "settling";

export class DragSession {
  private _state: DragSessionState = "idle";
  private _activeCard: BoardCard | null = null;
  private _overStation: StationId | null = null;
  private _offeredStations = new Set<StationId>();
  private readonly listeners = new Set<() => void>();

  get state(): DragSessionState {
    return this._state;
  }

  get activeCard(): BoardCard | null {
    return this._activeCard;
  }

  get offeredStations(): ReadonlySet<StationId> {
    return this._offeredStations;
  }

  isOffered(station: StationId): boolean {
    return this._offeredStations.has(station);
  }

  /** The station the dragged card is currently hovering, for live highlight. */
  get overStation(): StationId | null {
    return this._overStation;
  }

  /**
   * Tracks the hovered drop target. Guarded on state and identity so a
   * pointer sweeping across a column does not re-notify on every pixel.
   */
  setOver(station: StationId | null): void {
    if (this._state === "idle" || this._overStation === station) return;
    this._overStation = station;
    this.notify();
  }

  start(card: BoardCard): void {
    if (this._state !== "idle") return;
    this._activeCard = card;
    this._state = "dragging";

    this._overStation = null;
    this._offeredStations.clear();
    for (const move of card.moves) {
      const placement = STATE_PLACEMENT[move.to];
      if (placement && placement !== "OFF_BOARD") {
        this._offeredStations.add(placement.station);
      }
    }
    this.notify();
  }

  resolveDrop(targetStation: StationId): MoveOption | null {
    if (!this._activeCard || !this.isOffered(targetStation)) {
      this.cancel();
      return null;
    }
    const option =
      this._activeCard.moves.find((m) => {
        const placement = STATE_PLACEMENT[m.to];
        return placement && placement !== "OFF_BOARD" && placement.station === targetStation;
      }) ?? null;

    this.cancel();
    return option;
  }

  cancel(): void {
    this._state = "idle";
    this._activeCard = null;
    this._overStation = null;
    this._offeredStations.clear();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
