import { describe, expect, it } from "vitest";
import { BoardStore } from "~/lib/board/store/BoardStore";
import type { BoardCard, BoardSnapshot } from "~/lib/board/types";
import { FakeClock } from "./fakes";

function makeSnapshot(cards: BoardCard[]): BoardSnapshot {
  return {
    generatedAt: "2026-09-26T12:00:00Z",
    cards,
    hiddenSiblingCounts: {},
    slice: "floor",
    availableSlices: ["floor"],
    blockedHints: [],
  };
}

describe("BoardStore (Observer store with normalized cards & sorted lanes)", () => {
  const clock = new FakeClock();

  it("hydrates from initial snapshot and places cards into lanes", () => {
    const card1: BoardCard = {
      id: "card-1",
      orderId: "order-1",
      orderNumber: 1,
      orderTagHue: 100,
      customerName: "عميل",
      title: "كروت شخصية",
      quantity: 500,
      state: "NEW",
      priority: "NORMAL",
      pricing: "NOT_REQUIRED",
      enteredStationAt: "2026-09-26T10:00:00Z",
      targetMinutes: 30,
      dueAt: null,
      reworkCount: 0,
      assignee: null,
      departmentId: null,
      moves: [],
      lastTransitionId: "t1",
      lastTransitionAt: "2026-09-26T10:00:00Z",
    };

    const store = new BoardStore(makeSnapshot([card1]), clock, (cb) => {
      cb();
      return 1;
    });

    expect(store.getCard("card-1")).toEqual(card1);
    expect(store.getLane("NEW")).toEqual(["card-1"]);
    expect(store.getLane("IN_DESIGN")).toEqual([]);
  });

  it("applyOptimistic moves card to target lane and rollback restores original lane", () => {
    const card1: BoardCard = {
      id: "card-1",
      orderId: "order-1",
      orderNumber: 1,
      orderTagHue: 100,
      customerName: "عميل",
      title: "كروت شخصية",
      quantity: 500,
      state: "NEW",
      priority: "NORMAL",
      pricing: "NOT_REQUIRED",
      enteredStationAt: "2026-09-26T10:00:00Z",
      targetMinutes: 30,
      dueAt: null,
      reworkCount: 0,
      assignee: null,
      departmentId: null,
      moves: [],
      lastTransitionId: "t1",
      lastTransitionAt: "2026-09-26T10:00:00Z",
    };

    const store = new BoardStore(makeSnapshot([card1]), clock, (cb) => {
      cb();
      return 1;
    });

    const token = "move-token-1";
    store.applyOptimistic("card-1", "READY_FOR_PRODUCTION", token);

    expect(store.getLane("NEW")).toEqual([]);
    expect(store.getLane("READY_FOR_PRODUCTION")).toEqual(["card-1"]);
    expect(store.getCard("card-1")?.state).toBe("READY_FOR_PRODUCTION");

    store.rollback(token);
    expect(store.getLane("NEW")).toEqual(["card-1"]);
    expect(store.getLane("READY_FOR_PRODUCTION")).toEqual([]);
    expect(store.getCard("card-1")?.state).toBe("NEW");
  });
});
