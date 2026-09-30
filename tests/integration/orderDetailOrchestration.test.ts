// tests/integration/orderDetailOrchestration.test.ts — T018 (092-performance, US3).
//
// AC-008 / AC-009 / PR-004 + contracts/query-batching.md §5:
// 1. source — the creation-event read shares ONE Promise.all with
//    getOrderDetail (never sequenced after it), and assigneeRows +
//    reworkCounts are issued together;
// 2. source — no `await` inside a loop over `detail.workItems`; the per-item
//    `getEligibleDesigners` loop is replaced by `getEligibleDesignersBatch`;
// 3. query-capture — eligibility for a 5-item × 4-designer fixture costs
//    ≤ 10 queries, and the count stays CONSTANT on a second, larger fixture
//    (Clarifications Q4: the banned 3×5 = 15 per-item fan-out fails ≤ 10).
//
// Structure assertions fail until T020/T021. The query-capture runs the real
// batch loader through the T001 instrumented ~/server/db singleton (vi.mock
// factory pattern from tests/integration/shell-layout-queries.test.ts);
// fixtures seed via the uninstrumented tests/helpers/testDb.ts.

import { afterAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("~/server/db", async () => {
  const { dbMockFactory } = await import("../helpers/queryCount");
  return dbMockFactory();
});

import { captureQueries } from "../helpers/queryCount";
import { testDb } from "../helpers/testDb";
import { getEligibleDesignersBatch } from "~/server/designers/assignment";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

const pageSource = readFileSync(
  resolve(process.cwd(), "src/app/(shell)/orders/[orderId]/page.tsx"),
  "utf8",
);

/**
 * True when any `for … of detail.workItems` block in the page source
 * contains an `await` (AC-008 / PR-004: no per-item awaited reads).
 * Brace-matched from the loop header; braces inside the page's JSX are only
 * reached when a matching for-of exists, which is exactly what we're banning.
 */
function hasAwaitInsideWorkItemLoop(source: string): boolean {
  const re = /for\s*\([^)]*\bof\s+detail\.workItems[^)]*\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    for (let j = open; j < source.length; j++) {
      if (source[j] === "{") depth += 1;
      else if (source[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          if (/\bawait\b/.test(source.slice(match.index, j))) return true;
          break;
        }
      }
    }
  }
  return false;
}

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

async function createActor(permissions: Permission[]): Promise<Actor> {
  const actor: Actor = {
    userId: unique("orch-actor"),
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

/** One order (single customer) with `itemCount` assignable items + designers. */
async function seedFixture(
  prefix: string,
  itemCount: number,
  designerCount: number,
): Promise<{ actor: Actor; itemIds: string[] }> {
  const actor = await createActor(["workitem.assign_designer"]);
  for (let i = 0; i < designerCount; i++) {
    await createActor(["design.work"]);
  }

  const customer = await testDb.customer.create({ data: { name: unique(prefix) } });
  const order = await testDb.order.create({
    data: {
      customerId: customer.id,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: actor.userId,
    },
  });

  const itemIds: string[] = [];
  for (let i = 0; i < itemCount; i++) {
    const item = await testDb.workItem.create({
      data: { orderId: order.id, state: "NEW" },
    });
    itemIds.push(item.id);
  }
  return { actor, itemIds };
}

describe("order-detail orchestration (T018, AC-008 / AC-009 / PR-004)", () => {
  it("creation-event read shares one Promise.all with getOrderDetail — never sequenced after (source)", () => {
    const getOrderIdx = pageSource.indexOf("getOrderDetail(actor, orderId)");
    expect(getOrderIdx).toBeGreaterThan(-1);

    const allStart = pageSource.lastIndexOf("Promise.all([", getOrderIdx);
    expect(allStart).toBeGreaterThan(-1);
    const allEnd = pageSource.indexOf("]);", allStart);
    expect(allEnd).toBeGreaterThan(getOrderIdx);

    const block = pageSource.slice(allStart, allEnd);
    expect(block).toContain("getOrderDetail(actor, orderId)");
    expect(block).toContain("db.auditEvent.findFirst");

    // The old chained form is gone: detail no longer awaited on its own.
    expect(pageSource).not.toMatch(/await getOrderDetail\(actor, orderId\);/);
  });

  it("assigneeRows and reworkCounts are issued in ONE Promise.all (source)", () => {
    const reworkIdx = pageSource.indexOf("db.return.groupBy");
    expect(reworkIdx).toBeGreaterThan(-1);

    const allStart = pageSource.lastIndexOf("Promise.all([", reworkIdx);
    expect(allStart).toBeGreaterThan(-1);
    const block = pageSource.slice(allStart, pageSource.indexOf("]);", allStart));
    expect(block).toContain("db.workItem.findMany");
    expect(block).toContain("db.return.groupBy");
  });

  it("no await inside a loop over detail.workItems; eligibility goes through the batch loader (source)", () => {
    expect(hasAwaitInsideWorkItemLoop(pageSource)).toBe(false);
    expect(pageSource).not.toMatch(/await getEligibleDesigners\(/);
    expect(pageSource).toContain("getEligibleDesignersBatch(");
  });

  it("eligibility ≤ 10 queries on a 5×4 fixture and CONSTANT on a larger fixture (AC-009)", async () => {
    const small = await seedFixture("orch-5x4", 5, 4);
    const large = await seedFixture("orch-10x8", 10, 8);

    const { queries: smallQueries } = await captureQueries(() =>
      getEligibleDesignersBatch(small.actor, small.itemIds),
    );
    const { queries: largeQueries } = await captureQueries(() =>
      getEligibleDesignersBatch(large.actor, large.itemIds),
    );

    // Constant ceiling (Clarifications Q4) — the banned 3×5 = 15 per-item
    // fan-out fails this on the exact fixture AC-009 names.
    expect(smallQueries.length).toBeLessThanOrEqual(10);
    expect(largeQueries.length).toBeLessThanOrEqual(10);
    // Constant in W and D: 10×8 must cost exactly what 5×4 costs.
    expect(largeQueries.length).toBe(smallQueries.length);
    // research Decision: five set-based reads — findMany (IN), holders,
    // 2× groupBy, one $queryRaw DISTINCT ON — one customer per fixture.
    expect(smallQueries.length).toBe(5);
  });
});
