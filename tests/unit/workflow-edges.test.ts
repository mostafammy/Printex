// Table-driven test over the full 15x15 WorkItemState matrix — tasks.md
// T019, spec FR-003, FR-003a, SC-001.
//
// This exercises the REAL `transitionWorkItem` against a live Postgres test
// database (`DATABASE_URL_TEST`, research.md §9) for every one of the
// 15 x 15 = 225 (from, to) pairs: every pair present in `ALLOWED_EDGES`
// must succeed and land the Work Item on `to`; every pair absent from it
// must fail with `INVALID_TRANSITION` and leave the Work Item unmoved.
//
// If no live Postgres is reachable in the environment this runs in, every
// case below fails at its first `testDb.*` call with a connection error —
// see tests/helpers/testDb.ts. This file is written to run for real in CI
// (.github/workflows/ci.yml provisions a Postgres service container and
// DATABASE_URL_TEST) even when it cannot run against a live database
// locally.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/testDb";
import { seedCustomer, seedOrder, seedUser } from "../helpers/seed";
import { transitionWorkItem } from "~/server/core/workflow/transition";
import { ALLOWED_EDGES } from "~/server/core/workflow/edges";
import { WORK_ITEM_STATES, type WorkItemState } from "~/server/core/workflow/states";
import { asWorkItemId } from "~/server/core/ids";
import type { OrderId } from "~/server/core/ids";
import type { Actor } from "~/server/core/actor";

afterAll(async () => {
  await testDb.$disconnect();
});

describe("transitionWorkItem — full 15x15 allowed-edges matrix (integration)", () => {
  let actor: Actor;
  let orderId: OrderId;

  beforeAll(async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    orderId = await seedOrder({ customerId, createdById: userId });
    actor = { id: userId, roles: ["head_designer", "reception"], departmentIds: [] };
  });

  async function makeWorkItem(state: WorkItemState) {
    const workItem = await testDb.workItem.create({ data: { orderId, state } });
    return asWorkItemId(workItem.id);
  }

  for (const from of WORK_ITEM_STATES) {
    for (const to of WORK_ITEM_STATES) {
      const isAllowed: boolean = ALLOWED_EDGES[from].includes(to);

      it(`${isAllowed ? "allows" : "rejects"} ${from} -> ${to}`, async () => {
        const workItemId = await makeWorkItem(from);
        const needsReason = to === "REWORK_REQUIRED" || to === "CANCELLED";

        const result = await testDb.$transaction((tx) =>
          transitionWorkItem(tx, {
            workItemId,
            to,
            actor,
            reason: needsReason ? "table-driven test reason" : undefined,
            rejectionCategory: to === "REWORK_REQUIRED" ? "OTHER" : undefined,
          }),
        );

        if (isAllowed) {
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.value.state).toBe(to);
          }
        } else {
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.code).toBe("INVALID_TRANSITION");
          }
          const stillFrom = await testDb.workItem.findUniqueOrThrow({
            where: { id: workItemId },
          });
          expect(stillFrom.state).toBe(from);
        }
      });
    }
  }
});
