// tests/integration/phaseDurationsBatch.test.ts — T023 + T024
// (092-performance, US4: my-queue batched phase durations).
//
// AC-011 (PR-003): the batch is exactly 2 queries regardless of id-list
//   length, and the page-level duration count is identical at pageSize 1 vs
//   10 (T024).
// AC-012 (FR-017, contract §3.2): batch output deep-equals the EXISTING
//   per-row `phaseDurations()` on fixtures covering queue-only, active-only,
//   rework-restarted, DESIGN_COMPLETED with/without a start transition, and
//   no-segments → `null` total.
// AC-013 (FR-018, contract §3.4): passing only user A's work-item ids
//   returns only A's keys, and the where-clause never contains user B's ids.
//
// queryCount.ts file-scoped mock pattern (see shell-layout-queries.test.ts):
// the SUT runs through the instrumented `~/server/db` singleton while
// fixtures are seeded with the UNinstrumented `tests/helpers/testDb.ts`.
//
// `paramLog` is a SECOND `$on("query")` listener on the same mocked client
// (`vi.hoisted` — vi.mock factories are hoisted above module scope). It
// matters for the leakage assertion: Prisma logs `IN ($1,$2)` in
// `event.query` with the bound values in `event.params`, so SQL text alone
// can never show WHICH ids entered the where clause; logging query+params
// lets the test prove B's ids are absent from the bound parameters too.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const paramLog = vi.hoisted(() => [] as string[]);

vi.mock("~/server/db", async () => {
  const { dbMockFactory } = await import("../helpers/queryCount");
  const mock = dbMockFactory();
  // dbMockFactory annotates its return as plain `PrismaClient`, which erases
  // the event-log generic (so `$on`'s eventType narrows to `never` at call
  // sites); structurally re-declare the one overload used here.
  const client = mock.db as unknown as {
    $on(type: "query", cb: (event: { query: string; params: string }) => void): void;
  };
  client.$on("query", (event) => {
    paramLog.push(`${event.query} -- ${event.params}`);
  });
  return mock;
});

import { captureQueries } from "../helpers/queryCount";
import { testDb } from "../helpers/testDb";
import { phaseDurations, phaseDurationsByIds } from "~/server/designers/timer";
import { getMyQueuePage } from "~/server/designers";
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

// Fixed epoch for fixtures: every segment is CLOSED, so both paths derive
// the same numbers from persisted timestamps alone — no wall-clock drift
// between the batched call and the per-row calls (BC-002, SC-004).
const T0 = new Date("2026-01-05T08:00:00.000Z");
function t(ms: number): Date {
  return new Date(T0.getTime() + ms);
}

type SegSpec = {
  readonly phase: "ASSIGNED" | "IN_DESIGN" | "REWORK_REQUIRED";
  readonly kind: "QUEUE" | "ACTIVE";
  readonly startedAt: Date;
  readonly endedAt: Date;
};

type TransSpec = {
  readonly from: "NEW" | "IN_DESIGN";
  readonly to: "ASSIGNED" | "REWORK_REQUIRED" | "DESIGN_COMPLETED";
  readonly at: Date;
};

async function actorFor(userId: string): Promise<Actor> {
  return {
    userId,
    roles: [],
    permissions: new Set<Permission>(),
    departmentIds: [],
  };
}

let customerId: string;
let actorA: Actor;
let actorPage: Actor;
let orderA: string;
let orderB: string;
let orderPage: string;

/** Fixture work-item ids by case name, covering every AC-012 scenario. */
interface FixtureMap {
  queueOnly: string;
  activeOnly: string;
  reworkRestarted: string;
  completedWithStart: string;
  completedNoStart: string;
  noSegments: string;
}
// Populated in beforeAll; the assertion type bypasses noUncheckedIndexedAccess
// so every reference is a plain `string`.
const fixtures = {} as FixtureMap;
/** User B's work items — must NEVER enter user A's batch (AC-013). */
const foreignIds: string[] = [];

async function seedWorkItem(
  assigneeId: string,
  orderId: string,
  segments: SegSpec[] = [],
  transitions: TransSpec[] = [],
): Promise<string> {
  const workItem = await testDb.workItem.create({
    data: { orderId, state: "ASSIGNED", assigneeId },
  });
  for (const seg of segments) {
    await testDb.phaseTiming.create({
      data: {
        workItemId: workItem.id,
        phase: seg.phase,
        kind: seg.kind,
        startedAt: seg.startedAt,
        endedAt: seg.endedAt,
      },
    });
  }
  for (const tr of transitions) {
    await testDb.workItemTransition.create({
      data: {
        workItemId: workItem.id,
        from: tr.from,
        to: tr.to,
        actorId: assigneeId,
        at: tr.at,
      },
    });
  }
  return workItem.id;
}

