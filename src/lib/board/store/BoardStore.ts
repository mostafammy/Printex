/**
 * Observable in-memory normalized store for board cards and lanes.
 * (specs/017-press-floor-board/contracts/board-engine.md §BoardStore, plan.md S1, S2-S)
 */

import type { WorkItemState } from "~/server/board";
import type { Clock } from "../ports";
import type {
  BoardCard,
  BoardMeta,
  BoardSnapshot,
} from "../types";
import { type FrameScheduler, FrameBatcher } from "./FrameBatcher";
import { LaneIndex } from "./LaneIndex";
import { TopicEmitter } from "./TopicEmitter";

interface PendingMove {
  readonly cardId: string;
  readonly originalCard: BoardCard;
  readonly targetState: WorkItemState;
}

export class BoardStore {
  readonly #cards = new Map<string, BoardCard>();
  readonly #laneIndex = new LaneIndex();
  readonly #emitter = new TopicEmitter();
  readonly #batcher: FrameBatcher;
  readonly #pendingMoves = new Map<string, PendingMove>();
  readonly #dirtyTopics = new Set<string>();

  #snapshot: BoardSnapshot;
  #cachedMeta: BoardMeta | null = null;

  constructor(
    snapshot: BoardSnapshot,
    _clock: Clock,
    scheduler?: FrameScheduler,
  ) {
    this.#batcher = new FrameBatcher(scheduler);
    this.#snapshot = snapshot;
    for (const card of snapshot.cards) {
      this.#cards.set(card.id, card);
      this.#laneIndex.insert(card.state, card.id, this.#cards);
    }
  }

  getCard(id: string): BoardCard | undefined {
    return this.#cards.get(id);
  }

  getLane(state: WorkItemState): readonly string[] {
    return this.#laneIndex.getLane(state);
  }

  getMeta(): BoardMeta {
    if (!this.#cachedMeta) {
      this.#cachedMeta = {
        slice: this.#snapshot.slice,
        availableSlices: this.#snapshot.availableSlices,
        totalVisible: this.#cards.size,
        hiddenSiblingCounts: this.#snapshot.hiddenSiblingCounts,
        blockedHints: this.#snapshot.blockedHints,
        pagination: this.#snapshot.pagination,
      };
    }
    return this.#cachedMeta;
  }

  subscribe(topic: string, listener: () => void): () => void {
    return this.#emitter.subscribe(topic, listener);
  }

  applyOptimistic(cardId: string, to: WorkItemState, token: string): void {
    const card = this.#cards.get(cardId);
    if (!card) return;
    this.#pendingMoves.set(token, { cardId, originalCard: card, targetState: to });
    this.#cards.set(cardId, { ...card, state: to });
    this.#laneIndex.remove(card.state, cardId);
    this.#laneIndex.insert(to, cardId, this.#cards);
    this.#markDirty([`card:${cardId}`, `lane:${card.state}`, `lane:${to}`, "meta"]);
  }

  commit(token: string, card: BoardCard): void {
    const pending = this.#pendingMoves.get(token);
    this.#pendingMoves.delete(token);
    const oldState = pending ? pending.targetState : card.state;
    this.#cards.set(card.id, card);
    if (oldState !== card.state) {
      this.#laneIndex.remove(oldState, card.id);
      this.#laneIndex.insert(card.state, card.id, this.#cards);
      this.#markDirty([`lane:${oldState}`, `lane:${card.state}`]);
    }
    this.#markDirty([`card:${card.id}`, "meta"]);
  }

  rollback(token: string): void {
    const pending = this.#pendingMoves.get(token);
    if (!pending) return;
    this.#pendingMoves.delete(token);
    const { cardId, originalCard, targetState } = pending;
    this.#cards.set(cardId, originalCard);
    this.#laneIndex.remove(targetState, cardId);
    this.#laneIndex.insert(originalCard.state, cardId, this.#cards);
    this.#markDirty([`card:${cardId}`, `lane:${targetState}`, `lane:${originalCard.state}`, "meta"]);
  }

  upsert(cards: readonly BoardCard[]): void {
    const lanes = new Set<WorkItemState>();
    for (const card of cards) {
      const existing = this.#cards.get(card.id);
      if (existing) {
        this.#laneIndex.remove(existing.state, card.id);
        lanes.add(existing.state);
      }
      this.#cards.set(card.id, card);
      this.#laneIndex.insert(card.state, card.id, this.#cards);
      lanes.add(card.state);
      this.#dirtyTopics.add(`card:${card.id}`);
    }
    for (const lane of lanes) this.#dirtyTopics.add(`lane:${lane}`);
    this.#dirtyTopics.add("meta");
    this.#flushDirty();
  }

  remove(ids: readonly string[]): void {
    for (const id of ids) {
      const card = this.#cards.get(id);
      if (card) {
        this.#laneIndex.remove(card.state, id);
        this.#cards.delete(id);
        this.#dirtyTopics.add(`card:${id}`);
        this.#dirtyTopics.add(`lane:${card.state}`);
      }
    }
    this.#dirtyTopics.add("meta");
    this.#flushDirty();
  }

  replace(snapshot: BoardSnapshot): void {
    this.#cards.clear();
    this.#laneIndex.clear();
    this.#snapshot = snapshot;
    const dirty = new Set<string>(["meta"]);
    for (const card of snapshot.cards) {
      this.#cards.set(card.id, card);
      this.#laneIndex.insert(card.state, card.id, this.#cards);
      dirty.add(`lane:${card.state}`);
      dirty.add(`card:${card.id}`);
    }
    this.#cachedMeta = null;
    this.#emitter.emitMany(dirty);
  }

  #markDirty(topics: readonly string[]): void {
    for (const t of topics) this.#dirtyTopics.add(t);
    this.#flushDirty();
  }

  #flushDirty(): void {
    if (this.#dirtyTopics.has("meta")) this.#cachedMeta = null;
    this.#batcher.schedule(() => {
      const topics = [...this.#dirtyTopics];
      this.#dirtyTopics.clear();
      this.#emitter.emitMany(topics);
    });
  }
}
