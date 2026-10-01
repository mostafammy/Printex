// Unit tests — 093's derived pipeline stage.
//
// Constitution I forbids a second status system, so the four business stages
// are a pure function over the existing `WorkItemState` and nothing stores
// them. These tests pin that mapping and — just as importantly — pin the two
// judgement calls in it, both of which a careless future edit would silently
// invert and thereby empty somebody's queue:
//
//   * REWORK_REQUIRED belongs to DESIGNER, not to the reviewer who sent it
//     back. Putting it in the reviewer's stage would tell a designer their
//     queue is empty while they still own the work.
//   * CANCELLED has no stage at all, so it appears in nobody's queue.

import { describe, expect, it } from "vitest";
import { WORK_ITEM_STATES, type WorkItemState } from "~/server/core";
import { isInStage, PIPELINE_ORDER, stageIndex, stageOf, statesInStage } from "~/server/pipeline";

describe("stageOf — WorkItemState to pipeline stage", () => {
  it.each<readonly [WorkItemState, string]>([
    ["NEW", "RECEPTION"],
    ["ASSIGNED", "DESIGNER"],
    ["IN_DESIGN", "DESIGNER"],
    ["DESIGN_COMPLETED", "DESIGNER"],
    ["WAITING_REVIEW", "DESIGNER"],
    ["REWORK_REQUIRED", "DESIGNER"],
    ["APPROVED", "ACCOUNTANT"],
    ["WAITING_PRICING", "ACCOUNTANT"],
    ["READY_FOR_PRODUCTION", "PRINTER"],
    ["IN_PRODUCTION", "PRINTER"],
    ["PRODUCTION_COMPLETED", "PRINTER"],
    ["READY_FOR_COLLECTION", "PRINTER"],
    ["DELIVERED", "PRINTER"],
    ["COMPLETED", "PRINTER"],
  ])("maps %s to %s", (state, stage) => {
    expect(stageOf(state)).toBe(stage);
  });

  it("gives CANCELLED no stage, so it lands in nobody's queue", () => {
    expect(stageOf("CANCELLED")).toBeNull();
    for (const stage of PIPELINE_ORDER) {
      expect(statesInStage(stage)).not.toContain("CANCELLED");
    }
  });

  it("assigns every declared state — no state is silently unqueued", () => {
    for (const state of WORK_ITEM_STATES) {
      // CANCELLED is the one deliberate exception; everything else must map.
      const stage = stageOf(state);
      if (state === "CANCELLED") {
        expect(stage).toBeNull();
      } else {
        expect(stage, `${state} has no pipeline stage`).not.toBeNull();
      }
    }
  });
});

describe("statesInStage — the predicate behind a role's queue", () => {
  it("gives the receptionist exactly the unassigned backlog", () => {
    expect(statesInStage("RECEPTION")).toEqual(["NEW"]);
  });

  it("keeps sent-back work in the designer's queue", () => {
    // The judgement call: REWORK_REQUIRED is the designer's problem, not the
    // reviewer's. A designer whose queue omits it would never learn they owe
    // revisions.
    expect(statesInStage("DESIGNER")).toContain("REWORK_REQUIRED");
    expect(statesInStage("ACCOUNTANT")).not.toContain("REWORK_REQUIRED");
  });

  it("collects every state from RELEASE onwards under the printer", () => {
    expect(statesInStage("PRINTER")).toEqual([
      "READY_FOR_PRODUCTION",
      "IN_PRODUCTION",
      "PRODUCTION_COMPLETED",
      "READY_FOR_COLLECTION",
      "DELIVERED",
      "COMPLETED",
    ]);
  });

  it("partitions every state into exactly one stage — no overlaps", () => {
    const all = PIPELINE_ORDER.flatMap((stage) => statesInStage(stage));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("isInStage", () => {
  it("is the predicate `approveForProduction` relies on", () => {
    expect(isInStage("APPROVED", "ACCOUNTANT")).toBe(true);
    expect(isInStage("WAITING_PRICING", "ACCOUNTANT")).toBe(true);
    // The pipeline's strictness: a designer who completed their work has NOT
    // handed it to the accountant yet, and must not be able to approve it.
    expect(isInStage("DESIGN_COMPLETED", "ACCOUNTANT")).toBe(false);
    expect(isInStage("IN_DESIGN", "ACCOUNTANT")).toBe(false);
  });
});

describe("stageIndex — position for progress affordances", () => {
  it("numbers the stages 0..3 in pipeline order", () => {
    expect(PIPELINE_ORDER.map((stage) => stageIndex(stage))).toEqual([0, 1, 2, 3]);
  });

  it("has no position for a cancelled item", () => {
    expect(stageIndex(null)).toBeNull();
  });
});
