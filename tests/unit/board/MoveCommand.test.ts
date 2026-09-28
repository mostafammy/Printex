/**
 * Unit tests for BoardCommand and MoveCommand lifecycle.
 * (T059, contracts/board-engine.md §Commands, FR-014)
 */

import { describe, expect, it, vi } from "vitest";
import { MoveCommand } from "~/lib/board/commands/MoveCommand";
import type { FeedbackPort, MotionPort, MoveGateway } from "~/lib/board/ports";
import { BoardStore } from "~/lib/board/store/BoardStore";
import type { BoardCard, BoardSnapshot, MoveOption } from "~/lib/board/types";

function createMockCard(): BoardCard {
  return {
    id: "card-1",
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
    moves: [],
    lastTransitionId: null,
    lastTransitionAt: new Date().toISOString(),
  };
}

function createMockSnapshot(card: BoardCard): BoardSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    cards: [card],
    hiddenSiblingCounts: {},
    slice: "floor",
    availableSlices: ["floor"],
    blockedHints: [],
  };
}

describe("MoveCommand (T059, 6-step lifecycle)", () => {
  it("executes successful forward move: optimistic apply -> travel -> commit -> stamp -> notify", async () => {
    const card = createMockCard();
    const store = new BoardStore(createMockSnapshot(card), { now: () => 1000 }, (_cb: () => void): void => undefined);

    const gateway: MoveGateway = {
      move: vi.fn().mockResolvedValue({
        ok: true,
        card: { ...card, state: "IN_DESIGN" },
        transitionIds: ["t-new-1"],
      }),
      moveGroup: vi.fn(),
      cards: vi.fn(),
    };

    const motion: MotionPort = {
      measure: vi.fn().mockReturnValue({ top: 10, left: 10, width: 100, height: 50, right: 110, bottom: 60, x: 10, y: 10 }),
      play: vi.fn().mockResolvedValue(undefined),
    };

    const feedback: FeedbackPort = {
      notify: vi.fn(),
    };

    const option: MoveOption = {
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

    const cmd = new MoveCommand({ store, gateway, motion, feedback }, { card, option });
    const outcome = await cmd.execute();

    expect(outcome.success).toBe(true);
    expect(cmd.state).toBe("committed");

    // Motion calls: travel -> stamp
    expect(motion.play).toHaveBeenCalledWith("travel", expect.objectContaining({ cardId: "card-1" }));
    expect(motion.play).toHaveBeenCalledWith("stamp", expect.objectContaining({ cardId: "card-1" }));

    // Store committed: card state in store is now IN_DESIGN
    expect(store.getCard("card-1")?.state).toBe("IN_DESIGN");

    // Feedback notified
    expect(feedback.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "MOVE_COMMITTED" }),
    );
  });

  it("handles refusal: optimistic apply -> rollback -> fly-back -> notify", async () => {
    const card = createMockCard();
    const store = new BoardStore(createMockSnapshot(card), { now: () => 1000 }, (_cb: () => void): void => undefined);

    const gateway: MoveGateway = {
      move: vi.fn().mockResolvedValue({
        ok: false,
        code: "GUARD_FAILED",
        messageAr: "فشل التحقق من الشروط",
      }),
      moveGroup: vi.fn(),
      cards: vi.fn(),
    };

    const motion: MotionPort = {
      measure: vi.fn().mockReturnValue({ top: 10, left: 10, width: 100, height: 50, right: 110, bottom: 60, x: 10, y: 10 }),
      play: vi.fn().mockResolvedValue(undefined),
    };

    const feedback: FeedbackPort = {
      notify: vi.fn(),
    };

    const option: MoveOption = {
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

    const cmd = new MoveCommand({ store, gateway, motion, feedback }, { card, option });
    const outcome = await cmd.execute();

    expect(outcome.success).toBe(false);
    expect(cmd.state).toBe("rolledBack");

    // Motion called fly-back
    expect(motion.play).toHaveBeenCalledWith("fly-back", expect.objectContaining({ cardId: "card-1" }));

    // Card restored to ASSIGNED
    expect(store.getCard("card-1")?.state).toBe("ASSIGNED");

    // Feedback notified
    expect(feedback.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "MOVE_REFUSED", code: "GUARD_FAILED" }),
    );
  });

  it("handles STALE_STATE by upserting the fresh server card", async () => {
    const card = createMockCard();
    const store = new BoardStore(createMockSnapshot(card), { now: () => 1000 }, (_cb: () => void): void => undefined);

    const freshServerCard = { ...card, state: "DESIGN_COMPLETED" as const };

    const gateway: MoveGateway = {
      move: vi.fn().mockResolvedValue({
        ok: false,
        code: "STALE_STATE",
        messageAr: "تغيرت حالة أمر العمل",
        card: freshServerCard,
      }),
      moveGroup: vi.fn(),
      cards: vi.fn(),
    };

    const motion: MotionPort = {
      measure: vi.fn().mockReturnValue(null),
      play: vi.fn().mockResolvedValue(undefined),
    };

    const feedback: FeedbackPort = {
      notify: vi.fn(),
    };

    const option: MoveOption = {
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

    const cmd = new MoveCommand({ store, gateway, motion, feedback }, { card, option });
    await cmd.execute();

    // Store holds fresh server card in DESIGN_COMPLETED
    expect(store.getCard("card-1")?.state).toBe("DESIGN_COMPLETED");
  });
});
