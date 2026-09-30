/**
 * Contract test for manual moves out of the review-approved state.
 * An APPROVED card used to rest with zero offered moves (its only
 * registrations were SYSTEM auto-edges), so approved work could not be
 * dragged to Pricing or Production.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "~/server/auth";
import { edgeCatalog, moveWorkItem } from "~/server/board";
import type { BoardCard } from "~/lib/board/types";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";

describe("Approved handoff contract", { timeout: 60000 }, () => {
  let adminActor: Actor;
  let orderId: string;

  beforeAll(async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    orderId = await seedOrder({ customerId, createdById: userId });

    adminActor = {
      id: userId,
      userId,
      roles: ["ADMIN_OWNER"],
      permissions: new Set([
        "pricing.use_fixed",
        "workitem.send_to_production",
        "design.review",
      ]),
      departmentIds: [],
    };
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  function approvedCard(): BoardCard {
    return {
      id: "card-approved",
      orderId: "ord-1",
      orderNumber: 101,
      orderTagHue: 180,
      customerName: "عميل",
      title: "عمل",
      quantity: 10,
      state: "APPROVED",
      priority: "NORMAL",
      pricing: "NOT_REQUIRED",
      enteredStationAt: new Date().toISOString(),
      targetMinutes: null,
      dueAt: null,
      reworkCount: 0,
      assignee: null,
      departmentId: null,
      moves: [],
      lastTransitionId: null,
      lastTransitionAt: new Date().toISOString(),
    };
  }

  it("offers direct moves to pricing and production on APPROVED cards", () => {
    const moves = edgeCatalog.offer(adminActor, approvedCard());
    const byEdge = new Map(moves.map((m) => [m.edgeId, m]));

    const toPricing = byEdge.get("APPROVED->WAITING_PRICING");
    expect(toPricing?.kind).toBe("DIRECT");

    const toProduction = byEdge.get("APPROVED->READY_FOR_PRODUCTION");
    expect(toProduction?.kind).toBe("DIRECT");
  });

  it("moves APPROVED -> WAITING_PRICING on drop", async () => {
    const item = await testDb.workItem.create({
      data: { orderId, state: "APPROVED" },
    });

    const res = await moveWorkItem(adminActor, {
      workItemId: item.id,
      edgeId: "APPROVED->WAITING_PRICING",
      clientMoveId: `move-approved-pricing-${Date.now()}`,
    });

    expect(res.ok).toBe(true);
    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.state).toBe("WAITING_PRICING");
  });

  it("moves APPROVED -> READY_FOR_PRODUCTION on drop", async () => {
    const item = await testDb.workItem.create({
      data: { orderId, state: "APPROVED" },
    });

    const res = await moveWorkItem(adminActor, {
      workItemId: item.id,
      edgeId: "APPROVED->READY_FOR_PRODUCTION",
      clientMoveId: `move-approved-production-${Date.now()}`,
    });

    expect(res.ok).toBe(true);
    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.state).toBe("READY_FOR_PRODUCTION");
  });
});
