// @vitest-environment jsdom
//
// Controller-level navigation test — 092-performance T033 (US6, AC-018,
// FR-024, NB-004). Fails until T034 replaces the `window.location.href`
// default in `createBoardController`.
//
// Drives the real SCREEN drop path (WAITING_PRICING -> READY_FOR_PRODUCTION)
// through the resolver-built ScreenDropPolicy with an injected `navigate`
// spy and asserts:
//   1. the spy receives the exact destination href INCLUDING the query;
//   2. jsdom's `window.location` is untouched (no document-reload path ran);
//   3. a controller WITHOUT an injected navigate rejects with
//      "navigate not wired" — the old `window.location.href` fallback is
//      gone as a code path, not merely unused.

import { describe, expect, it, vi } from "vitest";
import { createBoardController } from "~/lib/board/createBoardController";
import type { BoardCard, BoardSnapshot, MoveOption } from "~/lib/board/types";
import { FakeClock, FakeFeedbackPort, FakeLiveSource, FakeMotionPort, FakeSnapshotGateway } from "./fakes";

const initialSnapshot: BoardSnapshot = {
  generatedAt: "2026-09-26T12:00:00Z",
  cards: [],
  hiddenSiblingCounts: {},
  slice: "floor",
  availableSlices: ["floor"],
  blockedHints: [],
};

const card: BoardCard = {
  id: "c-100",
  orderId: "ord-1",
  orderNumber: 42,
  orderTagHue: 180,
  customerName: "عميل تجريبي",
  title: "كرت شخصي",
  quantity: 100,
  state: "WAITING_PRICING",
  priority: "NORMAL",
  pricing: "PENDING",
  enteredStationAt: new Date().toISOString(),
  targetMinutes: 60,
  dueAt: null,
  reworkCount: 0,
  assignee: null,
  departmentId: "d-1",
  moves: [],
  lastTransitionId: null,
  lastTransitionAt: new Date().toISOString(),
};

/** The SCREEN move for WAITING_PRICING -> READY_FOR_PRODUCTION (the only
 *  SCREEN edge whose href carries a selection query). */
const screenOption: MoveOption = {
  edgeId: "WAITING_PRICING->READY_FOR_PRODUCTION",
  to: "READY_FOR_PRODUCTION",
  kind: "SCREEN",
  sheet: null,
  screenHref: "/pricing?workItem=c-100",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "تسعير",
};

const DESTINATION = "/pricing?workItem=c-100";

function buildController(navigate?: (href: string) => void) {
  const motion = new FakeMotionPort();
  const controller = createBoardController(initialSnapshot, {
    clock: new FakeClock(),
    snapshotGateway: new FakeSnapshotGateway(),
    motion,
    feedback: new FakeFeedbackPort(),
    liveSource: new FakeLiveSource(),
    ...(navigate ? { navigate } : {}),
  });
  return { controller, motion };
}

describe("board controller SCREEN navigation (T033 / AC-018)", () => {
  it("soft-navigates via the injected navigate spy with path + query intact", async () => {
    const locationBefore = window.location.href;
    const navigateSpy = vi.fn();
    const { controller, motion } = buildController(navigateSpy);

    await controller.executeMove(card, screenOption);

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(DESTINATION);
    // ScreenDropPolicy ran (fly-back, no optimistic move) — the spy was
    // reached through the real drop-policy resolver, not a shortcut.
    expect(motion.plays).toEqual([{ kind: "fly-back", ctx: { cardId: "c-100" } }]);
    // jsdom's location is untouched: no document navigation was attempted.
    expect(window.location.href).toBe(locationBefore);
    expect(window.location.href).not.toContain("/pricing");
  });

  it("throws \"navigate not wired\" instead of falling back to window.location.href", async () => {
    const locationBefore = window.location.href;
    const { controller } = buildController();

    await expect(controller.executeMove(card, screenOption)).rejects.toThrow(
      /navigate not wired/,
    );
    expect(window.location.href).toBe(locationBefore);
  });
});
