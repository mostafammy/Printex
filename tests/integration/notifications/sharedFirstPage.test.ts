// tests/integration/notifications/sharedFirstPage.test.ts — 092 T053
// (investigation §13#4, duplicate #4). On /notifications the shell layout
// bell and the page both read the same unfiltered first page; after the fix
// that is ONE read per request:
//
//   1. BEHAVIOR — with both real call sites' arguments, the shared path
//      issues exactly one Notification findMany (plus the total count and
//      the unread count it folds in), and both callers get exactly the rows
//      they got before (the bell's 10 = the page's first 10, page 1 = the
//      newest-first 20 from a direct DB query).
//   2. SOURCE — the memoized shared path exists in center.ts, and both call
//      sites' arguments land on it (layout {page:1,pageSize:10}, page.tsx
//      {page:1,pageSize:20}, both ≤ DEFAULT_PAGE_SIZE, unfiltered).
//
// Request-level memoization only: React `cache()`, no persistent caching.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", async () => {
  const { dbMockFactory } = await import("../../helpers/queryCount");
  return dbMockFactory();
});

// React's cache() is a passthrough outside the RSC runtime — the
// "react-server" export condition Vitest does not set — so dedupe would be
// unobservable here. This mock mirrors the react-server keying (per wrapped
// fn, then per argument) with a simple value key; our shared reads are keyed
// on a single userId string, which is exactly what is under test.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const stores = new WeakMap<object, Map<string, unknown>>();
  const memoize = <A extends unknown[], R>(fn: (...args: A) => R): ((...args: A) => R) =>
    (...args: A) => {
      let store = stores.get(fn);
      if (!store) {
        store = new Map<string, unknown>();
        stores.set(fn, store);
      }
      const key = JSON.stringify(
        args.map((arg) => (typeof arg === "object" && arg !== null ? "[object]" : arg)),
      );
      if (!store.has(key)) store.set(key, fn(...args));
      return store.get(key) as R;
    };
  return { ...actual, cache: memoize as typeof actual.cache };
});

import { captureQueries } from "../../helpers/queryCount";
import { testDb } from "../../helpers/testDb";
import { seedNotificationUser } from "../../helpers/notificationSeed";
import { listNotifications, unreadCount } from "~/server/notifications";

const TOTAL = 25;

afterAll(async () => {
  // Leave the shared test DB exactly as found: direct-inserted notifications
  // plus their (already PROCESSED) events.
  await testDb.notification.deleteMany({ where: { userId: { startsWith: "firstpage" } } });
  await testDb.notificationEvent.deleteMany({
    where: { entityId: { startsWith: "firstpage-entity" } },
  });
  await testDb.$disconnect();
}, 60_000);

let actor: Awaited<ReturnType<typeof seedNotificationUser>>;
let expectedIds: string[];

