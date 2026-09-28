/**
 * TopicEmitter managing fine-grained subscriptions for Observer store.
 * Topics: "lane:<state>", "card:<id>", "meta".
 * (specs/017-press-floor-board/plan.md S1, S3, contracts/board-engine.md §BoardStore)
 */

export class TopicEmitter {
  readonly #listeners = new Map<string, Set<() => void>>();

  subscribe(topic: string, listener: () => void): () => void {
    let set = this.#listeners.get(topic);
    if (!set) {
      set = new Set();
      this.#listeners.set(topic, set);
    }
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.#listeners.delete(topic);
      }
    };
  }

  emit(topic: string): void {
    const set = this.#listeners.get(topic);
    if (!set) return;
    for (const listener of set) {
      listener();
    }
  }

  emitMany(topics: Iterable<string>): void {
    const targets = new Set<() => void>();
    for (const topic of topics) {
      const set = this.#listeners.get(topic);
      if (set) {
        for (const l of set) {
          targets.add(l);
        }
      }
    }
    for (const listener of targets) {
      listener();
    }
  }

  clear(): void {
    this.#listeners.clear();
  }
}
