// Contract test for getVersionTimeline — specs/013-review-rework/
// contracts/review-rework.md's `getVersionTimeline` section, tasks.md T028.
//
// Named `timeline.test.ts` (not `review-rework.test.ts`) to avoid file
// collisions with sibling agents landing US1/US2/US3 in parallel worktrees
// on this same feature branch.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
// Imports directly from the module file, not the barrel: T032 (exporting
// getVersionTimeline/TimelineEntry from src/server/review/index.ts) is a
// sibling task explicitly out of this task's scope — see tasks.md T031/T032
// and the file-scope note at the top of src/server/review/timeline.ts.
import { getVersionTimeline } from "~/server/review/timeline";
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
    userId: unique("test-timeline-actor"),
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
let departmentId: string;
let noPermissionActor: Actor;

beforeAll(async () => {
  noPermissionActor = await createActor([]);

  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;

  const department = await testDb.department.create({ data: { name: unique("Department") } });
  departmentId = department.id;
});

async function seedWorkItem() {
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: noPermissionActor.userId,
    },
  });
  return testDb.workItem.create({
    data: { orderId: order.id, state: "WAITING_REVIEW" },
  });
}

describe("review contract: getVersionTimeline", () => {
  it("requires no permission beyond an authenticated actor, and matches the frozen TimelineEntry shape for all three outcome kinds", async () => {
    const workItem = await seedWorkItem();
    const uploader = await createActor([]);
    const reviewer = await createActor([]);

    const rejectedVersion = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: unique("storage-key"),
        fileName: "v1.png",
        sizeBytes: 1,
        sha256: unique("sha"),
        uploadedById: uploader.userId,
      },
    });
    await testDb.return.create({
      data: {
        workItemId: workItem.id,
        raisedById: reviewer.userId,
        originDepartmentId: departmentId,
        category: "DESIGN_ISSUE",
        assignedToId: uploader.userId,
        explanation: "needs work",
        designVersionId: rejectedVersion.id,
      },
    });

    const pendingVersion = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 2,
        storageKey: unique("storage-key"),
        fileName: "v2.png",
        sizeBytes: 1,
        sha256: unique("sha"),
        uploadedById: uploader.userId,
      },
    });

    const approvedVersion = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 3,
        storageKey: unique("storage-key"),
        fileName: "v3.png",
        sizeBytes: 1,
        sha256: unique("sha"),
        uploadedById: uploader.userId,
        approvedAt: new Date(),
        approvedById: reviewer.userId,
      },
    });

    // No permission at all — still resolves (Authorization table: "none
    // (authenticated only)").
    const timeline = await getVersionTimeline(noPermissionActor, workItem.id);

    expect(timeline).toHaveLength(3);
    expect(timeline.map((e) => e.version)).toEqual([1, 2, 3]);

    const rejectedEntry = timeline.find((e) => e.version === 1);
    expect(rejectedEntry?.fileName).toBe("v1.png");
    expect(rejectedEntry?.uploadedById).toBe(uploader.userId);
    expect(rejectedEntry?.outcome.kind).toBe("REJECTED");
    if (rejectedEntry?.outcome.kind === "REJECTED") {
      expect(typeof rejectedEntry.outcome.returnId).toBe("string");
      expect(rejectedEntry.outcome.category).toBe("DESIGN_ISSUE");
      expect(rejectedEntry.outcome.explanation).toBe("needs work");
      expect(rejectedEntry.outcome.reviewedById).toBe(reviewer.userId);
      expect(rejectedEntry.outcome.reviewedAt).toBeInstanceOf(Date);
    }
    void rejectedVersion;

    const pendingEntry = timeline.find((e) => e.version === 2);
    expect(pendingEntry?.outcome).toEqual({ kind: "PENDING" });
    void pendingVersion;

    const approvedEntry = timeline.find((e) => e.version === 3);
    expect(approvedEntry?.outcome.kind).toBe("APPROVED");
    if (approvedEntry?.outcome.kind === "APPROVED") {
      expect(approvedEntry.outcome.approvedById).toBe(reviewer.userId);
      expect(approvedEntry.outcome.approvedAt).toBeInstanceOf(Date);
    }
    void approvedVersion;
  });

  it("returns an empty array for a Work Item with no design versions", async () => {
    const workItem = await seedWorkItem();

    const timeline = await getVersionTimeline(noPermissionActor, workItem.id);

    expect(timeline).toEqual([]);
  });
});
