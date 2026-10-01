import { describe, expect, it } from "vitest";
import {
  WORKFLOW_STATIONS,
  getActiveStepIndex,
  formatDimensions,
  toDimString,
} from "~/lib/orders/workflowStation";
import { isRollProductTypeName } from "~/server/production-spec/constraints";

describe("workflowStation", () => {
  describe("getActiveStepIndex", () => {
    it("returns -1 for empty workItems when order is CANCELLED", () => {
      expect(getActiveStepIndex("CANCELLED", [])).toBe(-1);
    });

    it("returns 4 for empty workItems when order is COMPLETED or DELIVERED", () => {
      expect(getActiveStepIndex("COMPLETED", [])).toBe(4);
      expect(getActiveStepIndex("DELIVERED", [])).toBe(4);
    });

    it("returns 0 for empty workItems by default", () => {
      expect(getActiveStepIndex("NOT_STARTED", [])).toBe(0);
    });

    it("returns -1 if all work items are CANCELLED", () => {
      expect(
        getActiveStepIndex("CANCELLED", [
          { state: "CANCELLED" },
          { state: "CANCELLED" },
        ]),
      ).toBe(-1);
    });

    it("returns 2 (Review) when single work item is WAITING_REVIEW (Fixes the reported bug)", () => {
      // The user's order had deriveOrderStatus = "PARTIALLY_READY"
      // and a single item with state "WAITING_REVIEW"
      expect(
        getActiveStepIndex("PARTIALLY_READY", [{ state: "WAITING_REVIEW" }]),
      ).toBe(2);
      expect(WORKFLOW_STATIONS[2]?.label).toBe("المراجعة");
    });

    it("returns 2 (Review) for other review states (APPROVED, WAITING_PRICING)", () => {
      expect(getActiveStepIndex("PARTIALLY_READY", [{ state: "APPROVED" }])).toBe(2);
      expect(
        getActiveStepIndex("PARTIALLY_READY", [{ state: "WAITING_PRICING" }]),
      ).toBe(2);
    });

    it("returns 1 (Design) when single work item is IN_DESIGN or ASSIGNED", () => {
      expect(getActiveStepIndex("PARTIALLY_READY", [{ state: "IN_DESIGN" }])).toBe(1);
      expect(getActiveStepIndex("PARTIALLY_READY", [{ state: "ASSIGNED" }])).toBe(1);
      expect(
        getActiveStepIndex("PARTIALLY_READY", [{ state: "REWORK_REQUIRED" }]),
      ).toBe(1);
      expect(
        getActiveStepIndex("PARTIALLY_READY", [{ state: "DESIGN_COMPLETED" }]),
      ).toBe(1);
      expect(WORKFLOW_STATIONS[1]?.label).toBe("التصميم");
    });

    it("returns 3 (Printing) when work item is in production", () => {
      expect(
        getActiveStepIndex("IN_PRODUCTION", [{ state: "IN_PRODUCTION" }]),
      ).toBe(3);
      expect(
        getActiveStepIndex("PARTIALLY_READY", [{ state: "READY_FOR_PRODUCTION" }]),
      ).toBe(3);
      expect(
        getActiveStepIndex("PARTIALLY_READY", [{ state: "PRODUCTION_COMPLETED" }]),
      ).toBe(3);
      expect(
        getActiveStepIndex("PARTIALLY_READY", [{ state: "READY_FOR_COLLECTION" }]),
      ).toBe(3);
      expect(WORKFLOW_STATIONS[3]?.label).toBe("الطباعة");
    });

    it("prioritizes production over review when items are in mixed stages", () => {
      expect(
        getActiveStepIndex("PARTIALLY_READY", [
          { state: "WAITING_REVIEW" },
          { state: "IN_PRODUCTION" },
        ]),
      ).toBe(3);
    });

    it("prioritizes review over design when items are in mixed stages", () => {
      expect(
        getActiveStepIndex("PARTIALLY_READY", [
          { state: "IN_DESIGN" },
          { state: "WAITING_REVIEW" },
        ]),
      ).toBe(2);
    });

    it("returns 4 (Delivery) when all non-cancelled items are COMPLETED or DELIVERED", () => {
      expect(
        getActiveStepIndex("COMPLETED", [
          { state: "COMPLETED" },
          { state: "DELIVERED" },
          { state: "CANCELLED" },
        ]),
      ).toBe(4);
      expect(WORKFLOW_STATIONS[4]?.label).toBe("التسليم");
    });

    it("returns 0 (Reception) when items are in NEW or initial stage", () => {
      expect(getActiveStepIndex("NOT_STARTED", [{ state: "NEW" }])).toBe(0);
      expect(WORKFLOW_STATIONS[0]?.label).toBe("الاستقبال");
    });
  });

  describe("toDimString & formatDimensions", () => {
    it("handles Prisma Decimal objects (having toString method)", () => {
      const mockDecimal = {
        toString: () => "120.5",
      };
      expect(toDimString(mockDecimal)).toBe("120.5");
      expect(formatDimensions(mockDecimal, 80, "CM")).toBe("120.5 × 80 سم");
    });

    it("handles numbers and strings", () => {
      expect(formatDimensions(300, 150, "CM")).toBe("300 × 150 سم");
      expect(formatDimensions("2.5", "1.2", "M")).toBe("2.5 × 1.2 م");
    });

    it("handles dimension unit localization", () => {
      expect(formatDimensions(10, 20, "MM")).toBe("10 × 20 مم");
      expect(formatDimensions(10, 20, "IN")).toBe("10 × 20 بوصة");
      expect(formatDimensions(10, 20, "CM")).toBe("10 × 20 سم");
      expect(formatDimensions(10, 20, "M")).toBe("10 × 20 م");
      expect(formatDimensions(10, 20, null)).toBe("10 × 20 سم");
    });

    it("handles partial dimensions (only width or only height)", () => {
      expect(formatDimensions(100, null, "CM")).toBe("100 سم");
      expect(formatDimensions(null, 200, "CM")).toBe("200 سم");
    });

    it("returns '—' when both dimensions are missing or null", () => {
      expect(formatDimensions(null, null, "CM")).toBe("—");
      expect(formatDimensions(undefined, undefined, null)).toBe("—");
      expect(formatDimensions("", "", "CM")).toBe("—");
    });
  });

  describe("isRollProductTypeName", () => {
    it("recognizes flex and banner product names in Arabic and English", () => {
      expect(isRollProductTypeName("يافطة فليكس إضاءة واجهة")).toBe(true);
      expect(isRollProductTypeName("بنر وفليكس (أوفست)")).toBe(true);
      expect(isRollProductTypeName("فليكس بنر")).toBe(true);
      expect(isRollProductTypeName("Flex Outdoor Sign")).toBe(true);
      expect(isRollProductTypeName("Roll-up Banner")).toBe(true);
      expect(isRollProductTypeName("استيكر فينيل")).toBe(true);
      expect(isRollProductTypeName("Vinyl Sticker")).toBe(true);
    });

    it("returns false for non-roll products", () => {
      expect(isRollProductTypeName("كارت شخصي فاخر")).toBe(false);
      expect(isRollProductTypeName("بروشور A4")).toBe(false);
      expect(isRollProductTypeName("فولدر أوراق")).toBe(false);
    });
  });
});
