// Unit test for `WORK_ITEM_STATES` and `assertNever` exhaustiveness —
// tasks.md T020, plan.md §5.4.

import { describe, expect, it } from "vitest";
import {
  assertNever,
  WORK_ITEM_STATES,
  type WorkItemState,
} from "~/server/core";

// Compile-time exhaustiveness check: a `switch` over every `WorkItemState`
// with `default: assertNever(state)` must compile. If a state is ever added
// to WORK_ITEM_STATES without a case handling it here, this function fails
// to typecheck (`pnpm typecheck` / `tsc --noEmit`) — that is the actual
// enforcement mechanism, not the runtime assertions below.
function describeState(state: WorkItemState): string {
  switch (state) {
    case "NEW":
      return "new";
    case "ASSIGNED":
      return "assigned";
    case "IN_DESIGN":
      return "in design";
    case "DESIGN_COMPLETED":
      return "design completed";
    case "WAITING_REVIEW":
      return "waiting review";
    case "REWORK_REQUIRED":
      return "rework required";
    case "APPROVED":
      return "approved";
    case "WAITING_PRICING":
      return "waiting pricing";
    case "READY_FOR_PRODUCTION":
      return "ready for production";
    case "IN_PRODUCTION":
      return "in production";
    case "PRODUCTION_COMPLETED":
      return "production completed";
    case "READY_FOR_COLLECTION":
      return "ready for collection";
    case "DELIVERED":
      return "delivered";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    default:
      return assertNever(state);
  }
}

describe("WORK_ITEM_STATES", () => {
  it("has exactly 15 states", () => {
    expect(WORK_ITEM_STATES).toHaveLength(15);
  });

  it("has no duplicate states", () => {
    expect(new Set(WORK_ITEM_STATES).size).toBe(WORK_ITEM_STATES.length);
  });

  it("contains every state referenced by data-model.md", () => {
    expect([...WORK_ITEM_STATES].sort()).toEqual(
      [
        "NEW",
        "ASSIGNED",
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
      ].sort(),
    );
  });

  it("describeState handles every declared state without hitting assertNever", () => {
    for (const state of WORK_ITEM_STATES) {
      expect(() => describeState(state)).not.toThrow();
    }
  });
});

describe("assertNever", () => {
  it("throws at runtime when actually reached with an unexpected value", () => {
    // assertNever's parameter type is `never`, so this is only reachable by
    // deliberately lying to the compiler about an out-of-union value (e.g.
    // deserialized/untrusted input) — exactly the scenario it exists to
    // guard against at runtime, despite being unreachable by construction
    // for exhaustively-handled in-union values.
    const bogus = "NOT_A_REAL_STATE" as unknown as never;
    expect(() => assertNever(bogus)).toThrow(/Unreachable/);
  });

  it("includes the offending value in the thrown error message", () => {
    const bogus = "TOTALLY_BOGUS" as unknown as never;
    expect(() => assertNever(bogus)).toThrow(/TOTALLY_BOGUS/);
  });
});
