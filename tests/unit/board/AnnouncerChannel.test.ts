// @vitest-environment jsdom
/**
 * Unit tests for AnnouncerChannel.
 * (specs/017-press-floor-board/contracts/board-engine.md §Accessibility, FR-032, plan.md S1)
 */

import { describe, expect, it, beforeEach } from "vitest";
import { AnnouncerChannel } from "~/lib/board/feedback/AnnouncerChannel";
import type { BoardCard } from "~/lib/board/types";

describe("AnnouncerChannel (T137)", () => {
  beforeEach(() => {
    const existing = document.getElementById("__board-live-announcer");
    existing?.remove();
  });

  const mockCard: BoardCard = {
    id: "card-1",
    orderId: "ord-1",
    orderNumber: 101,
    orderTagHue: 120,
    customerName: "شركة الفجر",
    title: "طباعة بروشور",
    quantity: 500,
    state: "IN_PRODUCTION",
    priority: "NORMAL",
    pricing: "PRICED",
    enteredStationAt: new Date().toISOString(),
    targetMinutes: 120,
    dueAt: null,
    reworkCount: 0,
    assignee: null,
    departmentId: "dept-1",
    moves: [],
    lastTransitionId: "t-1",
    lastTransitionAt: new Date().toISOString(),
  };

  it("announces MOVE_COMMITTED in Arabic into aria-live region", () => {
    const announcer = new AnnouncerChannel();
    announcer.handle({
      type: "MOVE_COMMITTED",
      card: mockCard,
      transitionIds: ["t-1"],
    });

    const region = document.getElementById("__board-live-announcer");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.textContent).toContain("شركة الفجر");
    expect(region?.textContent).toContain("طباعة بروشور");
  });

  it("announces MOVED_BY_OTHER in Arabic", () => {
    const announcer = new AnnouncerChannel();
    announcer.handle({
      type: "MOVED_BY_OTHER",
      cardId: "card-1",
      actorName: "خالد",
      toState: "DELIVERED",
    });

    const region = document.getElementById("__board-live-announcer");
    expect(region?.textContent).toContain("نقلها خالد");
  });

  it("announces MOVE_REFUSED in Arabic", () => {
    const announcer = new AnnouncerChannel();
    announcer.handle({
      type: "MOVE_REFUSED",
      cardId: "card-1",
      code: "GUARD_FAILED",
      messageAr: "يجب حسم التسعير أولاً",
    });

    const region = document.getElementById("__board-live-announcer");
    expect(region?.textContent).toBe("يجب حسم التسعير أولاً");
  });
});
