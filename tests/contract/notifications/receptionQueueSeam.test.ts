// T059 / FR-058: 011's queue binds 053's delayed ids WITHOUT changing 011.
//
// The seam must be proven in both directions, because the binding's value is
// that it is optional:
//   - WITHOUT `opts`, the queue works unchanged (011 FR-008a) — 011 keeps
//     working if 053 is absent, disabled, or broken;
//   - WITH `opts`, rows containing a delayed Work Item carry
//     `delayed: true`, and rows containing none carry `false`.
//
// This file exercises `listReceptionQueue` itself — the seam as 011
// implements it — rather than 053's callback in isolation.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { listReceptionQueue } from "~/server/orders";
import { getDelayedWorkItemIds } from "~/server/notifications";
import {
  seedAgedWorkItem,
  seedCustomer,
  seedNotificationUser,
  setThreshold,
} from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let receptionist: Awaited<ReturnType<typeof seedNotificationUser>>;
let delayedOrderId: string;
let freshOrderId: string;
let delayedWorkItemId: string;

beforeAll(async () => {
  receptionist = await seedNotificationUser({ prefix: "queue-reception" });

  await setThreshold("REVIEW", 1, { alertRoles: ["HEAD_DESIGNER"] });

  const customerId = await seedCustomer("QueueSeam");

  const delayedOrder = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "GROUPED",
      createdById: receptionist.userId,
    },
  });
  delayedOrderId = delayedOrder.id;
  delayedWorkItemId = await seedAgedWorkItem({
    orderId: delayedOrderId,
    state: "WAITING_REVIEW",
    ageMinutes: 60,
    requiresDesign: true,
  });

  const freshOrder = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "GROUPED",
      createdById: receptionist.userId,
    },
  });
  freshOrderId = freshOrder.id;
  // Sits in REVIEW but was created seconds ago — delayed flag must stay
  // false, which is the difference between "has a review" and "is late".
  await seedAgedWorkItem({
    orderId: freshOrderId,
    state: "WAITING_REVIEW",
    ageMinutes: 0,
    requiresDesign: true,
  });
});

describe("reception queue seam (T059 / FR-058)", () => {
  it("works UNCHANGED with no opts — 011 does not need 053 (FR-008a)", async () => {
    const rows = await listReceptionQueue(receptionist);

    // The queue's own columns are intact and every row reports delayed:
    // false — the flag exists but is unsubstantiated without the callback,
    // which is exactly "011 works unchanged when the callback is not
    // supplied".
    const delayedRow = rows.find((r) => r.orderId === delayedOrderId);
    expect(delayedRow).toBeDefined();
    expect(delayedRow!.delayed).toBe(false);
    expect(rows.every((r) => r.delayed === false)).toBe(true);
    // Nothing else about the queue changed: order numbers, customers, status.
    expect(typeof delayedRow!.orderNumber).toBe("number");
    expect(delayedRow!.customerName.length).toBeGreaterThan(0);
  });

  it("flags only orders containing a currently-delayed Work Item", async () => {
    const rows = await listReceptionQueue(receptionist, {
      getDelayedWorkItemIds,
    });

    const delayedRow = rows.find((r) => r.orderId === delayedOrderId);
    const freshRow = rows.find((r) => r.orderId === freshOrderId);

    expect(delayedRow!.delayed).toBe(true);
    // Same phase, same threshold — but not yet past it, so not flagged.
    expect(freshRow!.delayed).toBe(false);

    // The set itself contains this Work Item and not the fresh one.
    const ids = await getDelayedWorkItemIds();
    expect(ids).toContain(delayedWorkItemId);
  });

  it("delivers the flag even when a third-party callback returns an empty set", async () => {
    // The callback's contract is a membership function; an empty set means
    // "nothing is delayed", not "unknown" — so every row is false rather
    // than null or an error. 011 never needs to know whether 053 exists.
    const rows = await listReceptionQueue(receptionist, {
      getDelayedWorkItemIds: async () => new Set<string>(),
    });
    expect(rows.every((r) => r.delayed === false)).toBe(true);
  });
});
