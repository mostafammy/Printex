import { describe, expect, it } from "vitest";
import {
  computeOrderTagHue,
  computeEnteredStationAt,
  mapRowToBoardCard,
  type RawWorkItemRow,
} from "~/server/board/projection";

describe("board card projection (T022, data-model §3.1)", () => {
  it("computes deterministic orderTagHue between 0 and 359", () => {
    const hue1 = computeOrderTagHue("order-abc-123");
    const hue2 = computeOrderTagHue("order-abc-123");
    const hue3 = computeOrderTagHue("order-xyz-789");

    expect(hue1).toBe(hue2);
    expect(hue1).toBeGreaterThanOrEqual(0);
    expect(hue1).toBeLessThan(360);
    expect(hue3).toBeGreaterThanOrEqual(0);
    expect(hue3).toBeLessThan(360);
  });

  it("calculates enteredStationAt as earliest consecutive transition in same station", () => {
    // Consecutive design states: ASSIGNED -> IN_DESIGN -> REWORK_REQUIRED
    const transitions = [
      { to: "REWORK_REQUIRED", at: new Date("2026-09-26T12:00:00Z") },
      { to: "IN_DESIGN", at: new Date("2026-09-26T11:00:00Z") },
      { to: "ASSIGNED", at: new Date("2026-09-26T10:00:00Z") },
      { to: "NEW", at: new Date("2026-09-26T09:00:00Z") }, // Reception station
    ];

    const enteredAt = computeEnteredStationAt("REWORK_REQUIRED", transitions, new Date("2026-09-26T09:00:00Z"));
    expect(enteredAt).toBe("2026-09-26T10:00:00.000Z");
  });

  it("maps raw Prisma work item row to BoardCard correctly", () => {
    const rawRow: RawWorkItemRow = {
      id: "wi-1",
      orderId: "order-10",
      order: {
        number: 400,
        priority: "URGENT",
        dueDate: new Date("2026-09-28T18:00:00Z"),
        customer: { name: "شركة النور" },
      },
      description: "طباعة بروشور",
      productType: { name: "بروشور فاخر", defaultDepartmentId: "dept-1" },
      quantity: 1000,
      state: "IN_DESIGN",
      departmentId: "dept-1",
      assignee: { id: "user-1", name: "مصمم أحمد" },
      createdAt: new Date("2026-09-26T08:00:00Z"),
      dueDate: null,
      transitions: [
        { id: "t2", to: "IN_DESIGN", from: "ASSIGNED", at: new Date("2026-09-26T09:30:00Z") },
        { id: "t1", to: "ASSIGNED", from: "NEW", at: new Date("2026-09-26T09:00:00Z") },
      ],
      pricingStatus: { status: "PRICED" },
      reworkCount: 1,
    };

    const card = mapRowToBoardCard(rawRow, {
      reception: { normal: 30, urgent: 10 },
      design: { normal: 1440, urgent: 240 },
      review: { normal: 240, urgent: 60 },
      pricing: { normal: 240, urgent: 60 },
      production: { normal: 2880, urgent: 480 },
      collection: { normal: 1440, urgent: 240 },
      delivered: { normal: 0, urgent: 0 },
    });

    expect(card.id).toBe("wi-1");
    expect(card.orderNumber).toBe(400);
    expect(card.customerName).toBe("شركة النور");
    expect(card.title).toBe("طباعة بروشور");
    expect(card.priority).toBe("URGENT");
    expect(card.pricing).toBe("PRICED");
    expect(card.targetMinutes).toBe(240); // urgent design target
    expect(card.reworkCount).toBe(1);
    expect(card.assignee).toEqual({ id: "user-1", name: "مصمم أحمد" });
    expect(card.lastTransitionId).toBe("t2");
  });
});
