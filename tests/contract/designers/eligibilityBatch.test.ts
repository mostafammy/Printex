// tests/contract/designers/eligibilityBatch.test.ts — T017 (092-performance, US3).
//
// specs/092-performance/contracts/query-batching.md §4 + research.md Decision
// "Designer eligibility is five set-based reads":
// - batch output per work item deep-equals repeated getEligibleDesigners
//   (same suggestion output, multi-customer fixtures included);
// - empty id list → empty Map with ZERO queries (4.3);
// - unauthorized actor → the same FORBIDDEN as the single path (4.2);
// - non-assignable state / missing id → the same DomainDesignerError
//   code + message as the single path (research table read #1 parity).
//
// Written BEFORE T019 — importing getEligibleDesignersBatch must fail until
// the batch loader exists in src/server/designers/assignment.ts.
//
// T001 queryCount pattern (file-scoped vi.mock): the SUT runs through the
// instrumented ~/server/db singleton; fixtures seed via the UNinstrumented
// tests/helpers/testDb.ts so seeding never pollutes the capture buffer.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", async () => {
  const { dbMockFactory } = await import("../../helpers/queryCount");
  return dbMockFactory();
});

import { captureQueries } from "../../helpers/queryCount";
import { testDb } from "../../helpers/testDb";
import { getEligibleDesigners, getEligibleDesignersBatch } from "~/server/designers/assignment";
import { DomainDesignerError } from "~/server/designers/errors";
import { ForbiddenError } from "~/server/auth/authorize";
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
    userId: unique("elig-batch-actor"),
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
  // getEligibleDesigners resolves the design.work candidate base from the DB,
  // not from the in-memory Actor — persist the grants too.
  if (permissions.length > 0) {
    await testDb.userPermission.createMany({
      data: permissions.map((permission) => ({
        userId: actor.userId,
        permission,
        grantedById: actor.userId,
      })),
    });
  }
  return actor;
}

let actor: Actor;
let forbiddenActor: Actor;
const designerUserIds: string[] = [];

beforeAll(async () => {
  actor = await createActor(["workitem.assign_designer"]);
  forbiddenActor = await createActor([]);
  for (let i = 0; i < 4; i++) {
    const designer = await createActor(["design.work"]);
    designerUserIds.push(designer.userId);
  }
});

async function seedOrder(customerName: string, createdById: string) {
  const customer = await testDb.customer.create({ data: { name: customerName } });
  return testDb.order.create({
    data: {
      customerId: customer.id,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById,
    },
  });
}

/**
 * Equivalence fixture: two orders on TWO customers (exercises research read
 * #4's per-customer past-jobs), assignable-state items only, plus workload
 * (active non-terminal items), past jobs (DELIVERED) under both customers,
 * and ASSIGNED transitions (two for one designer → latest wins; none for
 * another → null lastAssignedAt).
 */
async function seedEquivalenceFixture(): Promise<string[]> {
  const orderA = await seedOrder(unique("eq-customer-A"), actor.userId);
  const orderB = await seedOrder(unique("eq-customer-B"), actor.userId);

  const [d0, d1, d2, d3] = designerUserIds as [string, string, string, string];

  // Assignable work items — 3 on order A, 2 on order B (5-item fixture).
  const states = ["NEW", "ASSIGNED", "IN_DESIGN", "REWORK_REQUIRED", "NEW"] as const;
  const itemIds: string[] = [];
  for (const [i, state] of states.entries()) {
    const item = await testDb.workItem.create({
      data: { orderId: i < 3 ? orderA.id : orderB.id, state },
    });
    itemIds.push(item.id);
  }

  // Active (non-terminal) work: d0 and d1 carry different loads.
  for (const designerId of [d0, d0, d1]) {
    await testDb.workItem.create({
      data: { orderId: orderA.id, state: "IN_DESIGN", assigneeId: designerId },
    });
  }

  // Past jobs (DELIVERED) — d0 under customer A, d0+d1 under customer B.
  for (const designerId of [d0]) {
    await testDb.workItem.create({
      data: { orderId: orderA.id, state: "DELIVERED", assigneeId: designerId },
    });
  }
  for (const designerId of [d0, d1]) {
    await testDb.workItem.create({
      data: { orderId: orderB.id, state: "DELIVERED", assigneeId: designerId },
    });
  }

  // Latest ASSIGNED transition per designer: two rows for d0 (newer wins),
  // none for d1/d2/d3 (→ null lastAssignedAt parity).
  const older = await testDb.workItem.create({
    data: { orderId: orderA.id, state: "ASSIGNED", assigneeId: d0 },
  });
  await testDb.workItemTransition.createMany({
    data: [
      {
        workItemId: older.id,
        from: "NEW",
        to: "ASSIGNED",
        actorId: d0,
        at: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        workItemId: older.id,
        from: "NEW",
        to: "ASSIGNED",
        actorId: d0,
        at: new Date("2026-03-01T00:00:00.000Z"),
      },
    ],
  });

  return itemIds;
}

