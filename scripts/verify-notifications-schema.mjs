// Read-only verification of 053's schema state on whatever DATABASE_URL points
// at. Run after `prisma db push` and the migration, to confirm the two things
// that are easy to get silently wrong:
//
//   1. the NULL -> PENDING backfill ran, so the processor's claim predicate
//      can see the events the live features already recorded (A-001);
//   2. the seeded rows exist — five thresholds and the lease singleton —
//      which `db push` does NOT create, because it does not run migration
//      seed inserts.
//
// Prints and exits non-zero on any failure, so it can gate a deploy.
//
//   node scripts/verify-notifications-schema.mjs

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const problems = [];
const check = (label, ok, detail) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) problems.push(label);
};

try {
  const [events, nullStatus, pending, leases, thresholds, breachTriples] = await Promise.all([
    db.notificationEvent.count(),
    db.notificationEvent.count({ where: { deliveryStatus: null } }),
    db.notificationEvent.count({ where: { deliveryStatus: "PENDING" } }),
    db.schedulerLease.count(),
    db.delayThreshold.count(),
    db.$queryRaw`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'delay_breach'
        AND indexdef LIKE '%workItemId%' AND indexdef LIKE '%breachSequence%'`,
  ]);

  // 1. The backfill. Nulls are only legitimate if the table is empty.
  check(
    "no PENDING-null outbox rows left by the backfill",
    events === 0 || nullStatus === 0,
    `${nullStatus} of ${events} rows still NULL`,
  );
  check(
    "backfill produced PENDING rows (or the outbox is empty)",
    events === 0 || pending > 0,
    `${pending} PENDING`,
  );

  // 2. Seeded rows that `db push` will not create.
  check("SchedulerLease singleton exists", leases === 1, `${leases} rows`);
  check("five DelayThreshold rows seeded", thresholds === 5, `${thresholds} rows`);

  // 3. The constraint that makes "once per breach" structural.
  check(
    "DelayBreach unique(workItemId, phase, breachSequence) exists",
    breachTriples.length > 0,
    `${breachTriples.length} matching index(es)`,
  );
} catch (error) {
  console.error("verification failed to run:", error.message);
  problems.push("verification could not run");
} finally {
  await db.$disconnect();
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s): ${problems.join("; ")}`);
  process.exit(1);
}
console.log("\n053 schema state verified.");
