/**
 * DropPolicy interface: Strategy pattern for handling drop events.
 * (contracts/board-engine.md §Drop policies, plan.md S1)
 */

import type { BoardCard, MoveOption, SheetInput } from "../types";

export interface DropContext {
  readonly card: BoardCard;
  readonly option: MoveOption;
  readonly input?: SheetInput;
}

export interface DropPolicy {
  onDrop(ctx: DropContext): Promise<void>;
}
