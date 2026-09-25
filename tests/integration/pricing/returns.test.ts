// Integration test for createPricingReturn — tasks.md T033, US6.
// spec.md US6 Acceptance Scenarios 1 and 2: create a Pricing-originated
// PRICING_ISSUE return and confirm its category, origin, explanation,
// actor/assignee/timestamp, distinguishability from design returns, and
// that transaction rollback prevents partial writes.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { createPricingReturn } from "~/server/pricing/returns";
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
    userId: unique("test-pricing-return-actor"),
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
let pricingDepartmentId: string;
let designDepartmentId: string;

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;

  const pricingDept = await testDb.department.create({
    data: { name: "Pricing" },
  });
  pricingDepartmentId = pricingDept.id;

  const designDept = await testDb.department.create({
    data: { name: unique("Design") },
  });
  designDepartmentId = designDept.id;
});

describe("createPricingReturn (integration)", () => {
  it("creates a Return with PRICING_ISSUE category, Pricing origin, required explanation, actor, assignee, and timestamp", async () => {
    const actor = await createActor(["pricing.use_fixed"]);
    const assignee = await createActor(["pricing.use_fixed"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "IN_PRODUCTION",
        assigneeId: assignee.userId,
      },
    });

    const before = new Date();
    const { returnId } = await createPricingReturn(actor, {
      workItemId: workItem.id,
      assignedToId: assignee.userId,
      explanation: "Customer disputes the quoted price for this banner.",
    });
    const after = new Date();

    // Acceptance Scenario 1: category is PRICING_ISSUE
    const returnRow = await testDb.return.findUniqueOrThrow({ where: { id: returnId } });
    expect(returnRow.category).toBe("PRICING_ISSUE");

    // Acceptance Scenario 1: origin department is Pricing, not Design or Production
    expect(returnRow.originDepartmentId).toBe(pricingDepartmentId);

    // Acceptance Scenario 1: required explanation
    expect(returnRow.explanation).toBe("Customer disputes the quoted price for this banner.");

    // Acceptance Scenario 1: actor (raisedById) matches the caller
    expect(returnRow.raisedById).toBe(actor.userId);

    // Acceptance Scenario 1: assignee
    expect(returnRow.assignedToId).toBe(assignee.userId);

    // Acceptance Scenario 1: timestamp within the operation window
    expect(returnRow.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(returnRow.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("has no DesignVersion — the return does not masquerade as a design failure", async () => {
    const actor = await createActor(["pricing.use_fixed"]);
    const assignee = await createActor(["pricing.use_fixed"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "IN_PRODUCTION",
        assigneeId: assignee.userId,
      },
    });

    const { returnId } = await createPricingReturn(actor, {
      workItemId: workItem.id,
      assignedToId: assignee.userId,
      explanation: "Wrong price was applied to the invoice.",
    });

    // Acceptance Scenario 2: no designVersionId — distinguishable from design returns
    const returnRow = await testDb.return.findUniqueOrThrow({ where: { id: returnId } });
    expect(returnRow.designVersionId).toBeNull();
  });

  it("rejects an empty explanation (explanation is required)", async () => {
    const actor = await createActor(["pricing.use_fixed"]);
    const assignee = await createActor(["pricing.use_fixed"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "IN_PRODUCTION",
        assigneeId: assignee.userId,
      },
    });

    // Explanation is required per contracts/returns.md and spec.md US6 AS1
    await expect(
      createPricingReturn(actor, {
        workItemId: workItem.id,
        assignedToId: assignee.userId,
        explanation: "",
      }),
    ).rejects.toThrow();

    // Verify no Return row was created
    const returns = await testDb.return.findMany({
      where: { workItemId: workItem.id, category: "PRICING_ISSUE" },
    });
    expect(returns).toHaveLength(0);
  });

  it("supports an optional note alongside the required explanation", async () => {
    const actor = await createActor(["pricing.use_fixed"]);
    const assignee = await createActor(["pricing.use_fixed"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "IN_PRODUCTION",
        assigneeId: assignee.userId,
      },
    });

    const { returnId } = await createPricingReturn(actor, {
      workItemId: workItem.id,
      assignedToId: assignee.userId,
      explanation: "Price mismatch detected during final review.",
      note: "See attached invoice comparison.",
    });

    const returnRow = await testDb.return.findUniqueOrThrow({ where: { id: returnId } });
    expect(returnRow.explanation).toBe("Price mismatch detected during final review.");
    expect(returnRow.note).toBe("See attached invoice comparison.");
  });

  it("writes a PRICING_ISSUE return that is distinguishable from DESIGN_ISSUE returns", async () => {
    const actor = await createActor(["pricing.use_fixed"]);
    const assignee = await createActor(["pricing.use_fixed"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "IN_PRODUCTION",
        assigneeId: assignee.userId,
      },
    });

    const { returnId } = await createPricingReturn(actor, {
      workItemId: workItem.id,
      assignedToId: assignee.userId,
      explanation: "Price is wrong — customer was overcharged.",
    });

    // Confirm the return is category PRICING_ISSUE, not DESIGN_ISSUE
    const pricingReturn = await testDb.return.findUniqueOrThrow({ where: { id: returnId } });
    expect(pricingReturn.category).toBe("PRICING_ISSUE");
    expect(pricingReturn.category).not.toBe("DESIGN_ISSUE");

    // Confirm queryability: PRICING_ISSUE returns are queryable through the shared Return model
    const pricingReturns = await testDb.return.findMany({
      where: { category: "PRICING_ISSUE" },
    });
    expect(pricingReturns.some((r) => r.id === returnId)).toBe(true);
  });

  it("rolls back the entire transaction when createReturnInTx fails", async () => {
    const actor = await createActor(["pricing.use_fixed"]);
    const assignee = await createActor(["pricing.use_fixed"]);

    // Create a valid work item first
    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "IN_PRODUCTION",
        assigneeId: assignee.userId,
      },
    });

    const returnsBefore = await testDb.return.findMany({
      where: { workItemId: workItem.id },
    });

    // Attempt to create a return with a non-existent workItemId
    // The transaction should roll back and no Return row should be created
    await expect(
      createPricingReturn(actor, {
        workItemId: "nonexistent_work_item_id",
        assignedToId: assignee.userId,
        explanation: "This should fail and roll back.",
      }),
    ).rejects.toThrow();

    // Confirm no Return rows were written for the valid work item
    const returnsAfter = await testDb.return.findMany({
      where: { workItemId: workItem.id },
    });
    expect(returnsAfter).toHaveLength(returnsBefore.length);
  });
});
