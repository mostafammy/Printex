-- 092-performance T037 — conditional nav-path index DDL (spec DB-003, DB-005).
-- Gated on specs/092-performance/db-verification.md (compiled 2026-09-30), which
-- proved on the verified (test/dev) database:
--   R1 WorkItem_state_createdAt_id_idx      MISSING
--   R2 Notification_userId_archivedAt_createdAt_idx MISSING
--   R3 audit_event_entityId_action_createdAt_idx     MISSING
--   FileObject_sha256_idx PRESENT as exact duplicate of unique FileObject_sha256_key
-- Write-cost notes (DB-005, investigation §9):
--   R1 Moderate — state churns on every transition, narrow columns, user-paced.
--   R2 Low — per-user, archival rare.
--   R3 Moderate — hottest write table, 3 narrow columns, no FK compounding.
--   drop — free win; the unique FileObject_sha256_key keeps enforcement.
-- Replay-safe: IF NOT EXISTS / IF EXISTS guards; re-run is a no-op.

-- R1: board lane filter (state) + ORDER BY createdAt, id — eliminates full sort.
CREATE INDEX IF NOT EXISTS "WorkItem_state_createdAt_id_idx" ON "WorkItem" ("state", "createdAt", "id");

-- R2: bell list (userId + archivedAt IS NULL) ORDER BY createdAt DESC.
CREATE INDEX IF NOT EXISTS "Notification_userId_archivedAt_createdAt_idx" ON "notification" ("userId", "archivedAt", "createdAt" DESC);

-- R3: order-detail audit probe (entityId + action) ORDER BY createdAt ASC.
CREATE INDEX IF NOT EXISTS "audit_event_entityId_action_createdAt_idx" ON "audit_event" ("entityId", "action", "createdAt");

-- Drop duplicate non-unique sha256 index; keep unique FileObject_sha256_key.
DROP INDEX IF EXISTS "FileObject_sha256_idx";
