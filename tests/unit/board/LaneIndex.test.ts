import { describe, expect, it } from "vitest";
import { LaneIndex } from "~/lib/board/store/LaneIndex";
import type { BoardCard } from "~/lib/board/types";

function makeCard(
  id: string,
  priority: "URGENT" | "NORMAL",
  enteredStationAt: string,
): BoardCard {
  return {
    id,
    orderId: "order-1",
    orderNumber: 100,
    orderTagHue: 120,
    customerName: "عميل تجريبي",
    title: `مهمة ${id}`,
    quantity: 100,
    state: "NEW",
    priority,
    pricing: "NOT_REQUIRED",
    enteredStationAt,
    targetMinutes: 30,
    dueAt: null,
    reworkCount: 0,
    assignee: null,
    departmentId: null,
    moves: [],
    lastTransitionId: "t1",
    lastTransitionAt: enteredStationAt,
  };
}

describe("LaneIndex (FR-005 sub-lane sorting and binary search)", () => {
  it("sorts urgent cards before normal, and oldest enteredStationAt first within priority", () => {
    const laneIndex = new LaneIndex();
    const cardNormalOld = makeCard("c1", "NORMAL", "2026-09-26T10:00:00Z");
    const cardNormalNew = makeCard("c2", "NORMAL", "2026-09-26T12:00:00Z");
    const cardUrgentOld = makeCard("c3", "URGENT", "2026-09-26T11:00:00Z");
    const cardUrgentNew = makeCard("c4", "URGENT", "2026-09-26T13:00:00Z");

    const cardsMap = new Map<string, BoardCard>([
      [cardNormalOld.id, cardNormalOld],
      [cardNormalNew.id, cardNormalNew],
      [cardUrgentOld.id, cardUrgentOld],
      [cardUrgentNew.id, cardUrgentNew],
    ]);

    laneIndex.insert("NEW", cardNormalNew.id, cardsMap);
    laneIndex.insert("NEW", cardUrgentNew.id, cardsMap);
    laneIndex.insert("NEW", cardNormalOld.id, cardsMap);
    laneIndex.insert("NEW", cardUrgentOld.id, cardsMap);

    const lane = laneIndex.getLane("NEW");
    expect(lane).toEqual(["c3", "c4", "c1", "c2"]);
  });

  it("removes a card from a lane", () => {
    const laneIndex = new LaneIndex();
    const card1 = makeCard("c1", "NORMAL", "2026-09-26T10:00:00Z");
    const card2 = makeCard("c2", "NORMAL", "2026-09-26T11:00:00Z");
    const cardsMap = new Map<string, BoardCard>([
      [card1.id, card1],
      [card2.id, card2],
    ]);

    laneIndex.insert("NEW", card1.id, cardsMap);
    laneIndex.insert("NEW", card2.id, cardsMap);

    expect(laneIndex.getLane("NEW")).toEqual(["c1", "c2"]);
    laneIndex.remove("NEW", "c1");
    expect(laneIndex.getLane("NEW")).toEqual(["c2"]);
  });
});
