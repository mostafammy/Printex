/**
 * GroupMoveCommand: coordinates multi-card movement for an entire order.
 * Updates store items individually and reports completion via FeedbackPort.
 * (specs/017-press-floor-board/contracts/board-engine.md §Commands, data-model.md §3.5, plan.md S1)
 */

import { BoardCommand, type CommandOutcome } from "./BoardCommand";
import type { FeedbackPort, MoveGateway } from "../ports";
import type { BoardStore } from "../store/BoardStore";
import type { BoardCard, GroupMoveRequest, GroupMoveResult } from "../types";

export interface GroupMoveCommandDeps {
  readonly store: BoardStore;
  readonly gateway: MoveGateway;
  readonly feedback: FeedbackPort;
}

export class GroupMoveCommand extends BoardCommand {
  readonly #deps: GroupMoveCommandDeps;
  readonly #req: GroupMoveRequest;

  constructor(deps: GroupMoveCommandDeps, req: GroupMoveRequest) {
    super();
    this.#deps = deps;
    this.#req = req;
  }

  async execute(): Promise<CommandOutcome> {
    const { store, gateway, feedback } = this.#deps;

    let result: GroupMoveResult;
    try {
      result = await gateway.moveGroup(this.#req);
    } catch (err) {
      this._state = "rolledBack";
      const messageAr = err instanceof Error ? err.message : "فشلت عملية النقل الجماعي";
      return { success: false, messageAr };
    }

    const updatedCards = result.items
      .filter((item): item is { workItemId: string; status: "MOVED"; card: BoardCard } => item.status === "MOVED")
      .map((item) => item.card);

    if (updatedCards.length > 0) {
      store.upsert(updatedCards);
    }

    this._state = "committed";
    feedback.notify({
      type: "GROUP_MOVE_DONE",
      result,
    });

    return {
      success: true,
      messageAr: `تم نقل ${updatedCards.length} من أصل ${result.items.length} بنجاح`,
    };
  }
}
