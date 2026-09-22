// Unit test for PhaseTiming segment-duration calculation — tasks.md T024,
// data-model.md `PhaseTiming`, spec FR-009 / SC-004.
//
// `calculatePhaseDurationMs` is a pure function over persisted timestamps —
// no in-memory timer state — so re-computing it "from scratch" (as if the
// server had just restarted) from the same rows must give the same answer.

import { describe, expect, it } from "vitest";
// `workflow/timing` is an internal implementation detail of
// `transitionWorkItem` (contracts/workflow.md step 5), not part of the
// frozen public contract — it is deliberately excluded from the
// `src/server/core/index.ts` barrel (tasks.md T038), so this test
// necessarily deep-imports it to exercise `calculatePhaseDurationMs`
// directly.
// eslint-disable-next-line no-restricted-imports -- internal, not part of the public contract; see comment above.
import {
  calculatePhaseDurationMs,
  type PhaseTimingSegment,
} from "~/server/core/workflow/timing";

const MINUTE = 60_000;

describe("calculatePhaseDurationMs", () => {
  it("returns 0 for no segments", () => {
    expect(calculatePhaseDurationMs([])).toBe(0);
  });

  it("sums a single closed segment's duration", () => {
    const segments: PhaseTimingSegment[] = [
      { startedAt: new Date(0), endedAt: new Date(5 * MINUTE) },
    ];
    expect(calculatePhaseDurationMs(segments)).toBe(5 * MINUTE);
  });

  it("sums multiple closed segments across a pause", () => {
    // Active 0-5min, paused 5-10min (no segment for the pause itself),
    // active again 10-13min -> total active duration 8min.
    const segments: PhaseTimingSegment[] = [
      { startedAt: new Date(0), endedAt: new Date(5 * MINUTE) },
      { startedAt: new Date(10 * MINUTE), endedAt: new Date(13 * MINUTE) },
    ];
    expect(calculatePhaseDurationMs(segments)).toBe(8 * MINUTE);
  });

  it("adds the open segment's elapsed-so-far using the supplied `now`", () => {
    const now = new Date(12 * MINUTE);
    const segments: PhaseTimingSegment[] = [
      { startedAt: new Date(0), endedAt: new Date(5 * MINUTE) }, // closed: 5min
      { startedAt: new Date(10 * MINUTE), endedAt: null }, // open: 2min so far
    ];
    expect(calculatePhaseDurationMs(segments, now)).toBe(7 * MINUTE);
  });

  it("defaults `now` to the current time when not supplied", () => {
    const startedAt = new Date(Date.now() - 3 * MINUTE);
    const segments: PhaseTimingSegment[] = [{ startedAt, endedAt: null }];
    const durationMs = calculatePhaseDurationMs(segments);
    // Allow generous slack for test execution time.
    expect(durationMs).toBeGreaterThanOrEqual(3 * MINUTE - 1000);
    expect(durationMs).toBeLessThanOrEqual(3 * MINUTE + 5000);
  });

  it("'restart' semantics: recomputing from the same persisted rows with no in-memory state gives the same answer", () => {
    const now = new Date(20 * MINUTE);
    const persistedRows: PhaseTimingSegment[] = [
      { startedAt: new Date(0), endedAt: new Date(4 * MINUTE) },
      { startedAt: new Date(6 * MINUTE), endedAt: new Date(9 * MINUTE) },
      { startedAt: new Date(15 * MINUTE), endedAt: null },
    ];

    // Simulate a server restart: nothing but the rows above (a fresh array,
    // no shared references, no accumulator carried over) and the same
    // wall-clock instant `now`.
    const beforeRestart = calculatePhaseDurationMs(persistedRows, now);
    const rehydratedRows: PhaseTimingSegment[] = persistedRows.map((s) => ({
      startedAt: new Date(s.startedAt.getTime()),
      endedAt: s.endedAt ? new Date(s.endedAt.getTime()) : null,
    }));
    const afterRestart = calculatePhaseDurationMs(rehydratedRows, now);

    expect(afterRestart).toBe(beforeRestart);
    // 4min + 3min + 5min (open, 15->20min) = 12min
    expect(afterRestart).toBe(12 * MINUTE);
  });

  it("sums three closed segments plus an open one correctly", () => {
    const now = new Date(100 * MINUTE);
    const segments: PhaseTimingSegment[] = [
      { startedAt: new Date(0), endedAt: new Date(10 * MINUTE) },
      { startedAt: new Date(20 * MINUTE), endedAt: new Date(25 * MINUTE) },
      { startedAt: new Date(30 * MINUTE), endedAt: new Date(31 * MINUTE) },
      { startedAt: new Date(90 * MINUTE), endedAt: null },
    ];
    // 10 + 5 + 1 + (100-90) = 26min
    expect(calculatePhaseDurationMs(segments, now)).toBe(26 * MINUTE);
  });
});
