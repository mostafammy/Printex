// Integration test for approveDesign — tasks.md T013, US2.
// spec.md US2 Acceptance Scenarios 1-3: seed a WAITING_REVIEW Work Item with
// 2 DesignVersion rows; approve as a non-uploading Head Designer; assert the
// latest version's approvedAt/approvedById are set, the earlier version is
// untouched, WorkItem.state === "APPROVED", and an audit.record row exists
// for workitem.design_approved.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { approveDesign } from "~/server/review/review";
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
    userId: unique("test-approve-actor"),
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

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

describe("approveDesign (integration)", () => {
  it("approves the latest of 2 versions, leaves the earlier one untouched, advances to APPROVED, and records an audit event", async () => {
    const uploader = await createActor(["design.work"]);
    const reviewer = await createActor(["design.review"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: uploader.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "WAITING_REVIEW", assigneeId: uploader.userId },
    });

    const v1 = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: `test/${workItem.id}/1`,
        fileName: "v1.png",
        sizeBytes: 10,
        sha256: "v1hash",
        uploadedById: uploader.userId,
      },
    });
    const v2 = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 2,
        storageKey: `test/${workItem.id}/2`,
        fileName: "v2.png",
        sizeBytes: 20,
        sha256: "v2hash",
        uploadedById: uploader.userId,
      },
    });

    await approveDesign(reviewer, workItem.id);

    const reloadedV1 = await testDb.designVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(reloadedV1.approvedAt).toBeNull();
    expect(reloadedV1.approvedById).toBeNull();

    const reloadedV2 = await testDb.designVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect(reloadedV2.approvedAt).not.toBeNull();
    expect(reloadedV2.approvedById).toBe(reviewer.userId);

    const reloadedWorkItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloadedWorkItem.state).toBe("APPROVED");

    const auditEvent = await testDb.auditEvent.findFirst({
      where: { action: "workitem.design_approved", entityId: workItem.id },
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.actorId).toBe(reviewer.userId);
  });

  it("approves independent of pricing resolution (no pricing gate in this transition)", async () => {
    const uploader = await createActor(["design.work"]);
    const reviewer = await createActor(["design.review"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: uploader.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "WAITING_REVIEW", assigneeId: uploader.userId },
    });
    await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: `test/${workItem.id}/1`,
        fileName: "v1.png",
        sizeBytes: 10,
        sha256: "v1hash",
        uploadedById: uploader.userId,
      },
    });

    await approveDesign(reviewer, workItem.id);

    const reloaded = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloaded.state).toBe("APPROVED");
  });
});
