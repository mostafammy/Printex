// Contract test — tasks.md T035 (US4), contracts/workflow.md `registerGuard`,
// SC-005.
//
// Proves a second engineer can integrate purely through the frozen contract:
// this test registers a guard from OUTSIDE `src/server/core/**` (right here,
// simulating what 051's delivery-pricing gate will eventually do from its
// own feature module) using nothing but `registerGuard`/`GuardFn` imported
// from the public barrel `~/server/core`, and shows it causes
// `transitionWorkItem` to fail with `GUARD_FAILED` — with zero changes to
// any file under `src/server/core/`.
//
// Requires a live Postgres reachable at `DATABASE_URL_TEST` (research.md
// §9), same as the other integration-shaped contract test in this feature.
// If none is reachable in this environment, this fails at the first
// `testDb.*` call with a connection error rather than silently passing.

import { afterAll, describe, expect, it } from "vitest";

import { testDb } from "../helpers/testDb";
import { seedCustomer, seedOrder, seedUser, seedWorkItem } from "../helpers/seed";

import type { Actor, GuardFn } from "~/server/core";
import { registerGuard, transitionWorkItem } from "~/server/core";

afterAll(async () => {
  await testDb.$disconnect();
});

describe("registerGuard (external contract extension)", () => {
  it("an externally-registered guard blocks transitionWorkItem with GUARD_FAILED", async () => {
    // Simulates 051's delivery-pricing gate: a feature outside `core`
    // registering policy against a specific edge, at module load time, via
    // nothing but the public `registerGuard` contract.
    const externalPricingGuard: GuardFn = async (_ctx) => {
      return {
        ok: false,
        error: { code: "PRICING_NOT_CONFIRMED", message: "Delivery pricing is not confirmed." },
      };
    };
    registerGuard({ to: "READY_FOR_PRODUCTION" }, externalPricingGuard);

    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    // NEW -> READY_FOR_PRODUCTION is a legal edge per ALLOWED_EDGES, so the
    // guard (not the edge table) is what must block this transition.
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });
    const actor: Actor = { userId, roles: ["reception"], departmentIds: [] };

    const result = await testDb.$transaction((tx) =>
      transitionWorkItem(tx, { workItemId, to: "READY_FOR_PRODUCTION", actor }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("GUARD_FAILED");

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("NEW");
  });
});
