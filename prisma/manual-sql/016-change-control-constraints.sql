-- Enforces constitution III / spec FR-012, FR-024, data-model.md Step 2:
-- 1. At most one PENDING ChangeRequest per WorkItem (partial unique index).
-- 2. No application code path or direct SQL client may ever UPDATE or DELETE
--    a SpecVersion or LateCancellation row (append-only history).
--
-- DEPLOYMENT PREREQUISITE (research.md §"Database-level append-only enforcement"):
-- The REVOKE statements only bind if the Postgres role that runs migrations (and
-- that the application connects as at runtime) is a NON-SUPERUSER role. A superuser
-- bypasses all GRANT/REVOKE controls. If your DATABASE_URL connects as a
-- superuser, this statement will appear to succeed but will have no effect.
--
-- RE-APPLY AFTER EVERY `prisma db push`:
-- Because this project uses `prisma db push` rather than `prisma migrate`, schema
-- synchronization can drop or reset table-level privilege revocations and does not
-- declare partial unique indexes. Re-apply this script after every `prisma db push`.
--
-- Apply manually once T002 is unblocked:
--   pnpm exec prisma db execute \
--     --file prisma/manual-sql/016-change-control-constraints.sql \
--     --schema prisma/schema
--
-- CURRENT_USER inside a migration/db-execute context resolves to whichever
-- role Postgres is running the statement as — i.e. the role embedded in
-- DATABASE_URL / DIRECT_URL. This is the correct target for the REVOKE: the same
-- role the application uses at runtime is the one that must lose UPDATE/DELETE.
--
-- After applying, verify empirically:
--   pnpm exec prisma db execute --stdin --schema prisma/schema <<'SQL'
--   UPDATE "SpecVersion" SET reason = 'tampered-test' WHERE false;
--   SQL
-- Postgres should respond: ERROR: permission denied for table SpecVersion

-- 1. Partial unique index: at most one PENDING ChangeRequest per WorkItem
CREATE UNIQUE INDEX IF NOT EXISTS "ChangeRequest_one_pending_per_work_item"
  ON "ChangeRequest" ("workItemId") WHERE status = 'PENDING';

-- 2. Append-only enforcement: revoke UPDATE and DELETE
REVOKE UPDATE, DELETE ON "SpecVersion" FROM CURRENT_USER;
REVOKE UPDATE, DELETE ON "LateCancellation" FROM CURRENT_USER;
