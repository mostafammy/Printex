// tests/helpers/queryCount.ts — T001 (092-performance), research Decision
// "Query-count tests capture Prisma `query` events at the `db` singleton
// through one shared helper".
//
// The instrumented client must REPLACE the app's `~/server/db` singleton:
// services import `db` from there, so a standalone instrumented client would
// capture zero SUT queries (the explicitly rejected alternative). Each test
// file therefore declares, file-scoped:
//
//   vi.mock("~/server/db", async () => {
//     const { dbMockFactory } = await import("../helpers/queryCount");
//     return dbMockFactory();
//   });
//
// Vitest isolates modules per test file, so this buffer is private to the
// file that mocked the singleton — `captureQueries` and the mocked `db`
// share one instance within that file. Seed fixtures with the
// UNinstrumented `tests/helpers/testDb.ts` BEFORE capturing: `testDb` is a
// separate client whose queries never touch this buffer.

import { PrismaClient } from "../../generated/prisma";

const buffer: string[] = [];

/** Clears every SQL string captured so far (also done by `captureQueries`). */
export function resetQueries(): void {
  buffer.length = 0;
}

/** Snapshot of the SQL strings captured so far (a copy — safe to assert on). */
export function queries(): string[] {
  return [...buffer];
}

/**
 * `vi.mock("~/server/db", …)` factory: the app singleton, swapped for a test
 * client bound to `DATABASE_URL_TEST` that appends every `query` event's SQL
 * to the shared buffer. Exported because `vi.mock` is file-scoped — each test
 * file must declare its own mock, but they all funnel through this factory.
 */
export function dbMockFactory(): { db: PrismaClient } {
  const db = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL_TEST,
    log: [{ emit: "event", level: "query" }],
  });
  db.$on("query", (event) => {
    buffer.push(event.query);
  });
  return { db };
}

/**
 * Resets the buffer, runs `fn`, and returns its result plus every SQL string
 * the mocked `db` executed while it ran.
 */
export async function captureQueries<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; queries: string[] }> {
  buffer.length = 0;
  const result = await fn();
  return { result, queries: [...buffer] };
}
