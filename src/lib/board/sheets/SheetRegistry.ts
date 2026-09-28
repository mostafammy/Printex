/**
 * SheetRegistry: open/closed registry mapping SheetId to component and Zod schema.
 * Adding a new sheet = one `register()` call. Existing code is not edited.
 * (contracts/board-engine.md §Registries, plan.md S1, S2-O, US3)
 */

import type { z } from "zod";
import type { SheetId, SheetInput } from "../types";

export interface SheetEntry {
  /** Unique sheet identifier */
  readonly id: SheetId;
  /** Zod schema for validating submitted input */
  readonly schema: z.ZodType<SheetInput>;
}

export class SheetRegistry {
  readonly #entries = new Map<SheetId, SheetEntry>();

  /**
   * Register a sheet entry. Throws on duplicate to catch wiring mistakes early.
   */
  register(entry: SheetEntry): void {
    if (this.#entries.has(entry.id)) {
      throw new Error(`SheetRegistry: duplicate registration for sheet "${entry.id}"`);
    }
    this.#entries.set(entry.id, entry);
  }

  get(id: SheetId): SheetEntry | undefined {
    return this.#entries.get(id);
  }

  has(id: SheetId): boolean {
    return this.#entries.has(id);
  }

  getAll(): readonly SheetEntry[] {
    return [...this.#entries.values()];
  }
}
