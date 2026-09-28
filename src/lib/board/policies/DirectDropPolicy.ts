/**
 * DirectDropPolicy: executes direct card move immediately via MoveCommand.
 * (contracts/board-engine.md §Drop policies, plan.md S1)
 */

import { MoveCommand, type MoveCommandDeps } from "../commands/MoveCommand";
import type { DropContext, DropPolicy } from "./DropPolicy";

export class DirectDropPolicy implements DropPolicy {
  readonly #deps: MoveCommandDeps;

  constructor(deps: MoveCommandDeps) {
    this.#deps = deps;
  }

  async onDrop(ctx: DropContext): Promise<void> {
    const command = new MoveCommand(this.#deps, {
      card: ctx.card,
      option: ctx.option,
      input: ctx.input,
    });
    await command.execute();
  }
}
