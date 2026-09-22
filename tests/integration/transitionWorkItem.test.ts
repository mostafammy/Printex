// Integration test for `transitionWorkItem` — tasks.md T021, SC-002,
// FR-006, FR-018, contracts/workflow.md.
//
// Requires a live Postgres reachable at `DATABASE_URL_TEST` (research.md
// §9). If none is reachable in this environment, every test below fails at
// the first `testDb.*` call with a connection error rather than silently
// passing — see tests/helpers/testDb.ts.

import { afterAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/testDb";
import { seedCustomer, seedOrder, seedUser, seedWorkItem } from "../helpers/seed";
import { transitionWorkItem } from "~/server/core";
import type { Actor } from "~/server/core";

afterAll(async () => {
  await testDb.$disconnect();
});

describe("transitionWorkItem (integration)", () => {
  it("a single legal transition atomically updates state, writes exactly one WorkItemTransition row, and one NotificationEvent row", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });
    const actor: Actor = { id: userId, roles: ["reception"], departmentIds: [] };

    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, { workItemId, to: "ASSIGNED", actor }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`expected success, got ${JSON.stringify(result.error)}`);
    }
    expect(result.value.state).toBe("ASSIGNED");
    expect(result.value.id).toBe(workItemId);

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("ASSIGNED");

    const transitions = await testDb.workItemTransition.findMany({ where: { workItemId } });
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      from: "NEW",
      to: "ASSIGNED",
      actorId: userId,
    });

    const notifications = await testDb.notificationEvent.findMany({
      where: { entityType: "WorkItem", entityId: workItemId },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.type).toBe("work_item.state_changed");
  });

  it("rejects a forbidden edge with INVALID_TRANSITION and writes nothing", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });
    const actor: Actor = { id: userId, roles: ["reception"], departmentIds: [] };

    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, { workItemId, to: "DELIVERED", actor }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("NEW");

    const transitions = await testDb.workItemTransition.findMany({ where: { workItemId } });
    expect(transitions).toHaveLength(0);
  });

  it("requires a reason for edges landing in CANCELLED", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });
    const actor: Actor = { id: userId, roles: ["reception"], departmentIds: [] };

    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, { workItemId, to: "CANCELLED", actor }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
  });

  it("requires a rejectionCategory for edges landing in REWORK_REQUIRED", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "WAITING_REVIEW" });
    const actor: Actor = { id: userId, roles: ["head_designer"], departmentIds: [] };

    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, {
        workItemId,
        to: "REWORK_REQUIRED",
        actor,
        reason: "needs fixes",
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
  });
});
