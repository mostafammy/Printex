-- Test-only reset of 053's tables. NOT part of the migration: this exists so a
-- developer can re-run the notification suite from a known state without
-- recreating the database, and so a failed run's breaches do not make the
-- next run's "alerts once" assertion pass or fail for the wrong reason.
--
-- Re-seeds the five DelayThreshold rows after truncating them, so the table
-- matches what the migration leaves behind on a real deploy. Without this,
-- `prisma db push` (which the test database uses, and which does NOT run
-- migration seed inserts) plus this truncate would leave zero thresholds —
-- `verify-notifications-schema.mjs` expects five, and tests that audit an
-- edit's `before` snapshot need a prior row to read.

-- The FIXTURE GRAPH, not just 053's tables. Every integration test creates
-- Work Items through Orders and Customers and nothing ever deletes them, so
-- the graph grows across runs; the first delay tick after a reset then
-- re-breaches every one of them, which timed out the suite at 20s per tick.
-- CASCADE follows the FK edges downstream (Order, WorkItem, PhaseTiming,
-- DelayBreach, transitions, pricing rows …). User/Role and the seed survive:
-- nothing points away from User, so it is never pulled in.
TRUNCATE TABLE "Customer" CASCADE;

TRUNCATE TABLE
  "notification",
  "notification_type_override",
  delay_breach,
  delay_threshold,
  scheduler_run,
  "NotificationEvent",
  "SchedulerLease"
CASCADE;

INSERT INTO "delay_threshold" (
  "id", "phase", "thresholdMinutes", "alertRoles", "alertPermissions",
  "alertDepartmentIds", "escalationMinutes", "updatedById", "updatedAt"
) VALUES
  ('threshold-design',    'DESIGN',      240,  ARRAY['HEAD_DESIGNER'],
   ARRAY['design.work'],          ARRAY[]::TEXT[], NULL, NULL, CURRENT_TIMESTAMP),
  ('threshold-review',    'REVIEW',      60,   ARRAY['HEAD_DESIGNER'],
   ARRAY['design.review'],        ARRAY[]::TEXT[], NULL, NULL, CURRENT_TIMESTAMP),
  ('threshold-pricing',   'PRICING',     120,  ARRAY['ACCOUNTING','ADMIN_OWNER'],
   ARRAY['pricing.set_variable'], ARRAY[]::TEXT[], NULL, NULL, CURRENT_TIMESTAMP),
  ('threshold-production','PRODUCTION',  480,  ARRAY['PRODUCTION_OPERATOR','HEAD_DESIGNER'],
   ARRAY['production.operate'],   ARRAY[]::TEXT[], NULL, NULL, CURRENT_TIMESTAMP),
  ('threshold-collection','COLLECTION', 1440, ARRAY['PRINT_RECEPTION_DELIVERY','RECEPTION'],
   ARRAY['collection.receive'],   ARRAY[]::TEXT[], NULL, NULL, CURRENT_TIMESTAMP);

-- The lease singleton, seeded already-expired as the migration does.
INSERT INTO "SchedulerLease" ("id", "ownerId", "acquiredAt", "expiresAt")
VALUES ('delay-scheduler', '', TIMESTAMP 'epoch', TIMESTAMP 'epoch')
ON CONFLICT ("id") DO NOTHING;
