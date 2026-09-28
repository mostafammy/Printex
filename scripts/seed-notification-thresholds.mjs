// Seeds 053's five DelayThreshold rows and the SchedulerLease singleton.
//
// WHY A SCRIPT AND NOT ONLY THE MIGRATION: `prisma db push` does not run
// migration seed inserts, so a database provisioned that way has 053's tables
// but no thresholds — and the scheduler would then alert nothing while
// `schedulerStatus()` reported every phase as disabled. This script is the
// idempotent, re-runnable path for that case, and it is the same data the
// migration carries, so the two cannot drift (they are asserted equal by the
// verification script's row-count check).
//
// Idempotent: re-running updates the thresholds and never duplicates them.
//
//   node scripts/seed-notification-thresholds.mjs

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

/** The Clarification defaults: design 4h, review 1h, pricing 2h, production 8h, collection 24h. */
const THRESHOLDS = [
  {
    phase: "DESIGN",
    thresholdMinutes: 240,
    alertRoles: ["HEAD_DESIGNER"],
    alertPermissions: ["design.work"],
  },
  {
    phase: "REVIEW",
    thresholdMinutes: 60,
    alertRoles: ["HEAD_DESIGNER"],
    alertPermissions: ["design.review"],
  },
  {
    phase: "PRICING",
    thresholdMinutes: 120,
    alertRoles: ["ACCOUNTING", "ADMIN_OWNER"],
    alertPermissions: ["pricing.set_variable"],
  },
  {
    phase: "PRODUCTION",
    thresholdMinutes: 480,
    alertRoles: ["PRODUCTION_OPERATOR", "HEAD_DESIGNER"],
    alertPermissions: ["production.operate"],
  },
  {
    phase: "COLLECTION",
    thresholdMinutes: 1440,
    alertRoles: ["PRINT_RECEPTION_DELIVERY", "RECEPTION"],
    alertPermissions: ["collection.receive"],
  },
];

try {
  for (const threshold of THRESHOLDS) {
    const { phase, thresholdMinutes, alertRoles, alertPermissions } = threshold;
    await db.delayThreshold.upsert({
      where: { phase },
      create: {
        phase,
        thresholdMinutes,
        alertRoles,
        alertPermissions,
        alertDepartmentIds: [],
        escalationMinutes: null,
        // `updatedById` stays null: these are seeded rows, not Admin writes,
        // and claiming an editor would put a false actor in the audit trail.
        updatedById: null,
      },
      // Only the seed's own values are forced. An Admin's edit is not
      // overwritten by re-running this — `thresholdMinutes` IS, deliberately,
      // because a re-seed is an explicit request to restore the defaults.
      update: { thresholdMinutes, alertRoles, alertPermissions, escalationMinutes: null },
    });
    console.log(`ok    ${phase}: ${thresholdMinutes} min -> ${alertRoles.join(", ")}`);
  }

  // Seeded already-expired so the first process to tick acquires it cleanly.
  const lease = await db.schedulerLease.upsert({
    where: { id: "delay-scheduler" },
    create: {
      id: "delay-scheduler",
      ownerId: "",
      acquiredAt: new Date(0),
      expiresAt: new Date(0),
    },
    update: {},
  });
  console.log(`ok    SchedulerLease ${lease.id} (expires ${lease.expiresAt.toISOString()})`);

  // The claim predicate's other half: an outbox row recorded before 053
  // existed has deliveryStatus NULL, and the processor would skip it. Idempotent
  // and safe to re-run, because it only ever moves NULL -> PENDING.
  const { count } = await db.notificationEvent.updateMany({
    where: { deliveryStatus: null },
    data: { deliveryStatus: "PENDING" },
  });
  console.log(`ok    backfilled ${count} outbox row(s) NULL -> PENDING`);
} catch (error) {
  console.error("seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