beforeAll(async () => {
  const userIdA = unique("batchA");
  const userIdB = unique("batchB");
  const userIdPage = unique("batchPage");
  for (const id of [userIdA, userIdB, userIdPage]) {
    await testDb.user.create({
      data: {
        id,
        name: id,
        email: `${id}@example.test`,
        username: id,
        isActive: true,
      },
    });
  }
  actorA = await actorFor(userIdA);
  actorPage = await actorFor(userIdPage);

  const customer = await testDb.customer.create({ data: { name: unique("BatchCustomer") } });
  customerId = customer.id;

  const mkOrder = (createdById: string) =>
    testDb.order
      .create({
        data: {
          customerId,
          channel: "WALK_IN",
          priority: "NORMAL",
          mode: "SEPARATE",
          createdById,
        },
      })
      .then((o) => o.id);
  orderA = await mkOrder(userIdA);
  orderB = await mkOrder(userIdB);
  orderPage = await mkOrder(userIdPage);

  // ── AC-012 fixture table ────────────────────────────────────────────────
  fixtures.queueOnly = await seedWorkItem(userIdA, orderA, [
    { phase: "ASSIGNED", kind: "QUEUE", startedAt: t(0), endedAt: t(2000) },
  ]);
  fixtures.activeOnly = await seedWorkItem(userIdA, orderA, [
    { phase: "IN_DESIGN", kind: "ACTIVE", startedAt: t(0), endedAt: t(5000) },
  ]);
  // Phase restarted after rework: total = DESIGN_COMPLETED − last
  // REWORK_REQUIRED start (not the original ASSIGNED start).
  fixtures.reworkRestarted = await seedWorkItem(
    userIdA,
    orderA,
    [
      { phase: "ASSIGNED", kind: "QUEUE", startedAt: t(0), endedAt: t(2000) },
      { phase: "REWORK_REQUIRED", kind: "QUEUE", startedAt: t(10000), endedAt: t(13000) },
      { phase: "IN_DESIGN", kind: "ACTIVE", startedAt: t(11000), endedAt: t(15000) },
    ],
    [
      { from: "NEW", to: "ASSIGNED", at: t(0) },
      { from: "IN_DESIGN", to: "REWORK_REQUIRED", at: t(10000) },
      { from: "IN_DESIGN", to: "DESIGN_COMPLETED", at: t(15000) },
    ],
  );
  fixtures.completedWithStart = await seedWorkItem(
    userIdA,
    orderA,
    [
      { phase: "ASSIGNED", kind: "QUEUE", startedAt: t(0), endedAt: t(7000) },
      { phase: "IN_DESIGN", kind: "ACTIVE", startedAt: t(1000), endedAt: t(4000) },
    ],
    [
      { from: "NEW", to: "ASSIGNED", at: t(0) },
      { from: "IN_DESIGN", to: "DESIGN_COMPLETED", at: t(7000) },
    ],
  );
  // DESIGN_COMPLETED with NO preceding ASSIGNED/REWORK_REQUIRED → null total.
  fixtures.completedNoStart = await seedWorkItem(
    userIdA,
    orderA,
    [{ phase: "ASSIGNED", kind: "QUEUE", startedAt: t(0), endedAt: t(1000) }],
    [{ from: "IN_DESIGN", to: "DESIGN_COMPLETED", at: t(9000) }],
  );
  fixtures.noSegments = await seedWorkItem(userIdA, orderA);

  // ── AC-013: user B's rows exist (with data) but are never requested ────
  for (let i = 0; i < 2; i += 1) {
    foreignIds.push(
      await seedWorkItem(
        userIdB,
        orderB,
        [
          { phase: "ASSIGNED", kind: "QUEUE", startedAt: t(0), endedAt: t(1234) },
          { phase: "IN_DESIGN", kind: "ACTIVE", startedAt: t(0), endedAt: t(4321) },
        ],
        [
          { from: "NEW", to: "ASSIGNED", at: t(0) },
          { from: "IN_DESIGN", to: "DESIGN_COMPLETED", at: t(8000) },
        ],
      ),
    );
  }

  // ── T024: page fixture — exactly 10 queue rows for a dedicated user ────
  for (let i = 0; i < 10; i += 1) {
    await seedWorkItem(userIdPage, orderPage, [
      { phase: "ASSIGNED", kind: "QUEUE", startedAt: t(i * 1000), endedAt: t(i * 1000 + 500) },
    ]);
  }
});

