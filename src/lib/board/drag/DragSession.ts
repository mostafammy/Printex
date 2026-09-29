/**
 * DragSession: state machine managing card drag lifecycle and offered targets.
 * (contracts/board-engine.md §DragSession, research.md R1, plan.md S1, S3)
 */

import { STATE_PLACEMENT, type StationId } from "../stations";
import type { WorkItemState } from "~/server/board";
import type { BoardCard, MoveOption } from "../types";

export type DragSessionState =
  | "idle"
  | "lifting"
  | "dragging"
  | "dropping"
  | "settling";

function isWorkItemState(target: StationId | WorkItemState): target is WorkItemState {
  return target in STATE_PLACEMENT;
}

export class DragSession {
  private _state: DragSessionState = "idle";
  private _activeCard: BoardCard | null = null;
  private _overStation: StationId | null = null;
  private _overState: WorkItemState | null = null;
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

  /** The exact lane section hovered, for section-level highlight and drops. */
  get overState(): WorkItemState | null {
    return this._overState;
  }

  /** A section is offered when one of the card's moves lands exactly on it. */
  isStateOffered(state: WorkItemState): boolean {
    return this._activeCard?.moves.some((m) => m.to === state) ?? false;
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

  /**
   * Tracks the hovered lane section. Guarded like setOver so sweeping
   * across sections notifies once per section, not once per pixel.
   */
  setOverState(state: WorkItemState | null): void {
    if (this._state === "idle" || this._overState === state) return;
    this._overState = state;
    this.notify();
  }

  start(card: BoardCard): void {
    if (this._state !== "idle") return;
    this._activeCard = card;
    this._state = "dragging";
    this._overStation = null;
    this._overState = null;
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

  /**
   * Section-level drop: resolves the move landing exactly on the hovered
   * lane section. A station-level drop picks the station's first matching
   * move, which is why dropping on "مكتمل التصميم" used to land the card
   * in "تعديل مطلوب" whenever that edge sorted first.
   */
  resolveDropToState(targetState: WorkItemState): MoveOption | null {
    if (!this._activeCard || !this.isStateOffered(targetState)) {
      this.cancel();
      return null;
    }
    const option = this._activeCard.moves.find((m) => m.to === targetState) ?? null;

    this.cancel();
    return option;
  }

  /**
   * Drop entry for both granularities: a lane-section state id resolves
   * the move landing exactly on that section, anything else the
   * station-level first match (column header/gap and rail tab fallback).
   */
  resolveDropTarget(target: StationId | WorkItemState): MoveOption | null {
    return isWorkItemState(target) ? this.resolveDropToState(target) : this.resolveDrop(target);
  }

  cancel(): void {
    this._state = "idle";
    this._activeCard = null;
    this._overStation = null;
    this._overState = null;
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
