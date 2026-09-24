-- One-time correction for a dev DB that already had the old, broken
-- `REVOKE UPDATE ON "SpecVersion"` applied (see 016-change-control-constraints.sql
-- for why it's wrong). Restores UPDATE so FK row-locking from WorkItem/
-- ChangeRequest works again; the corrected constraints script then adds the
-- trigger-based enforcement in its place. Safe to re-run.
GRANT UPDATE ON "SpecVersion" TO CURRENT_USER;
