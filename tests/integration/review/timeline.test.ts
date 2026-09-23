// Integration test for getVersionTimeline — tasks.md T029, User Story 4.
//
// Seeds a Work Item with 3 DesignVersion rows (v1, v2, v3) directly via
// testDb, not by calling approveDesign/rejectDesign (US2/US3's write paths
// are a sibling engineer's in-progress work on this same feature branch):
// v1 and v2 each get a Return row referencing them with distinct
// category/explanation, and v3 gets approvedAt/approvedById set directly.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
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
    userId: unique("test-timeline-integration"),
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
let viewerActor: Actor;
let uploaderActor: Actor;
let reviewerActor: Actor;

beforeAll(async () => {
  viewerActor = await createActor([]);
  uploaderActor = await createActor([]);
  reviewerActor = await createActor([]);

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
      createdById: viewerActor.userId,
    },
  });
  return testDb.workItem.create({
    data: { orderId: order.id, state: "WAITING_REVIEW" },
  });
}

describe("getVersionTimeline (integration)", () => {
  it("returns all 3 versions in version order, v1/v2 REJECTED (correct fields), v3 APPROVED (correct fields)", async () => {
    const workItem = await seedWorkItem();

    const v1 = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: unique("storage-key"),
        fileName: "v1.png",
        sizeBytes: 10,
        sha256: unique("sha"),
        uploadedById: uploaderActor.userId,
      },
    });
    const return1 = await testDb.return.create({
      data: {
        workItemId: workItem.id,
        raisedById: reviewerActor.userId,
        originDepartmentId: departmentId,
        category: "DIMENSION_ISSUE",
        assignedToId: uploaderActor.userId,
        explanation: "wrong dimensions",
        designVersionId: v1.id,
      },
    });

    const v2 = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 2,
        storageKey: unique("storage-key"),
        fileName: "v2.png",
        sizeBytes: 10,
        sha256: unique("sha"),
        uploadedById: uploaderActor.userId,
      },
    });
    const return2 = await testDb.return.create({
      data: {
        workItemId: workItem.id,
        raisedById: reviewerActor.userId,
        originDepartmentId: departmentId,
        category: "CUSTOMER_CHANGE",
        assignedToId: uploaderActor.userId,
        explanation: "customer changed their mind",
        designVersionId: v2.id,
      },
    });

    const approvedAt = new Date();
    const v3 = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 3,
        storageKey: unique("storage-key"),
        fileName: "v3.png",
        sizeBytes: 10,
        sha256: unique("sha"),
        uploadedById: uploaderActor.userId,
        approvedAt,
        approvedById: reviewerActor.userId,
      },
    });

    const timeline = await getVersionTimeline(viewerActor, workItem.id);

    expect(timeline.map((e) => e.version)).toEqual([1, 2, 3]);

    const entry1 = timeline.find((e) => e.version === 1);
    expect(entry1?.fileName).toBe("v1.png");
    expect(entry1?.uploadedById).toBe(uploaderActor.userId);
    expect(entry1?.outcome).toEqual({
      kind: "REJECTED",
      returnId: return1.id,
      category: "DIMENSION_ISSUE",
      explanation: "wrong dimensions",
      reviewedById: reviewerActor.userId,
      reviewedAt: return1.createdAt,
    });

    const entry2 = timeline.find((e) => e.version === 2);
    expect(entry2?.fileName).toBe("v2.png");
    expect(entry2?.outcome).toEqual({
      kind: "REJECTED",
      returnId: return2.id,
      category: "CUSTOMER_CHANGE",
      explanation: "customer changed their mind",
      reviewedById: reviewerActor.userId,
      reviewedAt: return2.createdAt,
    });

    const entry3 = timeline.find((e) => e.version === 3);
    expect(entry3?.fileName).toBe("v3.png");
    expect(entry3?.outcome).toEqual({
      kind: "APPROVED",
      approvedById: reviewerActor.userId,
      approvedAt,
    });
    void v3;
  });

  it("marks a version with neither a Return nor approvedAt as PENDING", async () => {
    const workItem = await seedWorkItem();
    await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: unique("storage-key"),
        fileName: "v1.png",
        sizeBytes: 10,
        sha256: unique("sha"),
        uploadedById: uploaderActor.userId,
      },
    });

    const timeline = await getVersionTimeline(viewerActor, workItem.id);

    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.outcome).toEqual({ kind: "PENDING" });
  });
});
