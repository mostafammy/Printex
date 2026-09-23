// Unit tests for src/server/review/**'s pure logic — Foundational T007,
// US3 T022, US6 T037. No database required.

import { describe, expect, it } from "vitest";
import { isSelfReview } from "~/server/review/selfReview";
import type { CreateReturnInput } from "~/server/review/returns";

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

// US6 (T037) — `createReturn`'s generic-caller shape: `designVersionId` must
// be optional so a non-design-review caller (014/051) can omit it. This is a
// compile-time check (the DB-touching runtime path is covered by
// tests/integration/review/reject.test.ts, which already asserts a real
// `designVersionId` is set on a design-review rejection) — a future caller
// with no `designVersionId` is exercised here as a type-level guarantee only.
describe("CreateReturnInput (US6 generic caller shape)", () => {
  it("allows designVersionId to be omitted", () => {
    const input: CreateReturnInput = {
      category: "PRODUCTION_ISSUE",
      originDepartmentId: "dept_1",
      assignedToId: "user_1",
      explanation: "Non-design-review caller, no design version involved",
    };
    expect(input.designVersionId).toBeUndefined();
  });
});
