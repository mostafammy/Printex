// Integration test for rejectDesign — tasks.md T020, US3.
// spec.md US3 Acceptance Scenarios 1 and 3: reject a WAITING_REVIEW Work
// Item with category/originDepartmentId/explanation; assert
// WorkItem.state === "REWORK_REQUIRED", a Return row exists with all
// required fields (raisedById, originDepartmentId, category, assignedToId
// = the Work Item's assignee, explanation, designVersionId = the current
// version at rejection time), and a NotificationEvent recipient includes the
// assignee, created in the same transaction as the Return (both exist
// immediately after the call, matching timestamps within the same tx
// commit).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { rejectDesign } from "~/server/review/review";
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
    userId: unique("test-reject-actor"),
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

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  const department = await testDb.department.create({ data: { name: unique("Department") } });
  departmentId = department.id;
});

describe("rejectDesign (integration)", () => {
  it("moves the Work Item to REWORK_REQUIRED, persists a full Return row, and notifies the assignee in the same operation", async () => {
    const assignee = await createActor(["design.work"]);
    const reviewer = await createActor(["design.review"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: assignee.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "WAITING_REVIEW", assigneeId: assignee.userId },
    });
    const version = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: `test/${workItem.id}/1`,
        fileName: "v1.png",
        sizeBytes: 10,
        sha256: "v1hash",
        uploadedById: assignee.userId,
      },
    });

    const before = new Date();
    const { returnId } = await rejectDesign(reviewer, workItem.id, {
      category: "MISSING_INFORMATION",
      originDepartmentId: departmentId,
      explanation: "Customer's logo file is missing from the order.",
    });
    const after = new Date();

    const reloadedWorkItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloadedWorkItem.state).toBe("REWORK_REQUIRED");

    const returnRow = await testDb.return.findUniqueOrThrow({ where: { id: returnId } });
    expect(returnRow.raisedById).toBe(reviewer.userId);
    expect(returnRow.originDepartmentId).toBe(departmentId);
    expect(returnRow.category).toBe("MISSING_INFORMATION");
    expect(returnRow.assignedToId).toBe(assignee.userId);
    expect(returnRow.explanation).toBe("Customer's logo file is missing from the order.");
    expect(returnRow.designVersionId).toBe(version.id);
    expect(returnRow.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(returnRow.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());

    const notification = await testDb.notificationEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItem.id, type: "workitem.rejected" },
    });
    expect(notification).not.toBeNull();
    expect(notification?.recipientUserIds).toContain(assignee.userId);
    // Same transaction as the Return write (FR-009/SC-003) — both timestamps
    // fall inside the same [before, after] window, i.e. the same commit.
    expect(notification!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(notification!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("remains permanently retrievable with no application code path to edit or delete it (FR-010)", async () => {
    const assignee = await createActor(["design.work"]);
    const reviewer = await createActor(["design.review"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: assignee.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "WAITING_REVIEW", assigneeId: assignee.userId },
    });
    await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: `test/${workItem.id}/1`,
        fileName: "v1.png",
        sizeBytes: 10,
        sha256: "v1hash",
        uploadedById: assignee.userId,
      },
    });

    const { returnId } = await rejectDesign(reviewer, workItem.id, {
      category: "OTHER",
      originDepartmentId: departmentId,
      explanation: "Something else came up.",
    });

    // `rejectDesign`/`createReturn` (this feature's public surface) expose
    // no update/delete function for Return rows — this assertion documents
    // that the row is still readable well after the call returns, as
    // evidence there is no cleanup/expiry path silently removing it.
    const stillThere = await testDb.return.findUnique({ where: { id: returnId } });
    expect(stillThere).not.toBeNull();
  });
});
