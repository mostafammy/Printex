/**
 * SheetDropPolicy: Strategy for SHEET-kind moves.
 * Holds the card in optimistic "pending-input" position, opens the sheet modal via
 * SheetManager, and executes MoveCommand once the user confirms. On cancel, plays
 * fly-back to return the card.
 * (contracts/board-engine.md §Drop policies, plan.md S1, US3)
 */

import { MoveCommand, type MoveCommandDeps } from "../commands/MoveCommand";
import type { SheetManager } from "../sheets/SheetManager";
import type { DropContext, DropPolicy } from "./DropPolicy";

export interface SheetDropPolicyDeps {
  readonly moveDeps: MoveCommandDeps;
  readonly sheetManager: SheetManager;
}

export class SheetDropPolicy implements DropPolicy {
  readonly #moveDeps: MoveCommandDeps;
  readonly #sheetManager: SheetManager;

  constructor(deps: SheetDropPolicyDeps) {
    this.#moveDeps = deps.moveDeps;
    this.#sheetManager = deps.sheetManager;
  }

  async onDrop(ctx: DropContext): Promise<void> {
    const { card, option } = ctx;

    if (!option.sheet) {
      throw new Error(`SheetDropPolicy: missing sheetId for edge "${option.edgeId}"`);
    }

    const input = await this.#sheetManager.open({
      card,
      option,
      sheetId: option.sheet,
    });

    if (input === null) {
      // User cancelled: fly the card back
      await this.#moveDeps.motion.play("fly-back", { cardId: card.id });
      return;
    }

    const command = new MoveCommand(this.#moveDeps, {
      card,
      option,
      input,
    });
    await command.execute();
  }
}
