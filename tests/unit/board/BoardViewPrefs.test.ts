// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardViewPrefs } from "~/lib/board/prefs/BoardViewPrefs";

describe("BoardViewPrefs (FR-023)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads fallback slice and empty filters when storage is empty", () => {
    const view = BoardViewPrefs.load("reception");
    expect(view.slice).toBe("reception");
    expect(view.filters).toEqual({});
  });

  it("saves and reloads view preferences accurately", () => {
    BoardViewPrefs.save({
      slice: "designer",
      filters: { urgentOnly: true, overdueOnly: false },
    });

    const loaded = BoardViewPrefs.load("floor");
    expect(loaded.slice).toBe("designer");
    expect(loaded.filters).toEqual({ urgentOnly: true, overdueOnly: false });
  });

  it("handles corrupted JSON gracefully without crashing", () => {
    localStorage.setItem(BoardViewPrefs.STORAGE_KEY, "{ corrupted json !");
    const loaded = BoardViewPrefs.load("floor");
    expect(loaded.slice).toBe("floor");
    expect(loaded.filters).toEqual({});
  });

  it("safely ignores quota exceeded or security errors on save", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => {
      BoardViewPrefs.save({ slice: "floor", filters: {} });
    }).not.toThrow();
  });

  it("clears storage key properly", () => {
    BoardViewPrefs.save({ slice: "production", filters: {} });
    BoardViewPrefs.clear();
    const loaded = BoardViewPrefs.load("floor");
    expect(loaded.slice).toBe("floor");
  });
});
