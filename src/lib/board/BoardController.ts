/**
 * BoardController Mediator coordinating the store, gateways, motion, and drag interactions.
 * (specs/017-press-floor-board/contracts/board-engine.md §BoardController, plan.md S1, S3, S4)
 */

import type { StationId, WorkItemState } from "~/server/board";
import type { DragSession } from "./drag/DragSession";
import type { DropPolicyResolver } from "./policies/DropPolicyResolver";
import type { FeedbackPort, LiveSource, MotionPort, MoveGateway, SnapshotGateway } from "./ports";
import type { BoardStore } from "./store/BoardStore";
import type {
  BoardCard,
  BoardFilters,
  BoardMeta,
  BoardUpdate,
  GroupMoveRequest,
  LiveStatus,
  MoveOption,
  SheetInput,
  SliceId,
} from "./types";
import { GroupMoveCommand } from "./commands/GroupMoveCommand";
import type { CommandOutcome } from "./commands/BoardCommand";
import type { SheetManager } from "./sheets/SheetManager";
import { BoardViewPrefs } from "./prefs/BoardViewPrefs";

export interface BoardControllerDeps {
  readonly store: BoardStore;
  readonly snapshotGateway: SnapshotGateway;
  readonly moveGateway?: MoveGateway;
  readonly liveSource?: LiveSource;
  readonly motion?: MotionPort;
  readonly feedback?: FeedbackPort;
  readonly dropPolicies?: DropPolicyResolver;
  readonly dragSession?: DragSession;
  readonly sheetManager?: SheetManager;
}

export class BoardController {
  readonly #store: BoardStore; readonly #snapshotGateway: SnapshotGateway;
  readonly #moveGateway?: MoveGateway; readonly #motion?: MotionPort;
  readonly #feedback?: FeedbackPort; readonly #dropPolicies?: DropPolicyResolver;
  readonly #dragSession?: DragSession; readonly #sheetManager?: SheetManager;
  readonly #liveUnsub?: () => void;
  #currentSlice: SliceId;
  #currentFilters: BoardFilters = {};
  #disposed = false;
  // Guard: prevents concurrent loadMore() calls from rapid scroll events.
  #isLoadingMore = false;

  constructor(deps: BoardControllerDeps) {
    this.#store = deps.store; this.#snapshotGateway = deps.snapshotGateway;
    this.#currentSlice = deps.store.getMeta().slice;
    this.#moveGateway = deps.moveGateway; this.#motion = deps.motion;
    this.#feedback = deps.feedback; this.#dropPolicies = deps.dropPolicies;
    this.#dragSession = deps.dragSession; this.#sheetManager = deps.sheetManager;

    if (deps.liveSource) {
      this.#liveUnsub = deps.liveSource.subscribe(
        (u) => { void this.#handleLiveUpdate(u); },
        (s) => { this.#handleLiveStatus(s); },
        () => { void this.resync(); },
      );
    }
  }

  async #handleLiveUpdate(update: BoardUpdate): Promise<void> {
    if (this.#disposed || !this.#moveGateway) return;
    const [freshCard] = await this.#moveGateway.cards([update.workItemId]);
    if (freshCard && !this.#disposed) {
      this.#store.upsert([freshCard]);
      void this.#motion?.play("travel", { cardId: freshCard.id });
    }
  }

  #handleLiveStatus(status: LiveStatus): void {
    if (!this.#disposed) this.#feedback?.notify({ type: "LIVE_STATUS_CHANGED", status });
  }

  get store(): BoardStore { return this.#store; }
  get dragSession(): DragSession | undefined { return this.#dragSession; }
  get sheetManager(): SheetManager | undefined { return this.#sheetManager; }
  get feedback(): FeedbackPort | undefined { return this.#feedback; }
  get currentSlice(): SliceId { return this.#currentSlice; }
  get currentFilters(): BoardFilters { return this.#currentFilters; }
  getCard(id: string): BoardCard | undefined { return this.#store.getCard(id); }
  getLane(state: WorkItemState): readonly string[] { return this.#store.getLane(state); }
  getMeta(): BoardMeta { return this.#store.getMeta(); }
  subscribe(topic: string, listener: () => void): () => void { return this.#store.subscribe(topic, listener); }

  async executeMove(card: BoardCard, option: MoveOption, input?: SheetInput): Promise<void> {
    if (this.#disposed || !this.#dropPolicies) return;
    await this.#dropPolicies.resolve(option, card).onDrop({ card, option, input });
  }

  async handleDropOnStation(station: StationId): Promise<void> {
    if (!this.#dragSession?.activeCard) return;
    const option = this.#dragSession.resolveDrop(station);
    if (option) await this.executeMove(this.#dragSession.activeCard, option);
  }

  async resync(slice?: SliceId, filters?: BoardFilters): Promise<void> {
    if (this.#disposed) return;
    const snapshot = await this.#snapshotGateway.snapshot({ slice, filters });
    if (!this.#disposed) this.#store.replace(snapshot);
  }

  async loadMore(): Promise<void> {
    if (this.#disposed || this.#isLoadingMore) return;
    const meta = this.#store.getMeta();
    if (!meta.pagination?.hasMore || !meta.pagination.nextCursor) return;
    this.#isLoadingMore = true;
    try {
      const next = await this.#snapshotGateway.snapshot({
        slice: this.#currentSlice, filters: this.#currentFilters,
        pagination: { page: meta.pagination.nextCursor, pageSize: meta.pagination.pageSize },
      });
      if (!this.#disposed) this.#store.append(next);
    } finally {
      this.#isLoadingMore = false;
    }
  }

  async switchSlice(slice: SliceId): Promise<void> {
    this.#currentSlice = slice;
    BoardViewPrefs.save({ slice, filters: this.#currentFilters });
    await this.resync(slice, this.#currentFilters);
  }

  async updateFilters(filters: BoardFilters): Promise<void> {
    this.#currentFilters = filters;
    BoardViewPrefs.save({ slice: this.#currentSlice, filters });
    await this.resync(this.#currentSlice, filters);
  }

  async initFromPrefs(): Promise<void> {
    const s = BoardViewPrefs.load(this.#currentSlice);
    if (s.slice !== this.#currentSlice || Object.keys(s.filters).length > 0) {
      this.#currentSlice = s.slice; this.#currentFilters = s.filters;
      await this.resync(s.slice, s.filters);
    }
  }

  async executeGroupMove(req: GroupMoveRequest): Promise<CommandOutcome> {
    if (this.#disposed || !this.#moveGateway || !this.#feedback) {
      return { success: false, messageAr: "بوابة النقل غير متوفرة" };
    }
    return new GroupMoveCommand(
      { store: this.#store, gateway: this.#moveGateway, feedback: this.#feedback }, req,
    ).execute();
  }

  dispose(): void {
    this.#disposed = true;
    this.#liveUnsub?.();
  }
}
