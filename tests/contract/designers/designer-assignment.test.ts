// Contract tests for getEligibleDesigners / assignDesigner — tasks.md T010,
// T016, contracts/designer-assignment.md's Authorization table.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getEligibleDesigners, assignDesigner } from "~/server/designers";
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

function makeActor(userId: string, permissions: Permission[]): Actor {
  return { userId, roles: [], permissions: new Set(permissions), departmentIds: [] };
}

async function createUser(id: string, name = id): Promise<void> {
  await testDb.user.create({
    data: { id, name, email: `${id}@local.invalid`, username: id, isActive: true, failedLoginAttempts: 0 },
  });
}

let customerId: string;
let creatorId: string;

beforeAll(async () => {
  creatorId = unique("test-contract-creator");
  await createUser(creatorId, "Creator");
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedWorkItem(state: "NEW" | "ASSIGNED" = "NEW", assigneeId?: string) {
  const order = await testDb.order.create({
    data: { customerId, channel: "WALK_IN", priority: "NORMAL", mode: "SEPARATE", createdById: creatorId },
  });
  return testDb.workItem.create({ data: { orderId: order.id, state, assigneeId } });
}

describe("designer-assignment contract — Authorization table", () => {
  it("getEligibleDesigners requires workitem.assign_designer (FORBIDDEN without it)", async () => {
    const actor = makeActor(unique("test-contract-noperm-1"), []);
    await createUser(actor.userId, "No Perm");
    const workItem = await seedWorkItem();

    await expect(getEligibleDesigners(actor, workItem.id)).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("getEligibleDesigners succeeds for a holder of workitem.assign_designer and matches the frozen EligibleDesigner shape", async () => {
    const actor = makeActor(unique("test-contract-perm-1"), ["workitem.assign_designer"]);
    await createUser(actor.userId, "Has Perm");

    const designerId = unique("test-contract-designer-1");
    await createUser(designerId, "Designer");
    await testDb.userPermission.create({
      data: { userId: designerId, permission: "design.work", grantedById: actor.userId },
    });

    const workItem = await seedWorkItem();
    const eligible = await getEligibleDesigners(actor, workItem.id);

    expect(Array.isArray(eligible)).toBe(true);
    const row = eligible.find((d) => d.userId === designerId);
    expect(row).toBeDefined();
    // Frozen EligibleDesigner shape (data-model.md) — assert field presence
    // and type, not exact values (workload figures vary with seeded data).
    expect(typeof row?.userId).toBe("string");
    expect(typeof row?.name).toBe("string");
    expect(typeof row?.activeWorkItemCount).toBe("number");
    expect(typeof row?.queueSize).toBe("number");
    expect(typeof row?.estimatedWaitMinutes).toBe("number");
    expect(typeof row?.pastJobsForCustomer).toBe("number");
    expect(typeof row?.isSuggested).toBe("boolean");
  });

  it("assignDesigner's initial-assignment branch requires workitem.assign_designer (FORBIDDEN without it)", async () => {
    const actor = makeActor(unique("test-contract-noperm-2"), []);
    await createUser(actor.userId, "No Perm 2");
    const designerId = unique("test-contract-designer-2");
    await createUser(designerId, "Designer 2");
    const workItem = await seedWorkItem();

    await expect(assignDesigner(actor, workItem.id, designerId)).rejects.toMatchObject({
      name: "ForbiddenError",
    });

    const unchanged = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(unchanged.state).toBe("NEW");
    expect(unchanged.assigneeId).toBeNull();
  });

  it("a holder of workitem.assign_designer can perform the initial-assignment branch (NEW → ASSIGNED)", async () => {
    const actor = makeActor(unique("test-contract-perm-2"), ["workitem.assign_designer"]);
    await createUser(actor.userId, "Has Perm 2");
    const designerId = unique("test-contract-designer-3");
    await createUser(designerId, "Designer 3");
    const workItem = await seedWorkItem();

    await assignDesigner(actor, workItem.id, designerId);

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.state).toBe("ASSIGNED");
    expect(updated.assigneeId).toBe(designerId);
  });

  it("assignDesigner's reassignment branch is gated by the SAME permission — no separate reassignment permission (FR-005a)", async () => {
    const actor = makeActor(unique("test-contract-noperm-3"), []);
    await createUser(actor.userId, "No Perm 3");
    const designerA = unique("test-contract-designer-4a");
    const designerB = unique("test-contract-designer-4b");
    await createUser(designerA, "Designer 4a");
    await createUser(designerB, "Designer 4b");
    const workItem = await seedWorkItem("ASSIGNED", designerA);

    await expect(assignDesigner(actor, workItem.id, designerB, "reason")).rejects.toMatchObject({
      name: "ForbiddenError",
    });

    const unchanged = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(unchanged.assigneeId).toBe(designerA);
  });

  it("a holder of workitem.assign_designer can perform the reassignment branch given a reason", async () => {
    const actor = makeActor(unique("test-contract-perm-3"), ["workitem.assign_designer"]);
    await createUser(actor.userId, "Has Perm 3");
    const designerA = unique("test-contract-designer-5a");
    const designerB = unique("test-contract-designer-5b");
    await createUser(designerA, "Designer 5a");
    await createUser(designerB, "Designer 5b");
    const workItem = await seedWorkItem("ASSIGNED", designerA);

    await assignDesigner(actor, workItem.id, designerB, "rebalance");

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.assigneeId).toBe(designerB);
    expect(updated.state).toBe("ASSIGNED");
  });
});
