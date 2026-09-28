/**
 * MoveCommand: 6-step lifecycle command for card transitions.
 * (contracts/board-engine.md §Commands, plan.md S1)
 */

import type { FeedbackPort, MotionPort, MoveGateway } from "../ports";
import type { BoardStore } from "../store/BoardStore";
import type { BoardCard, MoveOption, MoveResult, SheetInput } from "../types";
import { BoardCommand, type CommandOutcome } from "./BoardCommand";

export interface MoveCommandDeps {
  readonly store: BoardStore;
  readonly gateway: MoveGateway;
  readonly motion: MotionPort;
  readonly feedback: FeedbackPort;
}

export interface MoveCommandPayload {
  readonly card: BoardCard;
  readonly option: MoveOption;
  readonly input?: SheetInput;
}

export class MoveCommand extends BoardCommand {
  readonly #deps: MoveCommandDeps;
  readonly #card: BoardCard;
  readonly #option: MoveOption;
  readonly #input?: SheetInput;

  constructor(deps: MoveCommandDeps, payload: MoveCommandPayload) {
    super();
    this.#deps = deps;
    this.#card = payload.card;
    this.#option = payload.option;
    this.#input = payload.input;
  }

  async execute(): Promise<CommandOutcome> {
    const { store, gateway, motion } = this.#deps;
    const from = motion.measure(this.#card.id);
    const token = `move-${this.#card.id}-${Date.now()}`;

    store.applyOptimistic(this.#card.id, this.#option.to, token);
    this._state = "applied";

    const choreoKind = this.#option.backward ? "rework-arc" : "travel";
    const motionPromise = motion.play(choreoKind, { cardId: this.#card.id, from });
    const gatewayPromise = gateway.move({
      workItemId: this.#card.id,
      edgeId: this.#option.edgeId,
      input: this.#input,
      clientMoveId: token,
    });

    const [, result] = await Promise.all([motionPromise, gatewayPromise]);

    if (this.state === "superseded") {
      await motion.play("travel", { cardId: this.#card.id });
      return { success: false, messageAr: "تم التحديث بواسطة زميل آخر" };
    }

    if (result.ok) {
      return this.handleCommit(token, result);
    }
    return this.handleRollback(token, result, from);
  }

  private async handleCommit(token: string, result: Extract<MoveResult, { ok: true }>): Promise<CommandOutcome> {
    this._state = "committed";
    this.#deps.store.commit(token, result.card);
    await this.#deps.motion.play("stamp", { cardId: this.#card.id });
    this.#deps.feedback.notify({
      type: "MOVE_COMMITTED",
      card: result.card,
      transitionIds: result.transitionIds,
    });
    return { success: true };
  }

  private async handleRollback(
    token: string,
    result: Extract<MoveResult, { ok: false }>,
    from: ReturnType<MotionPort["measure"]>,
  ): Promise<CommandOutcome> {
    this._state = "rolledBack";
    this.#deps.store.rollback(token);

    if (result.code === "STALE_STATE" && result.card) {
      this.#deps.store.upsert([result.card]);
    }

    await this.#deps.motion.play("fly-back", { cardId: this.#card.id, from });
    this.#deps.feedback.notify({
      type: "MOVE_REFUSED",
      cardId: this.#card.id,
      code: result.code,
      messageAr: result.messageAr,
    });

    return { success: false, messageAr: result.messageAr };
  }
}