describe("T023 — equivalence (AC-012, FR-017)", () => {
  it("batch result deep-equals the existing per-row phaseDurations() for every fixture row", async () => {
    const ids = Object.values(fixtures);
    expect(ids).toHaveLength(6);

    const batch = await phaseDurationsByIds(actorA, ids);

    expect([...batch.keys()].sort()).toEqual([...ids].sort());

    for (const [name, id] of Object.entries(fixtures)) {
      const perRow = await phaseDurations(actorA, id);
      // Fixture sanity: the untouched per-row path yields the intended shape…
      expect(perRow, `per-row sanity for "${name}"`).toEqual(expectedFor(name));
      // …and the batch is byte-identical to it (AC-012).
      expect(batch.get(id), `batch ≡ per-row for "${name}"`).toEqual(perRow);
    }
  });
});

/** Literal expected durations per fixture — pins the semantics both paths share. */
function expectedFor(name: string): {
  queueTimeMs: number;
  activeTimeMs: number;
  totalPhaseDurationMs: number | null;
} {
  switch (name) {
    case "queueOnly":
      return { queueTimeMs: 2000, activeTimeMs: 0, totalPhaseDurationMs: null };
    case "activeOnly":
      return { queueTimeMs: 0, activeTimeMs: 5000, totalPhaseDurationMs: null };
    case "reworkRestarted":
      // queue: 2000 + 3000; active: 4000; total: 15000 − 10000 (rework start).
      return { queueTimeMs: 5000, activeTimeMs: 4000, totalPhaseDurationMs: 5000 };
    case "completedWithStart":
      return { queueTimeMs: 7000, activeTimeMs: 3000, totalPhaseDurationMs: 7000 };
    case "completedNoStart":
      return { queueTimeMs: 1000, activeTimeMs: 0, totalPhaseDurationMs: null };
    case "noSegments":
      return { queueTimeMs: 0, activeTimeMs: 0, totalPhaseDurationMs: null };
    default:
      throw new Error(`unknown fixture "${name}"`);
  }
}

describe("T023 — scoping (AC-013, FR-018)", () => {
  it("user A's ids return only A's keys and the where-clause never binds user B's ids", async () => {
    const aIds = [fixtures.queueOnly, fixtures.activeOnly];
    paramLog.length = 0;

    const { result: batch, queries: sql } = await captureQueries(() =>
      phaseDurationsByIds(actorA, aIds),
    );

    // Returns exactly the requested keys — nothing else.
    expect([...batch.keys()].sort()).toEqual([...aIds].sort());
    expect(batch.size).toBe(aIds.length);

    const logged = paramLog.join("\n");
    // Params ARE captured (otherwise the absence checks below are vacuous)…
    for (const id of aIds) {
      expect(logged, "A's ids are bound in the where-clause params").toContain(id);
    }
    // …so B's ids being absent proves they never entered either where clause.
    for (const id of foreignIds) {
      expect(sql.join("\n")).not.toContain(id);
      expect(logged, "user B's work-item id leaked into a where-clause").not.toContain(id);
    }
  });
});

describe("T023 — constant query count (AC-011, PR-003)", () => {
  it("the batch is exactly 2 queries regardless of id-list length", async () => {
    const one = await captureQueries(() => phaseDurationsByIds(actorA, [fixtures.queueOnly]));
    expect(one.queries).toHaveLength(2);

    const all = await captureQueries(() => phaseDurationsByIds(actorA, Object.values(fixtures)));
    expect(all.queries).toHaveLength(2);
    expect(all.queries).toHaveLength(one.queries.length);
  });
});

describe("T024 — my-queue page-level duration query count (AC-011)", () => {
  it("pageSize 1 vs 10 yields identical duration-query counts (2)", async () => {
    const page1 = await getMyQueuePage(actorPage, { page: 1, pageSize: 1 });
    const page10 = await getMyQueuePage(actorPage, { page: 1, pageSize: 10 });
    expect(page1.rows).toHaveLength(1);
    expect(page10.rows).toHaveLength(10);

    // Exactly the page's data section: rows → one phaseDurationsByIds call.
    const atOne = await captureQueries(() =>
      phaseDurationsByIds(
        actorPage,
        page1.rows.map((row) => row.workItemId),
      ),
    );
    const atTen = await captureQueries(() =>
      phaseDurationsByIds(
        actorPage,
        page10.rows.map((row) => row.workItemId),
      ),
    );

    expect(atOne.queries).toHaveLength(2);
    expect(atTen.queries).toHaveLength(2);
    expect(atTen.queries).toHaveLength(atOne.queries.length);
  });

  it("the page issues one batch call over its rows instead of a per-row loop (source)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/app/(shell)/my-queue/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/phaseDurationsByIds\(\s*actor,/);
    expect(src).toMatch(/await Promise\.all\(\[\s*getMyQueuePage\(/); // outer pairing kept
    // The old per-row loop is gone.
    expect(src).not.toMatch(/phaseDurations\(actor,\s*row\.workItemId\)/);
    expect(src).not.toMatch(/rows\.map\(\s*async/);
  });
});
