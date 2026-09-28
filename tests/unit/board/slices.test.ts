import { describe, expect, it } from "vitest";
import {
  ROLE_DEFAULT_SLICE,
  ROLE_PRECEDENCE,
  resolveAvailableSlices,
  resolveDefaultSlice,
  SLICES,
} from "~/server/board/slices";

describe("Role slice resolution (FR-021)", () => {
  it("resolves default slice for each single role", () => {
    expect(resolveDefaultSlice(["ADMIN_OWNER"])).toBe("floor");
    expect(resolveDefaultSlice(["HEAD_DESIGNER"])).toBe("head-designer");
    expect(resolveDefaultSlice(["ACCOUNTING"])).toBe("accounting");
    expect(resolveDefaultSlice(["RECEPTION"])).toBe("reception");
    expect(resolveDefaultSlice(["PRINT_RECEPTION_DELIVERY"])).toBe("delivery");
    expect(resolveDefaultSlice(["PRODUCTION_OPERATOR"])).toBe("production");
    expect(resolveDefaultSlice(["DESIGNER"])).toBe("designer");
  });

  it("resolves multi-role precedence: Admin > Head Designer > Accounting > Reception > Delivery > Production > Designer", () => {
    expect(resolveDefaultSlice(["DESIGNER", "HEAD_DESIGNER"])).toBe("head-designer");
    expect(resolveDefaultSlice(["DESIGNER", "PRODUCTION_OPERATOR"])).toBe("production");
    expect(resolveDefaultSlice(["PRINT_RECEPTION_DELIVERY", "RECEPTION"])).toBe("reception");
    expect(resolveDefaultSlice(["ACCOUNTING", "RECEPTION"])).toBe("accounting");
    expect(resolveDefaultSlice(["DESIGNER", "ADMIN_OWNER"])).toBe("floor");
  });

  it("resolves available slices for single and multi-role users", () => {
    const adminSlices = resolveAvailableSlices(["ADMIN_OWNER"]);
    expect(adminSlices).toEqual(SLICES.map((s) => s.id));

    const designerHead = resolveAvailableSlices(["DESIGNER", "HEAD_DESIGNER"]);
    expect(designerHead).toContain("designer");
    expect(designerHead).toContain("head-designer");
  });
});