beforeAll(async () => {
  // Rerun hygiene — an earlier run of THIS file left PENDING outbox events
  // whose notifications were inserted directly; the processor later claims
  // them, hits the (sourceEventId,userId) unique constraint, and starves
  // other test files' batches. Sweep our own leftovers first.
  await testDb.notification.deleteMany({ where: { userId: { startsWith: "firstpage" } } });
  await testDb.notificationEvent.deleteMany({
    where: { entityId: { startsWith: "firstpage-entity" } },
  });

  actor = await seedNotificationUser({ prefix: "firstpage" });

  // Fixture rows never touch the mocked (query-capturing) client, and every
  // write is a createMany: one insert round-trip each against the remote
  // test database — 50 individual inserts tripped the 10s hook timeout.
  // Events are PROCESSED so no later processOutboxBatch ever claims one.
  const base = Date.now() - TOTAL * 60_000;
  await testDb.notificationEvent.createMany({
    data: Array.from({ length: TOTAL }, (_, i) => ({
      type: "workitem.assigned",
      entityType: "WorkItem",
      entityId: `firstpage-entity-${i}`,
      recipientUserIds: [actor.userId],
      recipientRoles: [] as string[],
      recipientDepartmentIds: [] as string[],
      deliveryStatus: "PROCESSED" as const,
      createdAt: new Date(base + i * 60_000),
    })),
  });
  const events = await testDb.notificationEvent.findMany({
    where: { entityId: { startsWith: "firstpage-entity-" } },
    select: { id: true, entityId: true },
  });
  const eventIdByIndex = new Map(
    events.map((event) => [Number(event.entityId.slice("firstpage-entity-".length)), event.id]),
  );

  expectedIds = [];
  const notifications: Array<{
    id: string;
    userId: string;
    sourceEventId: string;
    type: string;
    title: string;
    severity: "INFO";
    createdAt: Date;
  }> = [];
  for (let i = 0; i < TOTAL; i += 1) {
    const sourceEventId = eventIdByIndex.get(i);
    if (!sourceEventId) throw new Error(`missing fixture event ${i}`);
    const id = `fp_${actor.userId}_${i}`;
    notifications.push({
      id,
      userId: actor.userId,
      sourceEventId,
      type: "workitem.assigned",
      title: `T053 row ${i}`,
      severity: "INFO",
      createdAt: new Date(base + i * 60_000),
    });
    expectedIds.push(id);
  }
  await testDb.notification.createMany({ data: notifications });
  expectedIds.reverse(); // newest first — the query's order
}, 60_000);

describe("shared first-page read (T053 / §13#4)", () => {
  it("one findMany serves the bell's {page:1,pageSize:10} and the page's {page:1,pageSize:20}", async () => {
    const { result, queries } = await captureQueries(async () => {
      const bell = await listNotifications(actor, { page: 1, pageSize: 10 });
      const page = await listNotifications(actor, { page: 1, pageSize: 20 });
      const unread = await unreadCount(actor); // the layout's separate bell call
      return { bell, page, unread };
    });

    const notificationQueries = queries.filter((q) => q.includes('"notification"'));
    // findMany + total count + unread count — ONE page read, not two.
    expect(notificationQueries).toHaveLength(3);
    expect(notificationQueries.filter((q) => q.includes("LIMIT"))).toHaveLength(1);

    // Same rows as before: the page equals the newest-first 20 (FR-021).
    expect(result.page.rows.map((r) => r.id)).toEqual(expectedIds.slice(0, 20));
    // The bell's 10 are the first 10 of the same shared rows.
    expect(result.bell.rows).toEqual(result.page.rows.slice(0, 10));
    expect(result.bell.rows).toHaveLength(10);
    // Counts the old duplicated path computed twice, now once.
    expect(result.page.total).toBe(TOTAL);
    expect(result.bell.total).toBe(TOTAL);
    expect(result.page.unreadTotal).toBe(TOTAL);
    expect(result.unread).toBe(TOTAL);
    // next-page math still uses each caller's own pageSize (FR-021: 20/page).
    expect(result.page.nextPage).toBe(2);
    expect(result.bell.nextPage).toBe(2);
  });

  it("source: memoized shared path + both call sites land on it", async () => {
    const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

    const center = read("src/server/notifications/center.ts");
    expect(center).toMatch(/const readFirstPage = cache\(/);
    expect(center).toMatch(/filter\.read === undefined/);
    expect(center).toMatch(/pageSize <= DEFAULT_PAGE_SIZE/);
    expect(center).toMatch(/rows: first\.rows\.slice\(0, pageSize\)/);

    // Frozen call site: the layout bell's arguments.
    const layout = read("src/app/(shell)/layout.tsx");
    expect(layout).toContain("listNotifications(actor, { page: 1, pageSize: 10 })");

    // The page's default view is unfiltered page 1 at pageSize 20
    // (DEFAULT_PAGE_SIZE), so it hits the same shared read.
    const page = read("src/app/(shell)/notifications/page.tsx");
    expect(page).toMatch(/listNotifications\(actor, \{/);
    expect(page).toContain("pageSize: 20");
  });
});
