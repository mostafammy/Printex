/**
 * Contract test: No-self-review guard on the board.
 * (T056, spec.md US2-5, constitution II, research.md R2)
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "~/server/auth";
import { edgeCatalog, moveWorkItem } from "~/server/board";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";

describe("No self-review contract (T056, spec.md US2-5, constitution II)", { timeout: 60000 }, () => {
  let designerActor: Actor;
  let reviewerActor: Actor;
  let workItemId: string;

  beforeAll(async () => {
    const designerId = await seedUser();
    const reviewerId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: designerId });

    designerActor = {
      id: designerId,
      userId: designerId,
      roles: ["DESIGNER"],
      permissions: new Set(["design.work", "design.review"]),
      departmentIds: [],
    };

    reviewerActor = {
      id: reviewerId,
      userId: reviewerId,
      roles: ["HEAD_DESIGNER"],
      permissions: new Set(["design.review"]),
      departmentIds: [],
    };

    const item = await testDb.workItem.create({
      data: {
        orderId,
        state: "WAITING_REVIEW",
        assigneeId: designerId,
      },
    });
    workItemId = item.id;
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("never offers 'Approved' to the designer who created or is assigned to the design", async () => {
    const card = {
      id: workItemId,
      orderId: "ord-test",
      orderNumber: 100,
      orderTagHue: 100,
      customerName: "عميل",
      title: "عمل",
      quantity: 10,
      state: "WAITING_REVIEW" as const,
      priority: "NORMAL" as const,
      pricing: "NOT_REQUIRED" as const,
      enteredStationAt: new Date().toISOString(),
      targetMinutes: 60,
      dueAt: null,
      reworkCount: 0,
      assignee: { id: designerActor.userId, name: "المصمم" },
      departmentId: null,
      moves: [],
      lastTransitionId: null,
      lastTransitionAt: new Date().toISOString(),
    };

    const designerMoves = edgeCatalog.offer(designerActor, card);
    expect(designerMoves.map((m) => m.edgeId)).not.toContain("WAITING_REVIEW->APPROVED");

    const reviewerMoves = edgeCatalog.offer(reviewerActor, card);
    expect(reviewerMoves.map((m) => m.edgeId)).toContain("WAITING_REVIEW->APPROVED");
  });

  it("refuses forced approval by the author designer with GUARD_FAILED", async () => {
    const res = await moveWorkItem(designerActor, {
      workItemId,
      edgeId: "WAITING_REVIEW->APPROVED",
      clientMoveId: "move-forced-self-review",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("GUARD_FAILED");
    }
  });
});
