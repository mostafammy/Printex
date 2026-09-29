// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { StationColumn } from "~/components/board/StationColumn";
import { BoardContext } from "~/components/board/hooks/useBoardController";
import { BoardController } from "~/lib/board/BoardController";
import { BoardStore } from "~/lib/board/store/BoardStore";
import { STATIONS } from "~/lib/board/stations";
import type { BoardCard, BoardSnapshot } from "~/lib/board/types";
import { FakeClock } from "../../unit/board/fakes";

const testCards: BoardCard[] = [
  {
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
    moves: [],
  },
  {
    id: "c-2",
    orderId: "ord-2",
    orderNumber: 102,
    orderTagHue: 200,
    customerName: "مؤسسة النجاح",
    title: "كتالوج فني",
    state: "ASSIGNED",
    priority: "URGENT",
    pricing: "PRICED",
    reworkCount: 0,
    quantity: 50,
    targetMinutes: 1440,
    dueAt: null,
    enteredStationAt: "2026-09-26T12:05:00Z",
    lastTransitionId: null,
    lastTransitionAt: "2026-09-26T12:05:00Z",
    assignee: { id: "u-1", name: "المصمم س" },
    departmentId: null,
    moves: [],
  },
  {
    id: "c-3",
    orderId: "ord-3",
    orderNumber: 103,
    orderTagHue: 300,
    customerName: "شركة الوادي",
    title: "ملصقات تغليف",
    state: "IN_DESIGN",
    priority: "NORMAL",
    pricing: "PENDING",
    reworkCount: 1,
    quantity: 1000,
    targetMinutes: 1440,
    dueAt: null,
    enteredStationAt: "2026-09-26T12:10:00Z",
    lastTransitionId: null,
    lastTransitionAt: "2026-09-26T12:10:00Z",
    assignee: { id: "u-1", name: "المصمم س" },
    departmentId: null,
    moves: [],
  },
];

const testSnapshot: BoardSnapshot = {
  generatedAt: "2026-09-26T12:00:00Z",
  cards: testCards,
  slice: "floor",
  availableSlices: ["floor", "reception", "designer", "production"],
  hiddenSiblingCounts: {},
  blockedHints: [],
};

function createTestController(cards: BoardCard[] = testCards) {
  const clock = new FakeClock(1000);
  const store = new BoardStore({ ...testSnapshot, cards }, clock);
  return new BoardController({
    store,
    snapshotGateway: {
      snapshot: async () => testSnapshot,
      lanePage: async (req) => ({
        state: req.state,
        cards: [],
        pagination: {
          page: 1, pageSize: 20, totalCount: 0, hasMore: false, nextCursor: null,
        },
      }),
    },
  });
}

describe("StationColumn & SubLane Components", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders station ink theme, Lucide icon, Arabic label, and card count for single-lane station", () => {
    const receptionStation = STATIONS.find((s) => s.id === "reception")!;
    const controller = createTestController();

    render(
      <BoardContext.Provider value={controller}>
        <StationColumn station={receptionStation} />
      </BoardContext.Provider>,
    );

    const column = screen.getByTestId("station-column-reception");
    expect(column).toHaveAttribute("data-station", "reception");
    expect(screen.getByText("الاستقبال")).toBeInTheDocument();
    expect(screen.getByTestId("station-count-reception")).toHaveTextContent("١");
  });

  it("renders multiple sub-lanes and total count for multi-lane station (e.g. Design)", () => {
    const designStation = STATIONS.find((s) => s.id === "design")!;
    const controller = createTestController();

    render(
      <BoardContext.Provider value={controller}>
        <StationColumn station={designStation} />
      </BoardContext.Provider>,
    );

    const column = screen.getByTestId("station-column-design");
    expect(column).toHaveAttribute("data-station", "design");
    expect(screen.getByText("التصميم")).toBeInTheDocument();
    // 1 in ASSIGNED + 1 in IN_DESIGN = 2
    expect(screen.getByTestId("station-count-design")).toHaveTextContent("٢");
    expect(screen.getByText("معين")).toBeInTheDocument();
    expect(screen.getByText("قيد التصميم")).toBeInTheDocument();
  });

  it("renders dimmed state with blocked hint message", () => {
    const pricingStation = STATIONS.find((s) => s.id === "pricing")!;
    const controller = createTestController();

    render(
      <BoardContext.Provider value={controller}>
        <StationColumn
          station={pricingStation}
          dropState="dimmed"
          blockedHint="يجب اعتماد التصميم أولاً"
        />
      </BoardContext.Provider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("يجب اعتماد التصميم أولاً");
    const column = screen.getByTestId("station-column-pricing");
    expect(column.className).toContain("opacity-40");
  });

  it("shows loaded-of-total while lanes hold more than is on screen", () => {
    const receptionStation = STATIONS.find((s) => s.id === "reception")!;
    const lanePage = (totalCount: number) => ({
      page: 1, pageSize: 20, totalCount, hasMore: totalCount > 1, nextCursor: totalCount > 1 ? 2 : null,
    });
    const snapshotWithTotals: BoardSnapshot = {
      ...testSnapshot,
      lanePagination: {
        NEW: lanePage(5),
        ASSIGNED: lanePage(1),
        IN_DESIGN: lanePage(1),
      },
    };
    const clock = new FakeClock(1000);
    const store = new BoardStore(snapshotWithTotals, clock);
    const controller = new BoardController({
      store,
      snapshotGateway: {
        snapshot: async () => snapshotWithTotals,
        lanePage: async (req) => ({
          state: req.state,
          cards: [],
          pagination: { page: 1, pageSize: 20, totalCount: 0, hasMore: false, nextCursor: null },
        }),
      },
    });

    render(
      <BoardContext.Provider value={controller}>
        <StationColumn station={receptionStation} />
      </BoardContext.Provider>,
    );

    // 1 loaded of 5 total, in Arabic-Indic numerals.
    expect(screen.getByTestId("station-count-reception")).toHaveTextContent("١ من ٥");
  });

  it("shows the plain count once everything is loaded", () => {
    const receptionStation = STATIONS.find((s) => s.id === "reception")!;
    const controller = createTestController();

    render(
      <BoardContext.Provider value={controller}>
        <StationColumn station={receptionStation} />
      </BoardContext.Provider>,
    );

    expect(screen.getByTestId("station-count-reception")).toHaveTextContent("١");
  });
});
