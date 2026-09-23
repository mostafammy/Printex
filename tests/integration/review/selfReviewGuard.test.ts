// Integration test for the no-self-review guard — tasks.md T014, US2.
// spec.md US2 Acceptance Scenario 4 / Edge Cases: a reviewer who is also the
// version's uploader is blocked from approving it, with no state change,
// regardless of holding both design.work and design.review (research.md §4
// — the guard compares against DesignVersion.uploadedById, not
// WorkItem.assigneeId).
//
// Imports `~/server/review/guards` (side-effect only, for its module-import
// ordering — mirrors src/server/review/index.ts's own `import "./guards"`)
// so the guard is registered before `approveDesign` runs, exactly as it
// would be via the real barrel once merged.

import "~/server/review/guards";
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
    userId: unique("test-selfreview-actor"),
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

describe("self-review guard (integration)", () => {
  it("blocks approval when the reviewer is also the current version's uploader — no state change", async () => {
    // Holds BOTH design.work and design.review — the spec's Edge Cases
    // scenario ("The Head Designer role holder is also the Work Item's
    // assigned designer") is exercised deliberately, not sidestepped.
    const dualRoleActor = await createActor(["design.work", "design.review"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: dualRoleActor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "WAITING_REVIEW", assigneeId: dualRoleActor.userId },
    });
    await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: `test/${workItem.id}/1`,
        fileName: "self.png",
        sizeBytes: 10,
        sha256: "selfhash",
        uploadedById: dualRoleActor.userId,
      },
    });

    await expect(approveDesign(dualRoleActor, workItem.id)).rejects.toThrow();

    const reloadedWorkItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloadedWorkItem.state).toBe("WAITING_REVIEW");

    const reloadedVersion = await testDb.designVersion.findFirstOrThrow({ where: { workItemId: workItem.id } });
    expect(reloadedVersion.approvedAt).toBeNull();
    expect(reloadedVersion.approvedById).toBeNull();
  });

  it("allows approval when the reviewer did NOT upload the current version", async () => {
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
        fileName: "other.png",
        sizeBytes: 10,
        sha256: "otherhash",
        uploadedById: uploader.userId,
      },
    });

    await expect(approveDesign(reviewer, workItem.id)).resolves.toBeUndefined();

    const reloadedWorkItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloadedWorkItem.state).toBe("APPROVED");
  });
});
