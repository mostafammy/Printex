// Contract test for src/server/review/queue.ts —
// specs/013-review-rework/contracts/review-rework.md's `getReviewQueue`.
//
// tasks.md T008 (US1). NOTE: this file is intentionally named
// `queue.test.ts`, NOT `review-rework.test.ts` (tasks.md's default name) —
// two sibling agents are landing `review.ts`/`timeline.ts` in parallel
// worktrees and would otherwise collide on the same contract test filename.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getReviewQueue } from "~/server/review/queue";
import { ForbiddenError } from "~/server/auth/authorize";
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

async function createActor(permissions: Permission[]): Promise<Actor> {
  const actor: Actor = {
    userId: unique("test-contract-review-actor"),
    roles: [],
    permissions: new Set<Permission>(permissions),
    departmentIds: [],
  };
  await testDb.user.create({
    data: {
      id: actor.userId,
      name: actor.userId,
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  return actor;
}

let customerId: string;
let reviewerActor: Actor;
let noPermissionActor: Actor;

beforeAll(async () => {
  reviewerActor = await createActor(["design.review"]);
  noPermissionActor = await createActor([]);

  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedWorkItem(state: "WAITING_REVIEW" | "NEW" | "IN_DESIGN") {
  const order = await testDb.order.create({
    data: {
      number: Number(process.hrtime.bigint() % 1_000_000_000n),
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: reviewerActor.userId,
    },
  });
  return testDb.workItem.create({ data: { orderId: order.id, state } });
}

describe("review contract: getReviewQueue", () => {
  it("requires design.review — FORBIDDEN without it", async () => {
    await expect(getReviewQueue(noPermissionActor)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns only WAITING_REVIEW rows", async () => {
    const waiting = await seedWorkItem("WAITING_REVIEW");
    const notWaiting = await seedWorkItem("NEW");

    const rows = await getReviewQueue(reviewerActor);
    const ids = rows.map((r) => r.workItemId);

    expect(ids).toContain(waiting.id);
    expect(ids).not.toContain(notWaiting.id);
  });

  it("matches the frozen ReviewQueueRow shape", async () => {
    const wi = await seedWorkItem("WAITING_REVIEW");

    const rows = await getReviewQueue(reviewerActor);
    const row = rows.find((r) => r.workItemId === wi.id);

    expect(row).toBeDefined();
    expect(typeof row?.workItemId).toBe("string");
    expect(typeof row?.orderId).toBe("string");
    expect(typeof row?.orderNumber).toBe("number");
    expect(typeof row?.customerName).toBe("string");
    expect(row?.productTypeName === null || typeof row?.productTypeName === "string").toBe(true);
    expect(["NORMAL", "URGENT"]).toContain(row?.priority);
    expect(row?.enteredQueueAt).toBeInstanceOf(Date);
    expect(typeof row?.reworkCount).toBe("number");
    expect(typeof row?.isRework).toBe("boolean");
    expect(row?.isRework).toBe(false);
    expect(row?.reworkCount).toBe(0);
  });
});
