// T072 / SC-012: performance smoke — the four numbers plan.md promises.
//
//   1. notification visible within 2s p95 after the event is recorded
//   2. bell (unreadCount) + first dropdown page < 500ms p95
//   3. getDelayedWorkItems first page < 500ms p95
//   4. the scheduler tick touches no more rows than the shop has open
//      Work Items (bounded work — no full-table scans)
//
// These are SMOKES, not benchmarks: the bounds are generous against a
// Windows-Docker Postgres whose round-trips are an order of magnitude above
// the LAN server this ships to. The failure each guards against is a class
// of mistake (an N+1, an unbounded scan, an accidentally synchronous
// delivery path), not a 20% regression.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  getDelayedWorkItems,
  listNotifications,
  processOutboxBatch,
  runDelayTick,
  startOutboxProcessor,
  stopOutboxProcessor,
  unreadCount,
} from "~/server/notifications";
import { recordOutboxEvent, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  stopOutboxProcessor();
  await testDb.$disconnect();
});

let perfUser: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  perfUser = await seedNotificationUser({ prefix: "perf-smoke", roleKeys: ["HEAD_DESIGNER"] });
});

/** p95 of a sample, nearest-rank. With small n this is effectively max. */
function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(index, 0)]!;
}

async function timed(fn: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}

describe("SC-012 performance smoke (T072)", () => {
  it("a recorded notification is visible within 2s (SC-012 #1)", async () => {
    // The live path: record → delivery loop → readable. No manual
    // processOutboxBatch, because the criterion is about the system as it
    // runs, not about being poked.
    const latencies: number[] = [];

    for (let i = 0; i < 5; i += 1) {
      const before = await unreadCount(perfUser);
      const started = Date.now();

      await recordOutboxEvent({
        type: "workitem.rejected",
        entityId: `perf-visible-${Date.now()}-${i}`,
        recipientUserIds: [perfUser.userId],
        payload: { assigneeId: perfUser.userId },
      });
      startOutboxProcessor({ processorIntervalMs: 100 });

      while ((await unreadCount(perfUser)) <= before && Date.now() - started < 5_000) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      latencies.push(Date.now() - started);
      stopOutboxProcessor();
    }

    expect(p95(latencies)).toBeLessThan(2_000);
  }, 60_000);

  it("bell count + first dropdown page are each under 500ms (SC-012 #2)", async () => {
    // Warm-up: the first query after idle pays connection setup; the
    // criterion is about steady-state page loads.
    await unreadCount(perfUser);
    await listNotifications(perfUser, { page: 1, pageSize: 10 });

    const counts: number[] = [];
    const pages: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      counts.push(await timed(() => unreadCount(perfUser)));
      pages.push(await timed(() => listNotifications(perfUser, { page: 1, pageSize: 10 })));
    }

    expect(p95(counts)).toBeLessThan(500);
    expect(p95(pages)).toBeLessThan(500);
  }, 60_000);

  it("getDelayedWorkItems first page is under 500ms (SC-012 #3)", async () => {
    await getDelayedWorkItems(perfUser, { page: 1 });

    const queries: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      queries.push(await timed(() => getDelayedWorkItems(perfUser, { page: 1 })));
    }
    expect(p95(queries)).toBeLessThan(500);
  }, 60_000);

  it("a tick does no more work than the shop's open Work Items (SC-012 #4)", async () => {
    const openCount = await testDb.workItem.count({
      where: { state: { notIn: ["DELIVERED", "COMPLETED", "CANCELLED"] } },
    });

    // Release the lease; the tick must be able to acquire it.
    await testDb.schedulerLease.upsert({
      where: { id: "delay-scheduler" },
      create: { id: "delay-scheduler", ownerId: "", acquiredAt: new Date(0), expiresAt: new Date(0) },
      update: { expiresAt: new Date(0) },
    });

    const start = Date.now();
    const result = await runDelayTick();
    const elapsed = Date.now() - start;

    expect(result.ran).toBe(true);
    // THE bounded-work assertion: `evaluated` is exactly the open set the
    // contract names — no full-table scan, no cartesian expansion. (It may
    // exceed `openCount` only by rows committed between the two counts.)
    expect(result.evaluated).toBeGreaterThanOrEqual(openCount);
    expect(result.evaluated - openCount).toBeLessThan(50);

    // Generous wall-clock smoke over the loop-free path: a tick that ever
    // became O(evaluate × open) would take minutes at shop scale, not
    // seconds — this bound only has to catch that class.
    expect(elapsed).toBeLessThan(30_000);
  }, 60_000);
});
