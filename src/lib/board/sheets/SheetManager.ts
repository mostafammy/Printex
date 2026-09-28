/**
 * SheetManager: bridges SheetDropPolicy with the React UI layer.
 * Holds the active sheet request and lets React components resolve/reject it.
 * Observer pattern: components subscribe to sheet open/close events.
 * (contracts/board-engine.md §Registries, plan.md S1)
 */

import type { BoardCard, MoveOption, SheetId, SheetInput } from "../types";

export interface SheetRequest {
  readonly card: BoardCard;
  readonly option: MoveOption;
  readonly sheetId: SheetId;
}

export type SheetListener = (request: SheetRequest | null) => void;

export class SheetManager {
  #current: SheetRequest | null = null;
  #resolve: ((input: SheetInput | null) => void) | null = null;
  readonly #listeners = new Set<SheetListener>();

  /** Open a sheet and return a promise that resolves with input or null (cancel). */
  open(request: SheetRequest): Promise<SheetInput | null> {
    this.#current = request;
    this.#notify();
    return new Promise<SheetInput | null>((resolve) => {
      this.#resolve = resolve;
    });
  }

  /** Called by the sheet UI when the user confirms with input. */
  confirm(input: SheetInput): void {
    this.#settle(input);
  }

  /** Called by the sheet UI when the user cancels. */
  cancel(): void {
    this.#settle(null);
  }

  get current(): SheetRequest | null {
    return this.#current;
  }

  subscribe(listener: SheetListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #settle(input: SheetInput | null): void {
    const resolve = this.#resolve;
    this.#current = null;
    this.#resolve = null;
    this.#notify();
    resolve?.(input);
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      try {
        listener(this.#current);
      } catch {
        // Swallow listener errors to prevent one broken UI from blocking others
      }
    }
  }
}
