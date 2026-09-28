// tests/integration/changes/approverQueue.test.ts
// The approver queue. tasks.md T044, spec FR-017, research §17.
//
// The test database is shared, so other pending requests may exist. This file
// creates its rows as URGENT (they sort first), asserts on them, and withdraws
// them afterwards so reruns start clean.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ count: 0 }));

vi.mock("~/server/db", async () => {
  const { PrismaClient } = await import("../../../generated/prisma");
  const db = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL_TEST,
    log: [{ emit: "event", level: "query" }],
  });
  db.$on("query", () => {
    queries.count += 1;
  });
  return { db };
});

import { testDb } from "../../helpers/testDb";
import { seedUser } from "../../helpers/seed";
import { listPendingChangeRequests } from "~/server/changes";
import { approverActor, createProductionItem, receptionActor } from "./productionFactory";

const ours: string[] = [];

beforeAll(async () => {
  const requesterId = await seedUser();
  // Five URGENT requests, created in a known order.
  for (let i = 0; i < 5; i++) {
    const item = await createProductionItem({ priority: "URGENT" });
    const base = await testDb.workItem.findUniqueOrThrow({ where: { id: item.workItemId } });
    const cr = await testDb.changeRequest.create({
      data: {
        workItemId: item.workItemId,
        baseSpecVersionId: base.currentSpecVersionId ?? "",
        proposedPatch: { quantity: 600 + i },
        requestReason: `queue ${i}`,
        requestedById: requesterId,
        createdAt: new Date(Date.now() - (5 - i) * 60_000),
      },
    });
    ours.push(cr.id);
  }
}, 120_000);

afterAll(async () => {
  await testDb.changeRequest.updateMany({
    where: { id: { in: ours }, status: "PENDING" },
    data: { status: "WITHDRAWN", decisionNote: "approverQueue.test cleanup", decidedAt: new Date() },
  });
  await testDb.$disconnect();
});

describe("T044 — approver queue", () => {
  it("requires change.approve", async () => {
    expect(await listPendingChangeRequests(receptionActor(await seedUser()), {})).toEqual({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("orders URGENT first then oldest first, and pages 2 + 2 + 1 through our rows", async () => {
    const approver = approverActor(await seedUser());
    const page1 = await listPendingChangeRequests(approver, { limit: 2 });
    if (!page1.ok) throw new Error(page1.error.code);
    expect(page1.data.rows.map((r) => r.changeRequestId)).toEqual(ours.slice(0, 2));
    expect(page1.data.nextCursor).toBe(ours[1]);

    const page2 = await listPendingChangeRequests(approver, { limit: 2, cursor: page1.data.nextCursor ?? "" });
    if (!page2.ok) throw new Error(page2.error.code);
    expect(page2.data.rows.map((r) => r.changeRequestId)).toEqual(ours.slice(2, 4));

    const page3 = await listPendingChangeRequests(approver, { limit: 2, cursor: page2.data.nextCursor ?? "" });
    if (!page3.ok) throw new Error(page3.error.code);
    expect(page3.data.rows[0]?.changeRequestId).toBe(ours[4]);

    const first = page1.data.rows[0];
    expect(first?.priority).toBe("URGENT");
    expect(first?.changedFields).toEqual(["quantity"]);
    expect(first?.orderNumber).toEqual(expect.any(Number));
  });

  it("a full walk ends with nextCursor null and never repeats a row", async () => {
    const approver = approverActor(await seedUser());
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let pages = 0; pages < 1_000; pages++) {
      const res = await listPendingChangeRequests(approver, { limit: 100, cursor });
      if (!res.ok) throw new Error(res.error.code);
      for (const row of res.data.rows) {
        expect(seen.has(row.changeRequestId)).toBe(false);
        seen.add(row.changeRequestId);
      }
      if (res.data.nextCursor === null) break;
      cursor = res.data.nextCursor;
    }
    for (const id of ours) expect(seen.has(id)).toBe(true);
  });

  it("excludes decided requests", async () => {
    const decided = ours[4] ?? "";
    await testDb.changeRequest.update({
      where: { id: decided },
      data: { status: "REJECTED", decidedAt: new Date(), decisionNote: "no" },
    });
    const res = await listPendingChangeRequests(approverActor(await seedUser()), { limit: 5 });
    if (!res.ok) throw new Error(res.error.code);
    expect(res.data.rows.map((r) => r.changeRequestId)).not.toContain(decided);
  });

  it("issues the same number of queries for 1 row as for 4 rows (no N+1)", async () => {
    const approver = approverActor(await seedUser());
    queries.count = 0;
    const one = await listPendingChangeRequests(approver, { limit: 1 });
    const forOne = queries.count;

    queries.count = 0;
    const four = await listPendingChangeRequests(approver, { limit: 4 });
    const forFour = queries.count;

    expect(one.ok && one.data.rows.length).toBe(1);
    expect(four.ok && four.data.rows.length).toBe(4);
    expect(forFour).toBe(forOne);
  });

  it("the (status, createdAt) index exists", async () => {
    const rows = await testDb.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'ChangeRequest'
    `;
    expect(rows.map((r) => r.indexname)).toContain("ChangeRequest_status_createdAt_idx");
  });
});
