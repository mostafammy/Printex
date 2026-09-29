// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { DndContext } from "@dnd-kit/core";
import { MobileStationTabs } from "~/components/board/MobileStationTabs";
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
  state: "NEW",
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
      edgeId: "reception.assign",
      to: "ASSIGNED",
      kind: "DIRECT",
      sheet: null,
      screenHref: null,
      backward: false,
      destructive: false,
      groupable: false,
      labelAr: "تعيين مصمم",
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

function renderTabs(session: DragSession) {
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
        <MobileStationTabs activeStationId="reception" onSelectStation={vi.fn()} />
      </BoardContext.Provider>
    </DndContext>,
  );
}

function tabFor(stationId: string): HTMLElement {
  const tab = document.querySelector(`[data-station="${stationId}"]`);
  if (!(tab instanceof HTMLElement)) throw new Error(`missing tab ${stationId}`);
  return tab;
}

describe("Station rail drop targets", () => {
  afterEach(() => {
    cleanup();
  });

  it("marks only the stations the dragged card can move to, and resolves the drop", () => {
    const session = new DragSession();
    renderTabs(session);

    expect(tabFor("design")).toHaveAttribute("data-drop", "idle");
    expect(tabFor("reception")).toHaveAttribute("data-drop", "idle");

    act(() => {
      session.start(card);
    });
    expect(tabFor("design")).toHaveAttribute("data-drop", "offered");
    // The rail never dims visually, but the session state is still dimmed —
    // the tab is neither the hovered nor an offered target.
    expect(tabFor("reception")).toHaveAttribute("data-drop", "dimmed");

    act(() => {
      session.setOver("design");
    });
    expect(tabFor("design")).toHaveAttribute("data-drop", "over");
    expect(screen.getByText("أفلت هنا")).toBeInTheDocument();

    const option = session.resolveDrop("design");
    expect(option?.edgeId).toBe("reception.assign");
  });

  it("returns tabs to idle when the drag is cancelled", () => {
    const session = new DragSession();
    renderTabs(session);

    act(() => {
      session.start(card);
    });
    expect(tabFor("design")).toHaveAttribute("data-drop", "offered");

    act(() => {
      session.cancel();
    });
    expect(tabFor("design")).toHaveAttribute("data-drop", "idle");
  });
});
