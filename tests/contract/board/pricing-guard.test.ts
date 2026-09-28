/**
 * Contract test for pricing-pending refusal and blocked hints.
 * (T057, FR-017, spec.md US2-6, data-model.md §3.2)
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "~/server/auth";
import { edgeCatalog, getBoardSnapshot, moveWorkItem } from "~/server/board";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";

describe("Pricing guard contract (T057, FR-017, spec.md US2-6)", { timeout: 60000 }, () => {
  let adminActor: Actor;
  let workItemId: string;

  beforeAll(async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });

    adminActor = {
      id: userId,
      userId,
      roles: ["ADMIN_OWNER"],
      permissions: new Set([
        "workitem.send_to_production",
        "workitem.assign_designer",
        "design.work",
        "design.review",
        "production.operate",
        "delivery.record",
        "pricing.use_fixed",
      ]),
      departmentIds: [],
    };

    const item = await testDb.workItem.create({
      data: {
        orderId,
        state: "READY_FOR_COLLECTION",
      },
    });
    workItemId = item.id;

    await testDb.pricingStatus.create({
      data: {
        workItemId: item.id,
        status: "PENDING",
      },
    });
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("yields delivered station blocked hint when item has pricing PENDING", async () => {
    const snapshot = await getBoardSnapshot(adminActor);
    const deliveredHint = snapshot.blockedHints.find((h) => h.station === "delivered");

    expect(deliveredHint).toBeDefined();
    expect(deliveredHint?.reasonAr).toBe("يجب حسم التسعير أولاً");
  });

  it("does not offer drop to Delivered when pricing status is PENDING", async () => {
    const card = {
      id: workItemId,
      orderId: "ord-1",
      orderNumber: 101,
      orderTagHue: 180,
      customerName: "عميل",
      title: "عمل",
      quantity: 1,
      state: "READY_FOR_COLLECTION" as const,
      priority: "NORMAL" as const,
      pricing: "PENDING" as const,
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

    const moves = edgeCatalog.offer(adminActor, card);
    expect(moves.map((m) => m.edgeId)).not.toContain("READY_FOR_COLLECTION->DELIVERED");
  });

  it("refuses forced drop to Delivered when pricing is PENDING with GUARD_FAILED", async () => {
    const res = await moveWorkItem(adminActor, {
      workItemId,
      edgeId: "READY_FOR_COLLECTION->DELIVERED",
      clientMoveId: "move-forced-delivered",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("GUARD_FAILED");
      expect(res.messageAr).toContain("يجب حسم التسعير أولاً");
    }
  });
});
