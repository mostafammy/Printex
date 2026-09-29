// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { DndContext } from "@dnd-kit/core";
import { SubLane } from "~/components/board/SubLane";
import { BoardContext } from "~/components/board/hooks/useBoardController";
import { BoardController } from "~/lib/board/BoardController";
import { DragSession } from "~/lib/board/drag/DragSession";
import { BoardStore } from "~/lib/board/store/BoardStore";
import type { BoardCard, BoardSnapshot } from "~/lib/board/types";
import { FakeClock } from "../../unit/board/fakes";

const card: BoardCard = {
  id: "c-1",
  orderId: "ord-1",
  orderNumber: 101,
  orderTagHue: 100,
  customerName: "عميل التجربة",
  title: "مطبوعات تجريبية",
  state: "IN_DESIGN",
  priority: "NORMAL",
  pricing: "NOT_REQUIRED",
  reworkCount: 0,
  quantity: 100,
  targetMinutes: 30,
  dueAt: null,
  enteredStationAt: "2026-09-26T12:00:00Z",
  lastTransitionId: null,
  lastTransitionAt: "2026-09-26T12:00:00Z",
  assignee: null,
  departmentId: null,
  moves: [
    {
      edgeId: "IN_DESIGN->REWORK_REQUIRED",
      to: "REWORK_REQUIRED",
      kind: "DIRECT",
      sheet: null,
      screenHref: null,
      backward: false,
      destructive: false,
      groupable: false,
      labelAr: "طلب تعديل",
    },
    {
      edgeId: "IN_DESIGN->DESIGN_COMPLETED",
      to: "DESIGN_COMPLETED",
      kind: "DIRECT",
      sheet: null,
      screenHref: null,
      backward: false,
      destructive: false,
      groupable: false,
      labelAr: "إتمام التصميم",
    },
  ],
};

const snapshot: BoardSnapshot = {
  generatedAt: "2026-09-26T12:00:00Z",
  cards: [card],
  slice: "floor",
  availableSlices: ["floor"],
  hiddenSiblingCounts: {},
  blockedHints: [],
};

function renderLanes(session: DragSession) {
  const controller = new BoardController({
    store: new BoardStore(snapshot, new FakeClock(1000)),
    snapshotGateway: {
      snapshot: async () => snapshot,
      lanePage: async (req) => ({
        state: req.state,
        cards: [],
        pagination: { page: 1, pageSize: 20, totalCount: 0, hasMore: false, nextCursor: null },
      }),
    },
    dragSession: session,
  });
  return render(
    <DndContext>
      <BoardContext.Provider value={controller}>
        <SubLane state="IN_DESIGN" labelAr="قيد التصميم" />
        <SubLane state="DESIGN_COMPLETED" labelAr="مكتمل التصميم" />
      </BoardContext.Provider>
    </DndContext>,
  );
}

describe("Lane section drop targets", () => {
  afterEach(() => {
    cleanup();
  });

  it("highlights only the offered section and marks the hovered one over", () => {
    const session = new DragSession();
    renderLanes(session);
    expect(screen.getByTestId("lane-section-IN_DESIGN")).toHaveAttribute("data-lane-drop", "idle");

    act(() => {
      session.start(card);
    });
    // The dragged card can land on DESIGN_COMPLETED but not on its own section.
    expect(screen.getByTestId("lane-section-DESIGN_COMPLETED")).toHaveAttribute(
      "data-lane-drop",
      "offered",
    );
    expect(screen.getByTestId("lane-section-IN_DESIGN")).toHaveAttribute("data-lane-drop", "idle");

    act(() => {
      session.setOverState("DESIGN_COMPLETED");
    });
    expect(screen.getByTestId("lane-section-DESIGN_COMPLETED")).toHaveAttribute(
      "data-lane-drop",
      "over",
    );
  });
});
