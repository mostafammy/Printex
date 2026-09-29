// tests/integration/shell-layout-queries.test.ts — T012 (092-performance, US2).
//
// AC-005 / PR-002: after the duplicate display read is deleted, the shell's
// per-navigation read shape is:
//   phase 1: getActor  → session (1) + RBAC user graph (1)   [request-cached]
//   phase 2: Promise.all(unreadCount, listNotifications)     (2 queries)
// = 4 queries, 2 sequential phases, ZERO queries that select only
// {name, username} of the current user.
//
// Functional core: getActorForSession resolves in EXACTLY one query through
// the mocked ~/server/db singleton (captureQueries). The layout-level
// session query runs through Better Auth's adapter on the same singleton;
// the layout structure itself is asserted at source level (redirect + two
// phases, no intermediate await of a display read).

import { afterAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("~/server/db", async () => {
  const { dbMockFactory } = await import("../helpers/queryCount");
  return dbMockFactory();
});

import { captureQueries } from "../helpers/queryCount";
import { testDb } from "../helpers/testDb";
import { getActorForSession } from "~/server/auth/getActor";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

describe("shell layout query shape (T012, AC-005)", () => {
  it("getActorForSession resolves in exactly ONE query — no display re-read (PR-002)", async () => {
    const id = unique("qshell");
    // Seed with the UNinstrumented client first — only the SUT's queries
    // through the mocked singleton are captured (queryCount.ts docs).
    await testDb.user.create({
      data: {
        id,
        name: "Query Count User",
        email: `${id}@example.test`,
        username: id,
      },
    });

    const { result, queries } = await captureQueries(() =>
      getActorForSession({
        userId: id,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );

    expect(result.userId).toBe(id);
    // One joined RBAC findUnique; name/username ride along inside it —
    // a second display-only query would make this 2.
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/SELECT/);
  });

  it("the layout is two phases with no display-user await between them (source structure)", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "src/app/(shell)/layout.tsx"),
      "utf8",
    );

    // No third user read anywhere in the layout (AC-005 duplicate = 0).
    expect(layout).not.toMatch(/user\.findUnique|findUnique\(\s*\{\s*where: \{ id: actor/);

    // Structure: getActor → bell pair in ONE Promise.all (phase 2).
    const getActorIdx = layout.indexOf("await getActor()");
    const promiseAllIdx = layout.indexOf("Promise.all([");
    expect(getActorIdx).toBeGreaterThan(-1);
    expect(promiseAllIdx).toBeGreaterThan(getActorIdx);

    // Between actor resolution and the bell pair there must be no other
    // `await db.` — the old duplicate read sat exactly there.
    const between = layout.slice(getActorIdx, promiseAllIdx);
    expect(between).not.toMatch(/await db\./);
    expect(between).not.toMatch(/await .*findUnique/);
  });

  it("layout notification pair stays parallel in one Promise.all (FR-011)", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "src/app/(shell)/layout.tsx"),
      "utf8",
    );
    const pairIdx = layout.indexOf("Promise.all([");
    const pair = layout.slice(pairIdx, layout.indexOf("]);", pairIdx));
    expect(pair).toContain("unreadCount(actor)");
    expect(pair).toContain("listNotifications(actor");
  });
});
