/**
 * Unit tests for SheetDropPolicy and ScreenDropPolicy.
 * (specs/017-press-floor-board/contracts/board-engine.md §Drop policies, FR-015, FR-016, plan.md S1)
 */

import { describe, expect, it, vi } from "vitest";
import { SheetDropPolicy } from "~/lib/board/policies/SheetDropPolicy";
import { ScreenDropPolicy } from "~/lib/board/policies/ScreenDropPolicy";
import { SheetManager } from "~/lib/board/sheets/SheetManager";
import type { BoardCard, MoveOption } from "~/lib/board/types";
import type { MotionPort } from "~/lib/board/ports";

const baseCard: BoardCard = {
  id: "c-100",
  orderId: "ord-1",
  orderNumber: 42,
  orderTagHue: 180,
  customerName: "عميل تجريبي",
  title: "كرت شخصي",
  quantity: 100,
  state: "WAITING_REVIEW",
  priority: "NORMAL",
  pricing: "PRICED",
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

describe("SheetDropPolicy and ScreenDropPolicy (T104)", () => {
  it("ScreenDropPolicy flies back card and redirects to screenHref", async () => {
    const playFn = vi.fn().mockResolvedValue(undefined);
    const motion: MotionPort = {
      play: playFn,
      measure: () => null,
    };
    const navigateFn = vi.fn();

    const policy = new ScreenDropPolicy({
      motion,
      navigate: navigateFn,
    });

    const option: MoveOption = {
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

    await policy.onDrop({ card: baseCard, option });

    expect(playFn).toHaveBeenCalledWith("fly-back", { cardId: "c-100" });
    expect(navigateFn).toHaveBeenCalledWith("/pricing?workItem=c-100");
  });

  it("SheetDropPolicy opens sheet via SheetManager and plays fly-back on cancel", async () => {
    const playFn = vi.fn().mockResolvedValue(undefined);
    const motion: MotionPort = {
      play: playFn,
      measure: () => null,
    };
    const sheetManager = new SheetManager();

    const policy = new SheetDropPolicy({
      moveDeps: {
        store: { applyOptimistic: vi.fn(), commit: vi.fn(), rollback: vi.fn() } as unknown as any,
        gateway: { move: vi.fn() } as unknown as any,
        motion,
        feedback: { notify: vi.fn() },
      },
      sheetManager,
    });

    const option: MoveOption = {
      edgeId: "WAITING_REVIEW->REWORK_REQUIRED",
      to: "REWORK_REQUIRED",
      kind: "SHEET",
      sheet: "reject-design",
      screenHref: null,
      backward: true,
      destructive: false,
      groupable: false,
      labelAr: "إرجاع للتصميم",
    };

    const dropPromise = policy.onDrop({ card: baseCard, option });

    expect(sheetManager.current).not.toBeNull();
    expect(sheetManager.current?.sheetId).toBe("reject-design");

    // Cancel sheet
    sheetManager.cancel();
    await dropPromise;

    expect(playFn).toHaveBeenCalledWith("fly-back", { cardId: "c-100" });
  });
});
