import { describe, expect, it } from "vitest";
import { WORK_ITEM_STATES } from "~/server/core";
import {
  OFF_BOARD_STATES,
  STATE_PLACEMENT,
  STATIONS,
  type StationId,
} from "~/server/board/stations";

describe("stations and state placement completeness (FR-002)", () => {
  it("every state in WORK_ITEM_STATES has an entry in STATE_PLACEMENT", () => {
    for (const state of WORK_ITEM_STATES) {
      expect(STATE_PLACEMENT[state]).toBeDefined();
    }
  });

  it("every off-board state maps strictly to OFF_BOARD", () => {
    for (const offState of OFF_BOARD_STATES) {
      expect(STATE_PLACEMENT[offState]).toBe("OFF_BOARD");
    }
  });

  it("every on-board state maps to a valid station and sub-lane matching STATIONS", () => {
    const stationMap = new Map<StationId, readonly { state: string }[]>();
    for (const s of STATIONS) {
      stationMap.set(s.id, s.lanes);
    }

    for (const state of WORK_ITEM_STATES) {
      const placement = STATE_PLACEMENT[state];
      if (placement === "OFF_BOARD") {
        expect(OFF_BOARD_STATES).toContain(state);
      } else {
        const lanes = stationMap.get(placement.station);
        expect(lanes).toBeDefined();
        expect(placement.lane).toBeGreaterThanOrEqual(0);
        expect(placement.lane).toBeLessThan(lanes!.length);
        const targetLane = lanes?.[placement.lane];
        expect(targetLane?.state).toBe(state);
      }
    }
  });

  it("STATIONS has exactly 7 stations in RTL physical flow order", () => {
    expect(STATIONS).toHaveLength(7);
    const expectedOrder: StationId[] = [
      "reception",
      "design",
      "review",
      "pricing",
      "production",
      "collection",
      "delivered",
    ];
    expect(STATIONS.map((s) => s.id)).toEqual(expectedOrder);
  });

  it("every station has an Arabic label, Lucide icon, and non-red ink", () => {
    for (const s of STATIONS) {
      expect(s.labelAr).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(s.ink).not.toBe("red");
    }
  });
});
