/**
 * Server Action adapter for MoveGateway port.
 * (specs/017-press-floor-board/contracts/board-engine.md §Ports, plan.md S1, S2-D)
 */

import type { MoveGateway } from "../ports";
import type {
  BoardCard,
  GroupMoveRequest,
  GroupMoveResult,
  MoveRequest,
  MoveResult,
} from "../types";

export type MoveSender = (req: MoveRequest) => Promise<MoveResult>;
export type GroupMoveSender = (req: GroupMoveRequest) => Promise<GroupMoveResult>;
export type CardsFetcher = (ids: readonly string[]) => Promise<BoardCard[]>;

export interface ServerActionMoveGatewayDeps {
  readonly moveSender: MoveSender;
  readonly cardsFetcher: CardsFetcher;
  readonly groupMoveSender?: GroupMoveSender;
}

export class ServerActionMoveGateway implements MoveGateway {
  readonly #moveSender: MoveSender;
  readonly #cardsFetcher: CardsFetcher;
  readonly #groupMoveSender?: GroupMoveSender;

  constructor(deps: ServerActionMoveGatewayDeps) {
    this.#moveSender = deps.moveSender;
    this.#cardsFetcher = deps.cardsFetcher;
    this.#groupMoveSender = deps.groupMoveSender;
  }

  async move(req: MoveRequest): Promise<MoveResult> {
    return this.#moveSender(req);
  }

  async moveGroup(req: GroupMoveRequest): Promise<GroupMoveResult> {
    if (!this.#groupMoveSender) {
      throw new Error("Group moves not supported by this gateway configuration");
    }
    return this.#groupMoveSender(req);
  }

  async cards(ids: readonly string[]): Promise<BoardCard[]> {
    return this.#cardsFetcher(ids);
  }
}
