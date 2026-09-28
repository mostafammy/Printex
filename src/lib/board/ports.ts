/**
 * Client board engine ports (Dependency Inversion).
 * Free of React, Next.js, and browser-only runtime dependencies.
 * (specs/017-press-floor-board/contracts/board-engine.md §Ports, plan.md S1, S2-I)
 */

import type {
  BoardCard,
  BoardSnapshot,
  BoardUpdate,
  ChoreographyKind,
  FeedbackEvent,
  GroupMoveRequest,
  GroupMoveResult,
  LanePage,
  LanePageRequest,
  LiveStatus,
  MotionContext,
  MoveRequest,
  MoveResult,
  RectLike,
  SnapshotRequest,
} from "./types";

export interface MoveGateway {
  move(req: MoveRequest): Promise<MoveResult>;
  moveGroup(req: GroupMoveRequest): Promise<GroupMoveResult>;
  cards(ids: readonly string[]): Promise<BoardCard[]>;
}

export interface SnapshotGateway {
  snapshot(req: SnapshotRequest): Promise<BoardSnapshot>;
  lanePage(req: LanePageRequest): Promise<LanePage>;
}

export interface LiveSource {
  subscribe(
    onUpdate: (u: BoardUpdate) => void,
    onStatus: (s: LiveStatus) => void,
    onResync: () => void,
  ): () => void;
}

export interface MotionPort {
  play(kind: ChoreographyKind, ctx: MotionContext): Promise<void>;
  measure(cardId: string): RectLike | null;
}

export interface FeedbackPort {
  notify(event: FeedbackEvent): void;
}

export interface Clock {
  now(): number;
}
