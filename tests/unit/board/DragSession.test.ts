/**
 * Unit tests for DragSession state machine.
 * (T061, contracts/board-engine.md §DragSession, research.md R1)
 */

import { describe, expect, it, vi } from "vitest";
import { DragSession } from "~/lib/board/drag/DragSession";
import type { BoardCard, MoveOption } from "~/lib/board/types";

function createCardWithMoves(moves: MoveOption[]): BoardCard {
  return {
    id: "card-drag-1",
    orderId: "ord-1",
    orderNumber: 101,
    orderTagHue: 100,
    customerName: "عميل",
    title: "مطبوعات",
    quantity: 10,
    state: "ASSIGNED",
    priority: "NORMAL",
    pricing: "NOT_REQUIRED",
    enteredStationAt: new Date().toISOString(),
    targetMinutes: null,
    dueAt: null,
    reworkCount: 0,
    assignee: null,
    departmentId: null,
    moves,
    lastTransitionId: null,
    lastTransitionAt: new Date().toISOString(),
  };
}

describe("DragSession (T061, contracts/board-engine.md §DragSession)", () => {
  const inDesignOption: MoveOption = {
    edgeId: "ASSIGNED->IN_DESIGN",
    to: "IN_DESIGN",
    kind: "DIRECT",
    sheet: null,
    screenHref: null,
    backward: false,
    destructive: false,
    groupable: false,
    labelAr: "بدء التصميم",
  };

  it("starts drag session, computes offered station targets, and notifies subscribers", () => {
    const session = new DragSession();
    const card = createCardWithMoves([inDesignOption]);

    const listener = vi.fn();
    session.subscribe(listener);

    expect(session.state).toBe("idle");
    session.start(card);

    expect(session.state).toBe("dragging");
    expect(session.activeCard).toBe(card);
    expect(session.isOffered("design")).toBe(true);
    expect(session.isOffered("reception")).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it("resolves legal drop to target station and resets to idle", () => {
    const session = new DragSession();
    const card = createCardWithMoves([inDesignOption]);
    session.start(card);

    const option = session.resolveDrop("design");
    expect(option).toEqual(inDesignOption);
    expect(session.state).toBe("idle");
    expect(session.activeCard).toBeNull();
  });

  it("returns null on illegal drop target and cancels session", () => {
    const session = new DragSession();
    const card = createCardWithMoves([inDesignOption]);
    session.start(card);

    const option = session.resolveDrop("delivered");
    expect(option).toBeNull();
    expect(session.state).toBe("idle");
  });

  it("cancels active session cleanly on escape/cancel", () => {
    const session = new DragSession();
    const card = createCardWithMoves([inDesignOption]);
    session.start(card);

    session.cancel();
    expect(session.state).toBe("idle");
    expect(session.activeCard).toBeNull();
    expect(session.offeredStations.size).toBe(0);
  });
});