describe("designer-assignment contract: getEligibleDesignersBatch (T017, query-batching §4)", () => {
  it("batch output per work item deep-equals repeated getEligibleDesigners (4.1)", async () => {
    const ids = await seedEquivalenceFixture();

    // Strict deep-equality per attempt. The shared test DB may be written by
    // another concurrently running suite (workload counts are global), which
    // can land between the batch read and the single reads — retry the whole
    // comparison rather than weaken it. CI runs test files serially
    // (vitest.config fileParallelism:false), so there the first attempt holds.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = await getEligibleDesignersBatch(actor, ids);
        expect(batch).toBeInstanceOf(Map);
        expect(batch.size).toBe(ids.length);

        for (const id of ids) {
          expect(batch.has(id)).toBe(true);
          const single = await getEligibleDesigners(actor, id);
          expect(batch.get(id)).toEqual(single);
        }

        // Not trivially empty: the candidate base resolved and at least one
        // row (frozen EligibleDesigner shape) came back per item.
        const first = batch.get(ids[0]!)!;
        expect(first.length).toBeGreaterThan(0);
        expect(typeof first[0]!.userId).toBe("string");
        expect(typeof first[0]!.isSuggested).toBe("boolean");
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError) throw lastError;
    // The shared test DB holds 100+ design.work holders, so each repeated
    // single-path call costs ~3×D queries — allow the parity loop time to
    // finish over the network pooler (the batch side stays 5 reads).
  }, 240_000);

  it("empty id list → empty Map with ZERO queries (4.3)", async () => {
    const { result, queries } = await captureQueries(() =>
      getEligibleDesignersBatch(actor, []),
    );

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(queries).toHaveLength(0);
  });

  it("unauthorized actor → the same FORBIDDEN as the single path (4.2)", async () => {
    const workItem = await testDb.workItem.create({
      data: {
        orderId: (await seedOrder(unique("forb-customer"), actor.userId)).id,
        state: "NEW",
      },
    });

    const batchError = await getEligibleDesignersBatch(forbiddenActor, [workItem.id]).catch(
      (e: unknown) => e,
    );
    const singleError = await getEligibleDesigners(forbiddenActor, workItem.id).catch(
      (e: unknown) => e,
    );

    expect(batchError).toBeInstanceOf(ForbiddenError);
    expect(singleError).toBeInstanceOf(ForbiddenError);
    expect((batchError as Error).message).toBe((singleError as Error).message);
  });

  it("non-assignable state → same NOT_ASSIGNABLE error as the single path", async () => {
    const order = await seedOrder(unique("na-customer"), actor.userId);
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "DELIVERED" },
    });

    const batchError = (await getEligibleDesignersBatch(actor, [workItem.id]).catch(
      (e: unknown) => e,
    )) as DomainDesignerError;
    const singleError = (await getEligibleDesigners(actor, workItem.id).catch(
      (e: unknown) => e,
    )) as DomainDesignerError;

    expect(batchError).toBeInstanceOf(DomainDesignerError);
    expect(singleError).toBeInstanceOf(DomainDesignerError);
    expect(batchError.code).toBe("NOT_ASSIGNABLE");
    expect(batchError.code).toBe(singleError.code);
    expect(batchError.message).toBe(singleError.message);
  });

  it("missing id → same WORK_ITEM_NOT_FOUND error as the single path", async () => {
    const missingId = `missing_${unique("wi")}`;

    const batchError = (await getEligibleDesignersBatch(actor, [missingId]).catch(
      (e: unknown) => e,
    )) as DomainDesignerError;
    const singleError = (await getEligibleDesigners(actor, missingId).catch(
      (e: unknown) => e,
    )) as DomainDesignerError;

    expect(batchError).toBeInstanceOf(DomainDesignerError);
    expect(singleError).toBeInstanceOf(DomainDesignerError);
    expect(batchError.code).toBe("WORK_ITEM_NOT_FOUND");
    expect(batchError.code).toBe(singleError.code);
    expect(batchError.message).toBe(singleError.message);
  });
});
