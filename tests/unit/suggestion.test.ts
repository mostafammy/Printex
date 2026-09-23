// Unit tests for suggestDesigner — specs/012-designer-assignment-timers/
// data-model.md EligibleDesigner.isSuggested, tasks.md T008.

import { describe, expect, it } from "vitest";
import { suggestDesigner, type DesignerLoadCandidate } from "~/server/designers/suggestion";

function candidate(overrides: Partial<DesignerLoadCandidate>): DesignerLoadCandidate {
  return {
    userId: "u_default",
    name: "Default",
    activeWorkItemCount: 0,
    lastAssignedAt: null,
    ...overrides,
  };
}

describe("suggestDesigner", () => {
  it("returns null for an empty candidate list", () => {
    expect(suggestDesigner([])).toBeNull();
  });

  it("picks the single candidate with the fewest active work items", () => {
    const candidates = [
      candidate({ userId: "u_busy", activeWorkItemCount: 5 }),
      candidate({ userId: "u_light", activeWorkItemCount: 1 }),
    ];
    expect(suggestDesigner(candidates)).toBe("u_light");
  });

  it("breaks a count tie by earliest lastAssignedAt", () => {
    const candidates = [
      candidate({ userId: "u_later", activeWorkItemCount: 2, lastAssignedAt: new Date("2026-09-20") }),
      candidate({ userId: "u_earlier", activeWorkItemCount: 2, lastAssignedAt: new Date("2026-09-10") }),
    ];
    expect(suggestDesigner(candidates)).toBe("u_earlier");
  });

  it("treats a null lastAssignedAt as last, not earliest", () => {
    const candidates = [
      candidate({ userId: "u_never", activeWorkItemCount: 2, lastAssignedAt: null }),
      candidate({ userId: "u_once", activeWorkItemCount: 2, lastAssignedAt: new Date("2026-09-10") }),
    ];
    expect(suggestDesigner(candidates)).toBe("u_once");
  });

  it("breaks a count and lastAssignedAt tie by name", () => {
    const candidates = [
      candidate({ userId: "u_z", name: "Zaki", activeWorkItemCount: 2, lastAssignedAt: null }),
      candidate({ userId: "u_a", name: "Amir", activeWorkItemCount: 2, lastAssignedAt: null }),
    ];
    expect(suggestDesigner(candidates)).toBe("u_a");
  });
});
