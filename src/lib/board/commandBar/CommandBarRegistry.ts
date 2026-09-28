/**
 * CommandBarRegistry: manages search sources for the ⌘K command bar.
 * (specs/017-press-floor-board/contracts/board-engine.md §Registries, plan.md S1, S2-O)
 */

export interface CommandItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly href: string;
  readonly category: string;
  readonly icon?: string;
}

export interface CommandSource {
  readonly id: string;
  readonly labelAr: string;
  search(query: string, signal?: AbortSignal): Promise<readonly CommandItem[]>;
}

export class CommandBarRegistry {
  readonly #sources = new Map<string, CommandSource>();

  register(source: CommandSource): void {
    this.#sources.set(source.id, source);
  }

  getSources(): readonly CommandSource[] {
    return Array.from(this.#sources.values());
  }

  async searchAll(
    query: string,
    signal?: AbortSignal,
  ): Promise<readonly CommandItem[]> {
    if (!query.trim()) return [];

    const tasks = Array.from(this.#sources.values()).map(async (src) => {
      try {
        return await src.search(query, signal);
      } catch {
        return [];
      }
    });

    const results = await Promise.all(tasks);
    return results.flat();
  }
}
