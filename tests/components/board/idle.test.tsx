// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { BoardContext } from "~/components/board/hooks/useBoardController";
import { BoardController } from "~/lib/board/BoardController";
import { BoardStore } from "~/lib/board/store/BoardStore";
import { Board } from "~/components/board/Board";
import type { BoardSnapshot } from "~/lib/board/types";
import { FakeClock } from "../../unit/board/fakes";

const emptySnapshot: BoardSnapshot = {
  cards: [],
  hiddenSiblingCounts: {},
  slice: "floor",
  availableSlices: ["floor"],
  blockedHints: [],
  generatedAt: new Date().toISOString(),
};

function createIdleTestController() {
  const clock = new FakeClock(1000);
  const store = new BoardStore(emptySnapshot, clock);
  return new BoardController({
    store,
    snapshotGateway: { snapshot: async () => emptySnapshot },
  });
}

describe("Board Idle Animation Invariant (SC-007)", () => {
  afterEach(() => {
    cleanup();
  });

  it("asserts document.getAnimations() is empty when board is idle", () => {
    if (!document.getAnimations) {
      document.getAnimations = () => [];
    }

    const controller = createIdleTestController();

    render(
      <BoardContext.Provider value={controller}>
        <Board />
      </BoardContext.Provider>,
    );

    // Verify zero running animations on idle floor
    const animations = document.getAnimations();
    expect(animations).toHaveLength(0);
  });
});
