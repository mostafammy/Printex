-- 016-change-control: Backfill initial SpecVersion (v1) for existing Work Items
-- Data preservation & non-destructive migration plan (specs/016-change-control/data-model.md Step 3).
--
-- Apply manually AFTER T002 (db push) and T004 (constraints):
--   pnpm exec prisma db execute \
--     --file prisma/manual-sql/016-spec-version-backfill.sql \
--     --schema prisma/schema
--
-- Single atomic transaction:
-- 1. Inserts v1 for every Work Item that has no SpecVersion yet (deterministic id 'bf_' || id).
-- 2. Points WorkItem.currentSpecVersionId to the highest version (bypassing updatedAt).
-- 3. Records an audit_event row documenting the migration.

BEGIN;

-- 1. Insert v1 for unversioned Work Items
INSERT INTO "SpecVersion" (
  id,
  "workItemId",
  version,
  origin,
  "productTypeId",
  description,
  quantity,
  "widthValue",
  "heightValue",
  "dimensionUnit",
  material,
  "finishNotes",
  "stateAtCreation",
  reason,
  "createdById",
  "createdAt"
)
SELECT
  'bf_' || w.id,
  w.id,
  1,
  'BACKFILL',
  w."productTypeId",
  w.description,
  w.quantity,
  w."widthValue",
  w."heightValue",
  w."dimensionUnit",
  w.material,
  w."finishNotes",
  w.state,
  'Backfilled by 016-change-control from current values',
  NULL,
  now()
FROM "WorkItem" w
WHERE NOT EXISTS (
  SELECT 1 FROM "SpecVersion" s WHERE s."workItemId" = w.id
);

-- 2. Point every Work Item at its highest version (handles re-runs and self-healed items).
-- Does NOT touch "updatedAt" (raw SQL bypasses @updatedAt).
UPDATE "WorkItem" w
SET "currentSpecVersionId" = s.id
FROM "SpecVersion" s
WHERE s."workItemId" = w.id
  AND s.version = (SELECT max(version) FROM "SpecVersion" m WHERE m."workItemId" = w.id)
  AND w."currentSpecVersionId" IS DISTINCT FROM s.id;

-- 3. Record migration in audit log (AuditEvent is @@map("audit_event") in identity.prisma).
INSERT INTO "audit_event" (
  id,
  action,
  "entityType",
  "entityId",
  "actorId",
  after,
  "attachmentIds",
  "createdAt"
)
SELECT
  'bf_audit_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'),
  'spec_version.backfilled',
  'Migration',
  '016-change-control',
  NULL,
  jsonb_build_object('backfilled', (SELECT count(*) FROM "SpecVersion" WHERE origin = 'BACKFILL')),
  '{}'::text[],
  now();

COMMIT;

-- ---------------------------------------------------------------------------
-- Step 4: Verification (must return zero rows):
-- ---------------------------------------------------------------------------
-- (a) every Work Item has a current version:
-- SELECT id FROM "WorkItem" WHERE "currentSpecVersionId" IS NULL;
--
-- (b) mirror columns equal the current version:
-- SELECT w.id FROM "WorkItem" w JOIN "SpecVersion" s ON s.id = w."currentSpecVersionId"
-- WHERE (w."productTypeId", w.description, w.quantity, w."widthValue", w."heightValue",
--        w."dimensionUnit", w.material, w."finishNotes")
--   IS DISTINCT FROM
--       (s."productTypeId", s.description, s.quantity, s."widthValue", s."heightValue",
--        s."dimensionUnit", s.material, s."finishNotes");
--
-- (c) exactly N backfilled-or-initial v1 rows:
-- SELECT count(*) FROM "SpecVersion" WHERE version = 1;  -- must equal N
