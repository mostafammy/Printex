-- Test-only reset of 053's tables. NOT part of the migration: this exists so a
-- developer can re-run the notification suite from a known state without
-- recreating the database, and so a failed run's breaches do not make the
-- next run's "alerts once" assertion pass or fail for the wrong reason.
--
-- Cascades clear the seeded DelayThreshold rows too, so re-seed them:
--   docker compose -f docker-compose.test.yml exec -T postgres psql -U postgres -d printex_test -f scripts/test-db-notifications-reset.sql
--   (the next test run recreates them via setThreshold, and the migration
--    re-seeds them on a real deploy)

TRUNCATE TABLE
  "notification",
  "notification_type_override",
  delay_breach,
  delay_threshold,
  scheduler_run,
  "NotificationEvent",
  "SchedulerLease"
CASCADE;
