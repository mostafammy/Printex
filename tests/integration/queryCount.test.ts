// tests/integration/queryCount.test.ts — T001 smoke (092-performance).
//
// Proves the helper captures SUT queries through the MOCKED `~/server/db`
// singleton (not a standalone client): one awaited findMany must yield
// exactly one captured SQL string, and the buffer must be resettable.
// Requires the live test database (DATABASE_URL_TEST) — same as every other
// tests/integration file.

import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", async () => {
  const { dbMockFactory } = await import("../helpers/queryCount");
  return dbMockFactory();
});

import { db } from "~/server/db";
import { captureQueries, queries, resetQueries } from "../helpers/queryCount";

describe("queryCount helper (T001)", () => {
  it("captures exactly one query for one awaited findMany", async () => {
    const { result, queries: captured } = await captureQueries(() =>
      db.role.findMany({ take: 1 }),
    );

    expect(Array.isArray(result)).toBe(true);
    expect(captured).toHaveLength(1);
  });

  it("appends subsequent queries to the buffer until reset", async () => {
    resetQueries();
    await db.role.count();
    expect(queries().length).toBeGreaterThanOrEqual(1);

    resetQueries();
    expect(queries()).toHaveLength(0);
  });
});
