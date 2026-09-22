// Integration test for audit-rollback atomicity — tasks.md T022, SC-002,
// US2 Acceptance Scenario 3, correction #1 (phase-timing atomicity).
//
// Forces a real Postgres constraint failure at the "audit record" step
// (the `WorkItemTransition` insert, whose `actorId` is a real FK to
// `User.id` — see transition.ts's step 6 comment on why this row IS the
// audit trail until 001-identity-access-audit ships a dedicated table) by
// passing an `actor.id` that does not correspond to any seeded `User` row.
// This is a genuine constraint violation surfaced by real Postgres
// transaction semantics, not a mocked failure (research.md §9's stated
// preference for real transaction semantics over mocking Prisma).
//
// Requires a live Postgres reachable at `DATABASE_URL_TEST` — see
// tests/helpers/testDb.ts.

import { afterAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/testDb";
import { seedCustomer, seedOrder, seedUser, seedWorkItem } from "../helpers/seed";
import { transitionWorkItem } from "~/server/core/workflow/transition";
import { asUserId } from "~/server/core/ids";
import type { Actor } from "~/server/core/actor";

afterAll(async () => {
  await testDb.$disconnect();
});

describe("transitionWorkItem rollback (integration)", () => {
  it("rolls back the WorkItem.state update, the WorkItemTransition insert, phase-timing segments, and the NotificationEvent when the audit-record write fails", async () => {
    const realUserId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: realUserId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });

    // A syntactically valid, but non-existent, User id — the
    // WorkItemTransition.actorId FK constraint will reject this at step 6,
    // after the state update (step 4) and phase-timing writes (step 5)
    // have already been issued inside the same `tx`.
    const nonExistentActor: Actor = {
      id: asUserId("nonexistent_user_does_not_exist"),
      roles: ["reception"],
      departmentIds: [],
    };

    await expect(
      testDb.$transaction((tx) =>
        transitionWorkItem(tx, { workItemId, to: "ASSIGNED", actor: nonExistentActor }),
      ),
    ).rejects.toBeTruthy();

    // --- Everything must be exactly as it was before the attempt. --------
    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("NEW");

    const transitions = await testDb.workItemTransition.findMany({ where: { workItemId } });
    expect(transitions).toHaveLength(0);

    const phaseTimings = await testDb.phaseTiming.findMany({ where: { workItemId } });
    expect(phaseTimings).toHaveLength(0);

    const notifications = await testDb.notificationEvent.findMany({
      where: { entityType: "WorkItem", entityId: workItemId },
    });
    expect(notifications).toHaveLength(0);
  });

  it("a subsequent legal transition still succeeds after a rolled-back attempt (the Work Item was not left in a broken state)", async () => {
    const realUserId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: realUserId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });

    const nonExistentActor: Actor = {
      id: asUserId("still_not_a_real_user"),
      roles: [],
      departmentIds: [],
    };

    await expect(
      testDb.$transaction((tx) =>
        transitionWorkItem(tx, { workItemId, to: "ASSIGNED", actor: nonExistentActor }),
      ),
    ).rejects.toBeTruthy();

    const realActor: Actor = { id: realUserId, roles: ["reception"], departmentIds: [] };
    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, { workItemId, to: "ASSIGNED", actor: realActor }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe("ASSIGNED");

    const transitions = await testDb.workItemTransition.findMany({ where: { workItemId } });
    expect(transitions).toHaveLength(1);
  });
});
