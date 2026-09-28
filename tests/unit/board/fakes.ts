/**
 * Test fakes implementing client board engine ports.
 * (specs/017-press-floor-board/contracts/board-engine.md §Ports, plan.md S2-L)
 */

import type {
  Clock,
  FeedbackPort,
  LiveSource,
  MotionPort,
  MoveGateway,
  SnapshotGateway,
} from "~/lib/board/ports";
import type {
  BoardCard,
  BoardSnapshot,
  BoardUpdate,
  ChoreographyKind,
  FeedbackEvent,
  GroupMoveRequest,
  GroupMoveResult,
  LiveStatus,
  MotionContext,
  MoveRequest,
  MoveResult,
  RectLike,
  SnapshotRequest,
} from "~/lib/board/types";

export class FakeClock implements Clock {
  #currentTime: number;

  constructor(initialTime = 1_700_000_000_000) {
    this.#currentTime = initialTime;
  }

  now(): number {
    return this.#currentTime;
  }

  advance(ms: number): void {
    this.#currentTime += ms;
  }

  set(time: number): void {
    this.#currentTime = time;
  }
}

export class FakeMoveGateway implements MoveGateway {
  readonly moveInvocations: MoveRequest[] = [];
  readonly groupInvocations: GroupMoveRequest[] = [];
  readonly cardInvocations: string[][] = [];

  mockMoveResult?: (req: MoveRequest) => Promise<MoveResult>;
  mockGroupResult?: (req: GroupMoveRequest) => Promise<GroupMoveResult>;
  mockCardsResult?: (ids: readonly string[]) => Promise<BoardCard[]>;

  async move(req: MoveRequest): Promise<MoveResult> {
    this.moveInvocations.push(req);
    if (this.mockMoveResult) {
      return this.mockMoveResult(req);
    }
    return {
      ok: false,
      code: "INTERNAL",
      messageAr: "Not configured in fake",
    };
  }

  async moveGroup(req: GroupMoveRequest): Promise<GroupMoveResult> {
    this.groupInvocations.push(req);
    if (this.mockGroupResult) {
      return this.mockGroupResult(req);
    }
    return {
      orderId: req.orderId,
      to: req.to,
      items: [],
    };
  }

  async cards(ids: readonly string[]): Promise<BoardCard[]> {
    this.cardInvocations.push([...ids]);
    if (this.mockCardsResult) {
      return this.mockCardsResult(ids);
    }
    return [];
  }
}

export class FakeSnapshotGateway implements SnapshotGateway {
  readonly snapshotInvocations: SnapshotRequest[] = [];
  mockSnapshot?: BoardSnapshot;

  async snapshot(req: SnapshotRequest): Promise<BoardSnapshot> {
    this.snapshotInvocations.push(req);
    if (this.mockSnapshot) {
      return this.mockSnapshot;
    }
    return {
      generatedAt: new Date().toISOString(),
      cards: [],
      hiddenSiblingCounts: {},
      slice: "floor",
      availableSlices: ["floor"],
      blockedHints: [],
    };
  }
}

export class FakeLiveSource implements LiveSource {
  #subscribers = new Set<{
    onUpdate: (u: BoardUpdate) => void;
    onStatus: (s: LiveStatus) => void;
    onResync: () => void;
  }>();

  subscribe(
    onUpdate: (u: BoardUpdate) => void,
    onStatus: (s: LiveStatus) => void,
    onResync: () => void,
  ): () => void {
    const sub = { onUpdate, onStatus, onResync };
    this.#subscribers.add(sub);
    return () => {
      this.#subscribers.delete(sub);
    };
  }

  get subscriberCount(): number {
    return this.#subscribers.size;
  }

  emitUpdate(u: BoardUpdate): void {
    for (const sub of this.#subscribers) {
      sub.onUpdate(u);
    }
  }

  emitStatus(s: LiveStatus): void {
    for (const sub of this.#subscribers) {
      sub.onStatus(s);
    }
  }

  emitResync(): void {
    for (const sub of this.#subscribers) {
      sub.onResync();
    }
  }
}

export class FakeMotionPort implements MotionPort {
  readonly plays: { kind: ChoreographyKind; ctx: MotionContext }[] = [];
  mockRect: RectLike | null = {
    x: 0,
    y: 0,
    width: 300,
    height: 120,
    top: 0,
    right: 300,
    bottom: 120,
    left: 0,
  };

  async play(kind: ChoreographyKind, ctx: MotionContext): Promise<void> {
    this.plays.push({ kind, ctx });
  }

  measure(_cardId: string): RectLike | null {
    return this.mockRect;
  }
}

export class FakeFeedbackPort implements FeedbackPort {
  readonly events: FeedbackEvent[] = [];

  notify(event: FeedbackEvent): void {
    this.events.push(event);
  }
}
