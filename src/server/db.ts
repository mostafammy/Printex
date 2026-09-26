import { env } from "~/env";
import { PrismaClient } from "../../generated/prisma";

// "query" logging prints every full SQL statement, including bind params —
// with the dataset currently in the shared dev DB (thousands of rows per
// table), a single batched `IN (...)` query can print thousands of
// parameters on one line and flood the console. Opt in with
// PRISMA_LOG_QUERIES=1 when you actually need to see the SQL.
const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? process.env.PRISMA_LOG_QUERIES === "1"
          ? ["query", "error", "warn"]
          : ["error", "warn"]
        : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
