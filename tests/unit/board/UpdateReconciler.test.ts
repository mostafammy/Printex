/**
 * Unit tests for UpdateReconciler.
 * (specs/017-press-floor-board/plan.md S1, data-model.md §3.3)
 */

import { describe, expect, it } from "vitest";
import { reconcileUpdate } from "~/lib/board/store/UpdateReconciler";
import type { BoardUpdate } from "~/lib/board/types";

describe("UpdateReconciler (T123)", () => {
  const mockUpdate: BoardUpdate = {
    transitionId: "t-100",
    workItemId: "w-item-1",
    orderId: "ord-1",
    from: "NEW",
    to: "ASSIGNED",
    actor: { id: "user-1", name: "محمود" },
    at: new Date().toISOString(),
  };

  it("confirms optimistic update when workItemId matches pending token card", () => {
    const action = reconcileUpdate(mockUpdate, "w-item-1");
    expect(action.type).toBe("CONFIRM_OPTIMISTIC");
    if (action.type === "CONFIRM_OPTIMISTIC") {
      expect(action.cardId).toBe("w-item-1");
    }
  });

  it("applies foreign update when workItemId does not match pending token card", () => {
    const action = reconcileUpdate(mockUpdate, "other-item");
    expect(action.type).toBe("APPLY_FOREIGN");
    if (action.type === "APPLY_FOREIGN") {
      expect(action.update.transitionId).toBe("t-100");
    }
  });

  it("applies foreign update when no pending move exists", () => {
    const action = reconcileUpdate(mockUpdate, null);
    expect(action.type).toBe("APPLY_FOREIGN");
  });
});
