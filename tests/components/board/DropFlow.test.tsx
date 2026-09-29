// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { DndContext } from "@dnd-kit/core";
import { BoardContext } from "~/components/board/hooks/useBoardController";
import { useFocusRestoration } from "~/components/board/hooks/useFocusRestoration";
import { SheetHost } from "~/components/board/SheetHost";
import { BoardController } from "~/lib/board/BoardController";
import { DragSession } from "~/lib/board/drag/DragSession";
import { DirectDropPolicy } from "~/lib/board/policies/DirectDropPolicy";
import { DropPolicyResolver } from "~/lib/board/policies/DropPolicyResolver";
import { SheetDropPolicy } from "~/lib/board/policies/SheetDropPolicy";
import { SheetManager } from "~/lib/board/sheets/SheetManager";
import { BoardStore } from "~/lib/board/store/BoardStore";
import { AnnouncerChannel } from "~/lib/board/feedback/AnnouncerChannel";
import { ToastChannel } from "~/lib/board/feedback/ToastChannel";
import { FeedbackCenter } from "~/lib/board/feedback/FeedbackCenter";
import type { BoardCard, BoardSnapshot } from "~/lib/board/types";
import { FakeClock, FakeMotionPort, FakeMoveGateway, FakeSnapshotGateway } from "../../unit/board/fakes";

function makeCard(id: string, moves: BoardCard["moves"]): BoardCard {
  return {
    id,
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
    moves,
  };
}

const directCard = makeCard("c-direct", [
  {
    edgeId: "reception.start",
    to: "ASSIGNED",
    kind: "DIRECT",
    sheet: null,
    screenHref: null,
    backward: false,
    destructive: false,
    groupable: false,
    labelAr: "بدء التصميم",
  },
]);

const sheetCard = makeCard("c-sheet", [
  {
    edgeId: "reception.assign",
    to: "ASSIGNED",
    kind: "SHEET",
    sheet: "assign-designer",
    screenHref: null,
    backward: false,
    destructive: false,
    groupable: false,
    labelAr: "تعيين مصمم",
  },
]);

function setup(cards: BoardCard[]) {
  const snapshot: BoardSnapshot = {
    generatedAt: "2026-09-26T12:00:00Z",
    cards,
    slice: "floor",
    availableSlices: ["floor"],
    hiddenSiblingCounts: {},
    blockedHints: [],
  };
  const store = new BoardStore(snapshot, new FakeClock(1000));
  const gateway = new FakeMoveGateway();
  const motion = new FakeMotionPort();
  const feedback = new FeedbackCenter();
  const announcer = new AnnouncerChannel();
  const toast = vi.fn();
  feedback.subscribe(announcer.handle);
  feedback.subscribe(new ToastChannel(toast).handle);
  const sheets = new SheetManager();
  const session = new DragSession();
  const moveDeps = { store, gateway, motion, feedback };
  const policies = new DropPolicyResolver();
  policies.register("DIRECT", new DirectDropPolicy(moveDeps));
  policies.register("SHEET", new SheetDropPolicy({ moveDeps, sheetManager: sheets }));
  gateway.mockMoveResult = async (req) => {
    const card = cards.find((c) => c.id === req.workItemId) ?? cards[0]!;
    return { ok: true, card: { ...card, state: "ASSIGNED" }, transitionIds: ["t-1"] };
  };
  const controller = new BoardController({
    store,
    snapshotGateway: new FakeSnapshotGateway(),
    moveGateway: gateway,
    motion,
    feedback,
    dropPolicies: policies,
    dragSession: session,
    sheetManager: sheets,
  });

  function FocusProbe() {
    useFocusRestoration(controller);
    return null;
  }

  render(
    <BoardContext.Provider value={controller}>
      <DndContext>
        <FocusProbe />
        <SheetHost />
      </DndContext>
    </BoardContext.Provider>,
  );
  return { controller, session, sheets, gateway, toast };
}

describe("Board drop flow (repro)", () => {
  afterEach(() => {
    cleanup();
  });

  it("direct drop commits without crashing focus restoration or announcements", async () => {
    const { controller, session, gateway, toast } = setup([directCard]);
    act(() => {
      session.start(directCard);
    });
    await act(async () => {
      await controller.handleDrop("design");
    });
    expect(gateway.moveInvocations).toHaveLength(1);
    expect(document.getElementById("__board-live-announcer")?.textContent).toContain("تم نقل");
    expect(toast).toHaveBeenCalled();
  });

  it("sheet-gated drop opens the detail modal and survives cancel", async () => {
    const { controller, session, sheets, gateway } = setup([sheetCard]);
    act(() => {
      session.start(sheetCard);
    });
    let dropPromise: Promise<void> | null = null;
    act(() => {
      dropPromise = controller.handleDrop("design");
    });
    // The detail modal pops while the drop awaits input (the sheet is
    // dynamically imported, so it resolves a tick after the dialog opens).
    expect(await screen.findByText(/تعيين مصمم/)).toBeInTheDocument();
    await act(async () => {
      sheets.cancel();
      await dropPromise;
    });
    // Cancelled: no move sent, fly-back played, no crash.
    expect(gateway.moveInvocations).toHaveLength(0);
    expect(screen.queryByText(/تعيين مصمم/)).not.toBeInTheDocument();
  });

  it("section drop executes the hovered section's move, not the station's first match", async () => {
    const reworkFirst = makeCard("c-sections", [
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
    ]);
    const inDesignCard = { ...reworkFirst, state: "IN_DESIGN" as const };
    const { controller, session, gateway } = setup([inDesignCard]);
    act(() => {
      session.start(inDesignCard);
    });
    await act(async () => {
      await controller.handleDrop("DESIGN_COMPLETED");
    });
    expect(gateway.moveInvocations).toHaveLength(1);
    expect(gateway.moveInvocations[0]?.edgeId).toBe("IN_DESIGN->DESIGN_COMPLETED");
  });
});
