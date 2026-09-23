// Unit tests for src/server/review/**'s pure logic — Foundational T007,
// US3 T022, US6 T037. No database required.

import { describe, expect, it } from "vitest";
import { isSelfReview } from "~/server/review/selfReview";

describe("isSelfReview", () => {
  it("returns true when the current version's uploader is the acting reviewer", () => {
    expect(isSelfReview("user_1", "user_1")).toBe(true);
  });

  it("returns false when the current version's uploader differs from the acting reviewer", () => {
    expect(isSelfReview("user_1", "user_2")).toBe(false);
  });

  it("returns false when there is no current version to compare against", () => {
    expect(isSelfReview(null, "user_1")).toBe(false);
  });
});
