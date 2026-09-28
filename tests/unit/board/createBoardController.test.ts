import { describe, expect, it } from "vitest";
import { BoardController } from "~/lib/board/BoardController";
import { createBoardController } from "~/lib/board/createBoardController";
import type { BoardSnapshot } from "~/lib/board/types";
import { FakeClock, FakeSnapshotGateway } from "./fakes";

describe("createBoardController (T032, plan.md S2-D, S3)", () => {
  const initialSnapshot: BoardSnapshot = {
    generatedAt: "2026-09-26T12:00:00Z",
    cards: [],
    hiddenSiblingCounts: {},
    slice: "floor",
    availableSlices: ["floor"],
    blockedHints: [],
  };

  it("instantiates BoardController and wires dependencies cleanly", () => {
    const clock = new FakeClock();
    const snapshotGateway = new FakeSnapshotGateway();

    const controller = createBoardController(initialSnapshot, {
      clock,
      snapshotGateway,
    });

    expect(controller).toBeInstanceOf(BoardController);
    expect(controller.getMeta().slice).toBe("floor");
    expect(controller.getMeta().totalVisible).toBe(0);
  });
});
