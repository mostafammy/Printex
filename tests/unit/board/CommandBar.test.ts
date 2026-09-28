import { describe, expect, it, vi } from "vitest";
import { CommandBarRegistry } from "~/lib/board/commandBar/CommandBarRegistry";
import { PagesSource } from "~/lib/board/commandBar/sources/PagesSource";

describe("CommandBarRegistry and Sources (FR-033, T159)", () => {
  it("registers sources and searches across all registered sources", async () => {
    const registry = new CommandBarRegistry();
    const pagesSource = new PagesSource();
    registry.register(pagesSource);

    expect(registry.getSources()).toHaveLength(1);

    const results = await registry.searchAll("لوحة");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toContain("لوحة أرضية المطبعة");
    expect(results[0]?.href).toBe("/board");
  });

  it("returns empty array for empty search queries", async () => {
    const registry = new CommandBarRegistry();
    registry.register(new PagesSource());

    const results = await registry.searchAll("   ");
    expect(results).toEqual([]);
  });

  it("handles source failure gracefully without breaking searchAll", async () => {
    const registry = new CommandBarRegistry();
    registry.register({
      id: "failing",
      labelAr: "فاشل",
      search: vi.fn().mockRejectedValue(new Error("Network failed")),
    });
    registry.register(new PagesSource());

    const results = await registry.searchAll("board");
    expect(results.length).toBeGreaterThan(0);
  });
});
