// Unit tests for src/server/production/**'s pure logic — Foundational T007.
// No database required.

import { describe, expect, it } from "vitest";
import { ALLOWED_EDGES } from "~/server/core/workflow/edges";

describe("ALLOWED_EDGES.IN_PRODUCTION (014 research.md §2)", () => {
  it("includes REWORK_REQUIRED alongside PRODUCTION_COMPLETED and CANCELLED", () => {
    expect(ALLOWED_EDGES.IN_PRODUCTION).toEqual(
      expect.arrayContaining(["PRODUCTION_COMPLETED", "REWORK_REQUIRED", "CANCELLED"]),
    );
  });
});
