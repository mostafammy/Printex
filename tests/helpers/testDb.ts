// Test-only Prisma client bound to `DATABASE_URL_TEST` (research.md §9,
// tasks.md T002) — never the app's `DATABASE_URL`/`DIRECT_URL`.
//
// Read directly from `process.env`, not `~/env`: `~/env`'s Zod schema also
// requires `STORAGE_ROOT` and Better Auth vars that a plain integration-test
// process has no business validating, and importing it would throw before
// any test even runs if those happen to be unset locally.

import { PrismaClient } from "../../generated/prisma";

export const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    "[tests/helpers/testDb] DATABASE_URL_TEST is not set. Integration tests that need a live " +
      "Postgres test database will fail to connect. Set DATABASE_URL_TEST (research.md §9) to " +
      "run them for real; CI's ci.yml already does.",
  );
}

export const testDb = new PrismaClient({
  datasourceUrl: DATABASE_URL_TEST ?? "postgresql://invalid:invalid@localhost:5/invalid",
});
