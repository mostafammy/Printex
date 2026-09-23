// Unit tests for isOrderComplete/isOrderFinished/PRE_DESIGN_EDITABLE_STATES —
// specs/011-orders-reception/data-model.md, tasks.md T009.

import { describe, expect, it } from "vitest";
import {
  isOrderComplete,
  isOrderFinished,
  PRE_DESIGN_EDITABLE_STATES,
} from "~/server/orders/completeness";
import type { WorkItemState } from "~/server/core";

const COMPLETE_ITEM = {
  productTypeId: "pt_1",
  quantity: 10,
  widthValue: 5,
  heightValue: 5,
  dimensionUnit: "CM" as const,
  departmentId: "dept_1",
};

describe("isOrderComplete", () => {
  it("returns true when every Work Item has all six completeness fields set", () => {
    expect(isOrderComplete({ workItems: [COMPLETE_ITEM, COMPLETE_ITEM] })).toBe(true);
  });

  it("returns false when a Work Item is missing productTypeId", () => {
    expect(
      isOrderComplete({ workItems: [{ ...COMPLETE_ITEM, productTypeId: null }] }),
    ).toBe(false);
  });

  it("returns false when a Work Item is missing quantity", () => {
    expect(isOrderComplete({ workItems: [{ ...COMPLETE_ITEM, quantity: null }] })).toBe(
      false,
    );
  });

  it("returns false when a Work Item is missing widthValue", () => {
    expect(isOrderComplete({ workItems: [{ ...COMPLETE_ITEM, widthValue: null }] })).toBe(
      false,
    );
  });

  it("returns false when a Work Item is missing heightValue", () => {
    expect(
      isOrderComplete({ workItems: [{ ...COMPLETE_ITEM, heightValue: null }] }),
    ).toBe(false);
  });

  it("returns false when a Work Item is missing dimensionUnit (width/height set but no unit)", () => {
    expect(
      isOrderComplete({ workItems: [{ ...COMPLETE_ITEM, dimensionUnit: null }] }),
    ).toBe(false);
  });

  it("returns false when a Work Item is missing departmentId", () => {
    expect(
      isOrderComplete({ workItems: [{ ...COMPLETE_ITEM, departmentId: null }] }),
    ).toBe(false);
  });

  it("returns true (vacuously) for an order with zero Work Items", () => {
    expect(isOrderComplete({ workItems: [] })).toBe(true);
  });

  it("returns false when one of several Work Items is incomplete", () => {
    expect(
      isOrderComplete({ workItems: [COMPLETE_ITEM, { ...COMPLETE_ITEM, quantity: null }] }),
    ).toBe(false);
  });
});

function items(...states: WorkItemState[]) {
  return states.map((state) => ({ state }));
}

describe("isOrderFinished", () => {
  it("returns true when every Work Item is DELIVERED, COMPLETED, or CANCELLED", () => {
    expect(isOrderFinished(items("DELIVERED", "COMPLETED", "CANCELLED"))).toBe(true);
  });

  it("returns false when one Work Item is still non-terminal", () => {
    expect(isOrderFinished(items("DELIVERED", "IN_DESIGN"))).toBe(false);
  });

  it("returns true (vacuously) for zero Work Items", () => {
    expect(isOrderFinished([])).toBe(true);
  });
});

describe("PRE_DESIGN_EDITABLE_STATES", () => {
  it("contains NEW and ASSIGNED", () => {
    expect(PRE_DESIGN_EDITABLE_STATES.has("NEW")).toBe(true);
    expect(PRE_DESIGN_EDITABLE_STATES.has("ASSIGNED")).toBe(true);
  });

  it("does not contain any other WorkItemState", () => {
    const others: WorkItemState[] = [
      "IN_DESIGN",
      "DESIGN_COMPLETED",
      "WAITING_REVIEW",
      "REWORK_REQUIRED",
      "APPROVED",
      "WAITING_PRICING",
      "READY_FOR_PRODUCTION",
      "IN_PRODUCTION",
      "PRODUCTION_COMPLETED",
      "READY_FOR_COLLECTION",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ];
    for (const state of others) {
      expect(PRE_DESIGN_EDITABLE_STATES.has(state)).toBe(false);
    }
  });
});
