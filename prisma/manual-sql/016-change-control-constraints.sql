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
-- WHY SpecVersion USES A TRIGGER INSTEAD OF `REVOKE UPDATE` (deviates from the
-- audit_event precedent — verified empirically while applying T002/T005):
-- `WorkItem.currentSpecVersionId` and `ChangeRequest.{baseSpecVersionId,
-- resultingSpecVersionId}` all FOREIGN KEY REFERENCE "SpecVersion". Postgres's
-- own FK-enforcement trigger locks the referenced row with
-- `SELECT ... FOR KEY SHARE`, and `FOR KEY SHARE`/`FOR UPDATE` locking reads
-- require UPDATE privilege on the LOCKED table, not just SELECT (this is
-- documented Postgres behavior, distinct from an ordinary SELECT). `audit_event`
-- has no incoming foreign keys, so revoking its UPDATE privilege is harmless —
-- but doing the same to "SpecVersion" breaks every future INSERT/UPDATE of a
-- row that points at it (T005's backfill included: `permission denied for
-- table SpecVersion` on the FK-check lock, not on the write itself). A
-- `BEFORE UPDATE` trigger gives the identical append-only guarantee (any real
-- UPDATE statement against SpecVersion is rejected) without revoking the
-- table-level UPDATE privilege that FK row-locking depends on. DELETE has no
-- such locking requirement from referencing tables, so it stays a plain REVOKE.
-- LateCancellation has no incoming foreign keys (confirmed against
-- prisma/schema/*.prisma), so the audit_event-style REVOKE UPDATE, DELETE is
-- safe for it as originally written.
--
-- RE-APPLY AFTER EVERY `prisma db push`:
-- Because this project uses `prisma db push` rather than `prisma migrate`, schema
-- synchronization can drop or reset table-level privilege revocations/triggers and
-- does not declare partial unique indexes. Re-apply this script after every
-- `prisma db push`.
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
--   UPDATE "LateCancellation" SET "costNote" = 'tampered-test' WHERE false;
--   SQL
-- Postgres should respond: ERROR: permission denied for table SpecVersion is
-- append-only (constitution III) for the first statement, and ERROR:
-- permission denied for table LateCancellation for the second.

-- 1. Partial unique index: at most one PENDING ChangeRequest per WorkItem
CREATE UNIQUE INDEX IF NOT EXISTS "ChangeRequest_one_pending_per_work_item"
  ON "ChangeRequest" ("workItemId") WHERE status = 'PENDING';

-- 2a. SpecVersion append-only enforcement: DELETE is a plain revoke (safe — no
-- incoming FKs depend on DELETE privilege). UPDATE is blocked by trigger, not
-- REVOKE, so that FK-check row-locking from WorkItem/ChangeRequest keeps working.
REVOKE DELETE ON "SpecVersion" FROM CURRENT_USER;

CREATE OR REPLACE FUNCTION spec_version_forbid_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SpecVersion is append-only (constitution III): UPDATE is forbidden, id=%', OLD.id
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS spec_version_forbid_update ON "SpecVersion";
CREATE TRIGGER spec_version_forbid_update
  BEFORE UPDATE ON "SpecVersion"
  FOR EACH ROW EXECUTE FUNCTION spec_version_forbid_update();

-- 2b. LateCancellation append-only enforcement: nothing references it via FK,
-- so the plain audit_event-style revoke is safe here.
REVOKE UPDATE, DELETE ON "LateCancellation" FROM CURRENT_USER;
