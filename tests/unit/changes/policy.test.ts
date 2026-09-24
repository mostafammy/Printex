import { describe, expect, it } from "vitest";
import { WORK_ITEM_STATES, type WorkItemState } from "~/server/core";
import {
  canRedesignOnApproval,
  redesignChoice,
  specEditPolicy,
  type SpecEditPolicy,
} from "~/server/changes/policy";

describe("policy (T013)", () => {
  describe("specEditPolicy", () => {
    it("has exactly 15 states in WORK_ITEM_STATES", () => {
      expect(WORK_ITEM_STATES).toHaveLength(15);
    });

    const expectedPolicy: Record<WorkItemState, SpecEditPolicy> = {
      NEW: "DIRECT",
      ASSIGNED: "DIRECT",
      IN_DESIGN: "DIRECT",
      DESIGN_COMPLETED: "DIRECT",
      WAITING_REVIEW: "DIRECT",
      REWORK_REQUIRED: "DIRECT",
      APPROVED: "DIRECT",
      WAITING_PRICING: "DIRECT",
      READY_FOR_PRODUCTION: "DIRECT",
      IN_PRODUCTION: "CHANGE_REQUEST",
      PRODUCTION_COMPLETED: "ADMIN_ONLY",
      READY_FOR_COLLECTION: "ADMIN_ONLY",
      DELIVERED: "ADMIN_ONLY",
      COMPLETED: "ADMIN_ONLY",
      CANCELLED: "LOCKED",
    };

    it.each(WORK_ITEM_STATES)("classifies %s according to FR-006", (state) => {
      expect(specEditPolicy(state)).toBe(expectedPolicy[state]);
    });

    it("covers all 15 states with 9 DIRECT, 1 CHANGE_REQUEST, 4 ADMIN_ONLY, 1 LOCKED", () => {
      const counts: Record<SpecEditPolicy, number> = {
        DIRECT: 0,
        CHANGE_REQUEST: 0,
        ADMIN_ONLY: 0,
        LOCKED: 0,
      };

      for (const state of WORK_ITEM_STATES) {
        const policy = specEditPolicy(state);
        counts[policy]++;
      }

      expect(counts.DIRECT).toBe(9);
      expect(counts.CHANGE_REQUEST).toBe(1);
      expect(counts.ADMIN_ONLY).toBe(4);
      expect(counts.LOCKED).toBe(1);
    });
  });

  describe("redesignChoice truth table", () => {
    const requiredStates: WorkItemState[] = [
      "APPROVED",
      "WAITING_PRICING",
      "READY_FOR_PRODUCTION",
    ];

    it.each(requiredStates)(
      "returns REQUIRED when state is %s and requiresDesign is true",
      (state) => {
        expect(redesignChoice(state, true)).toBe("REQUIRED");
      },
    );

    it.each(requiredStates)(
      "returns FORBIDDEN when state is %s and requiresDesign is false",
      (state) => {
        expect(redesignChoice(state, false)).toBe("FORBIDDEN");
      },
    );

    const otherStates = WORK_ITEM_STATES.filter(
      (s) => !requiredStates.includes(s),
    );

    it.each(otherStates)(
      "returns FORBIDDEN for %s regardless of requiresDesign",
      (state) => {
        expect(redesignChoice(state, true)).toBe("FORBIDDEN");
        expect(redesignChoice(state, false)).toBe("FORBIDDEN");
      },
    );
  });

  describe("canRedesignOnApproval", () => {
    it("returns true only when requiresDesign is true and assigneeId is non-null", () => {
      expect(
        canRedesignOnApproval({ requiresDesign: true, assigneeId: "user-123" }),
      ).toBe(true);
      expect(
        canRedesignOnApproval({ requiresDesign: false, assigneeId: "user-123" }),
      ).toBe(false);
      expect(
        canRedesignOnApproval({ requiresDesign: true, assigneeId: null }),
      ).toBe(false);
      expect(
        canRedesignOnApproval({ requiresDesign: true, assigneeId: undefined }),
      ).toBe(false);
      expect(
        canRedesignOnApproval({ requiresDesign: false, assigneeId: null }),
      ).toBe(false);
      expect(
        canRedesignOnApproval({ requiresDesign: true, assigneeId: "" }),
      ).toBe(false);
    });
  });
});
