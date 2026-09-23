// Integration test for getReviewQueue — specs/013-review-rework/tasks.md
// T009 (US1). Seeds 3 WAITING_REVIEW Work Items (1 urgent, 2 normal at
// different enteredQueueAt via staggered WorkItemTransition rows) plus 1
// non-WAITING_REVIEW Work Item; asserts ordering and that the 4th item is
// absent (spec.md US1 Acceptance Scenarios 1-2, FR-001, FR-002).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getReviewQueue } from "~/server/review/queue";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

const reviewerActor: Actor = {
  userId: unique("test-integration-review-actor"),
  roles: [],
  permissions: new Set<Permission>(["design.review"]),
  departmentIds: [],
};

let customerId: string;

beforeAll(async () => {
  await testDb.user.create({
    data: {
      id: reviewerActor.userId,
      name: "Test Reviewer",
      email: `${reviewerActor.userId}@local.invalid`,
      username: reviewerActor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedOrder(priority: "NORMAL" | "URGENT") {
  return testDb.order.create({
    data: {
      number: Number(process.hrtime.bigint() % 1_000_000_000n),
      customerId,
      channel: "WALK_IN",
      priority,
      mode: "SEPARATE",
      createdById: reviewerActor.userId,
    },
  });
}

/** Seeds a Work Item already in WAITING_REVIEW with a transition landing
 * there at a specific `at` timestamp, so getReviewQueue's derived
 * enteredQueueAt is deterministic (matches 012 getMyQueue's
 * assignedTransition pattern, adapted). */
async function seedWaitingReviewWorkItem(priority: "NORMAL" | "URGENT", enteredAt: Date) {
  const order = await seedOrder(priority);
  const workItem = await testDb.workItem.create({
    data: { orderId: order.id, state: "WAITING_REVIEW" },
  });
  await testDb.workItemTransition.create({
    data: {
      workItemId: workItem.id,
      from: "IN_DESIGN",
      to: "WAITING_REVIEW",
      actorId: reviewerActor.userId,
      at: enteredAt,
    },
  });
  return workItem;
}

describe("getReviewQueue (integration, US1)", () => {
  it("orders urgent-first, then oldest-first within the normal bucket, and excludes non-WAITING_REVIEW items", async () => {
    const now = Date.now();
    const olderNormal = await seedWaitingReviewWorkItem("NORMAL", new Date(now - 60_000));
    const newerNormal = await seedWaitingReviewWorkItem("NORMAL", new Date(now - 10_000));
    const urgent = await seedWaitingReviewWorkItem("URGENT", new Date(now - 30_000));

    const otherOrder = await seedOrder("NORMAL");
    const notWaiting = await testDb.workItem.create({
      data: { orderId: otherOrder.id, state: "IN_DESIGN" },
    });

    const rows = await getReviewQueue(reviewerActor);
    const ids = new Set([olderNormal.id, newerNormal.id, urgent.id, notWaiting.id]);
    const relevant = rows.filter((r) => ids.has(r.workItemId));

    expect(relevant.map((r) => r.workItemId)).toEqual([urgent.id, olderNormal.id, newerNormal.id]);
    expect(rows.find((r) => r.workItemId === notWaiting.id)).toBeUndefined();
  });

  it("reworkCount reflects the count of Return rows for the Work Item, and isRework mirrors it", async () => {
    const wi = await seedWaitingReviewWorkItem("NORMAL", new Date());
    const department = await testDb.department.create({ data: { name: unique("Dept") } });

    await testDb.return.create({
      data: {
        workItemId: wi.id,
        raisedById: reviewerActor.userId,
        originDepartmentId: department.id,
        category: "DESIGN_ISSUE",
        assignedToId: reviewerActor.userId,
        explanation: "needs rework",
      },
    });

    const rows = await getReviewQueue(reviewerActor);
    const row = rows.find((r) => r.workItemId === wi.id);

    expect(row?.reworkCount).toBe(1);
    expect(row?.isRework).toBe(true);
  });
});
