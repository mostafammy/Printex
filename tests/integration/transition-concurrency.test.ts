// Integration test for optimistic concurrency — tasks.md T023, plan.md
// §5.5 (`updateMany({ where: { id, state: expectedFromState }, ... })` +
// `count === 1`).
//
// Fires two concurrent `transitionWorkItem` calls at the same Work Item
// (same expected `from` state, different `to`) and asserts exactly one
// commits and the other fails cleanly — a resolved `err(...)` Result with
// `INVALID_TRANSITION` (the losing `updateMany` matches zero rows once the
// winner has committed its state change), never a silently-applied double
// transition and never an unhandled/uncaught rejection on the losing side.
//
// Requires a live Postgres reachable at `DATABASE_URL_TEST` — see
// tests/helpers/testDb.ts.

import { afterAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/testDb";
import { seedCustomer, seedOrder, seedUser, seedWorkItem } from "../helpers/seed";
import { transitionWorkItem } from "~/server/core/workflow/transition";
import type { Actor } from "~/server/core/actor";

afterAll(async () => {
  await testDb.$disconnect();
});

describe("transitionWorkItem concurrency (integration)", () => {
  it("exactly one of two concurrent transitions from the same state succeeds; the other fails cleanly", async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });
    const actor: Actor = { id: userId, roles: ["reception"], departmentIds: [] };

    const [settledA, settledB] = await Promise.allSettled([
      testDb.$transaction((tx) =>
        transitionWorkItem(tx, { workItemId, to: "ASSIGNED", actor }),
      ),
      testDb.$transaction((tx) =>
        transitionWorkItem(tx, {
          workItemId,
          to: "CANCELLED",
          actor,
          reason: "concurrent cancel attempt",
        }),
      ),
    ]);

    // Neither call may crash the process / produce an unhandled exception —
    // Promise.allSettled already guarantees that at the JS level, but we
    // additionally assert neither settlement is a *rejection*: a losing
    // `updateMany` (count !== 1) must resolve to `err(...)`, not throw,
    // because it happens before any write in that attempt (see transition.ts
    // step 4 comment).
    expect(settledA.status).toBe("fulfilled");
    expect(settledB.status).toBe("fulfilled");

    const results = [settledA, settledB]
      .filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof transitionWorkItem>>> =>
        s.status === "fulfilled",
      )
      .map((s) => s.value);

    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    if (!failed[0]?.ok) {
      expect(failed[0]?.error.code).toBe("INVALID_TRANSITION");
    }

    // The Work Item landed in exactly one of the two attempted states —
    // never left in NEW (which would mean both failed) and never something
    // else (which would mean corruption).
    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(["ASSIGNED", "CANCELLED"]).toContain(workItem.state);

    // Exactly one WorkItemTransition row — no double-application.
    const transitions = await testDb.workItemTransition.findMany({ where: { workItemId } });
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.to).toBe(workItem.state);
  });
});
