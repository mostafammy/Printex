import { describe, expect, it } from "vitest";
import { ALLOWED_EDGES } from "~/server/core";

describe("016 workflow edges (T021)", () => {
  it("includes REWORK_REQUIRED in APPROVED edges", () => {
    expect(ALLOWED_EDGES.APPROVED).toContain("REWORK_REQUIRED");
  });

  it("includes REWORK_REQUIRED in WAITING_PRICING edges", () => {
    expect(ALLOWED_EDGES.WAITING_PRICING).toContain("REWORK_REQUIRED");
  });

  it("includes REWORK_REQUIRED in READY_FOR_PRODUCTION edges", () => {
    expect(ALLOWED_EDGES.READY_FOR_PRODUCTION).toContain("REWORK_REQUIRED");
  });

  it("does not include REWORK_REQUIRED in DESIGN_COMPLETED edges", () => {
    expect(ALLOWED_EDGES.DESIGN_COMPLETED).not.toContain("REWORK_REQUIRED");
  });
});
