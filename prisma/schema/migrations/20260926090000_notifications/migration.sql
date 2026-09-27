-- 053-notifications — additive migration (tasks.md T007).
--
-- Contents (specs/053-notifications/data-model.md):
--   1. DeliveryStatus / NotificationSeverity / DelayPhase / SchedulerOutcome enums.
--   2. Six new tables: Notification, NotificationTypeOverride, DelayThreshold,
--      DelayBreach, SchedulerRun, SchedulerLease — plus indexes and FKs.
--   3. 002's NotificationEvent: retype the reserved `deliveryStatus` from
--      String to the DeliveryStatus enum, add the four 053-only columns, and
--      *** BACKFILL NULL -> PENDING *** before adding the claim index.
--   4. CHECK (thresholdMinutes IS NULL OR thresholdMinutes > 0) — defence in
--      depth alongside the Zod validation on the write path (FR/US5 sc. 5).
--   5. Five seeded DelayThreshold rows (Clarification defaults) and the single
--      SchedulerLease row.
--
-- Replay-safe: IF NOT EXISTS / guarded DO blocks; re-run is a no-op.

-- --- 1. Enums ---------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'UNMAPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'ACTION', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DelayPhase" AS ENUM ('DESIGN', 'REVIEW', 'PRICING', 'PRODUCTION', 'COLLECTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SchedulerOutcome" AS ENUM ('RUNNING', 'OK', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- 2. Tables --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkHref" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "severity" "NotificationSeverity" NOT NULL,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- The idempotency boundary (FR-007, SC-002). A second insert for the same
-- (event, user) fails at the DATABASE, not because application code was
-- careful — which is the whole point (research.md §1).
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_sourceEventId_userId_key"
    ON "Notification"("sourceEventId", "userId");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_createdAt_idx"
    ON "Notification"("userId", "readAt", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_userId_type_createdAt_idx"
    ON "Notification"("userId", "type", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_sourceEventId_idx"
    ON "Notification"("sourceEventId");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx"
    ON "Notification"("userId");

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sourceEventId_fkey"
    FOREIGN KEY ("sourceEventId") REFERENCES "NotificationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "NotificationTypeOverride" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "departmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationTypeOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationTypeOverride_type_key"
    ON "NotificationTypeOverride"("type");

DO $$ BEGIN
  ALTER TABLE "NotificationTypeOverride" ADD CONSTRAINT "NotificationTypeOverride_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DelayThreshold" (
    "id" TEXT NOT NULL,
    "phase" "DelayPhase" NOT NULL,
    "thresholdMinutes" INTEGER,
    "alertRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alertPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alertDepartmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "escalationMinutes" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DelayThreshold_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DelayThreshold_phase_key" ON "DelayThreshold"("phase");

-- Defence in depth: Zod already refuses a non-positive threshold at the write
-- path, and the database refuses it too, so a future direct-SQL write cannot
-- produce a phase that alerts instantly (FR/US5 scenario 5).
DO $$ BEGIN
  ALTER TABLE "DelayThreshold" ADD CONSTRAINT "DelayThreshold_thresholdMinutes_check"
    CHECK ("thresholdMinutes" IS NULL OR "thresholdMinutes" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DelayThreshold" ADD CONSTRAINT "DelayThreshold_escalationMinutes_check"
    CHECK ("escalationMinutes" IS NULL OR "thresholdMinutes" IS NULL OR "escalationMinutes" > "thresholdMinutes");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DelayThreshold" ADD CONSTRAINT "DelayThreshold_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DelayBreach" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "phase" "DelayPhase" NOT NULL,
    "breachSequence" INTEGER NOT NULL,
    "thresholdMinutes" INTEGER NOT NULL,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DelayBreach_pkey" PRIMARY KEY ("id")
);

-- Makes "one alert per breach, not one per tick" a schema property: the
-- scheduler's second tick over an unchanged breach attempts an insert that
-- already exists (SC-003, research.md §DelayBreach is a persisted fact).
CREATE UNIQUE INDEX IF NOT EXISTS "DelayBreach_workItemId_phase_breachSequence_key"
    ON "DelayBreach"("workItemId", "phase", "breachSequence");
CREATE INDEX IF NOT EXISTS "DelayBreach_workItemId_phase_idx"
    ON "DelayBreach"("workItemId", "phase");

DO $$ BEGIN
  ALTER TABLE "DelayBreach" ADD CONSTRAINT "DelayBreach_workItemId_fkey"
    FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SchedulerRun" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "outcome" "SchedulerOutcome" NOT NULL DEFAULT 'RUNNING',
    "evaluated" INTEGER NOT NULL DEFAULT 0,
    "flagged" INTEGER NOT NULL DEFAULT 0,
    "alerted" INTEGER NOT NULL DEFAULT 0,
    "escalated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    CONSTRAINT "SchedulerRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SchedulerRun_startedAt_idx" ON "SchedulerRun"("startedAt" DESC);

-- Deliberately has no `createdAt`/index shape of its own: exactly one row,
-- ever. This is a mutex, not a record.
CREATE TABLE IF NOT EXISTS "SchedulerLease" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchedulerLease_pkey" PRIMARY KEY ("id")
);

-- --- 3. 002's NotificationEvent ---------------------------------------------

-- Reuse 002's already-reserved columns rather than adding a parallel pair.
-- A-001: a second marker would leave 002's two columns permanently dead and
-- give one row TWO answers to "was this event delivered?".
ALTER TABLE "NotificationEvent" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "NotificationEvent" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "NotificationEvent" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
ALTER TABLE "NotificationEvent" ADD COLUMN IF NOT EXISTS "recipientPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- The retype. 002 shipped `deliveryStatus String?` and never wrote it, so
-- every existing row is NULL and this is a safe ALTER.
DO $$ BEGIN
  ALTER TABLE "NotificationEvent"
    ALTER COLUMN "deliveryStatus" TYPE "DeliveryStatus"
    USING ("deliveryStatus"::"DeliveryStatus");
EXCEPTION WHEN others THEN NULL; END $$;

-- *** THE LOAD-BEARING BACKFILL (A-001) ***
--
-- 002 never wrote deliveryStatus, so every row already in the outbox has it
-- NULL — and 012/013/014/015/016 are LIVE: their events are sitting in this
-- table right now. The processor's claim predicate is
--   `deliveredAt IS NULL AND deliveryStatus = 'PENDING'`
-- so without this UPDATE the predicate skips every one of them and the
-- feature ships looking healthy while delivering nothing for the very events
-- that motivated it (rejections, assignments). This MUST run before the
-- claim index below.
UPDATE "NotificationEvent"
   SET "deliveryStatus" = 'PENDING'
 WHERE "deliveryStatus" IS NULL;

-- The processor's claim query. Ordered createdAt so the batch is FIFO
-- (FR-009): an old event is never starved behind a newer flood.
CREATE INDEX IF NOT EXISTS "NotificationEvent_deliveredAt_deliveryStatus_createdAt_idx"
    ON "NotificationEvent"("deliveredAt", "deliveryStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationEvent_type_createdAt_idx"
    ON "NotificationEvent"("type", "createdAt");

-- --- 4. Seeds ---------------------------------------------------------------

-- Five thresholds, one row per phase, from the Clarification defaults
-- (4h / 1h / 2h / 8h / 24h). Mirrors config/053-notifications.yaml.
-- `updatedById` stays null: these are seeded rows, not Admin writes, and
-- claiming an editor would put a false actor in the audit trail.
DO $$ BEGIN
  INSERT INTO "DelayThreshold" (
    "id", "phase", "thresholdMinutes", "alertRoles", "alertPermissions",
    "alertDepartmentIds", "escalationMinutes", "updatedById"
  ) VALUES
    ('threshold-design',    'DESIGN',      240,  ARRAY['HEAD_DESIGNER'],
     ARRAY['design.work'],        ARRAY[]::TEXT[], NULL, NULL),
    ('threshold-review',    'REVIEW',      60,   ARRAY['HEAD_DESIGNER'],
     ARRAY['design.review'],      ARRAY[]::TEXT[], NULL, NULL),
    ('threshold-pricing',   'PRICING',     120,  ARRAY['ACCOUNTING','ADMIN_OWNER'],
     ARRAY['pricing.set_variable'], ARRAY[]::TEXT[], NULL, NULL),
    ('threshold-production','PRODUCTION',  480,  ARRAY['PRODUCTION_OPERATOR','HEAD_DESIGNER'],
     ARRAY['production.operate'],  ARRAY[]::TEXT[], NULL, NULL),
    ('threshold-collection','COLLECTION', 1440, ARRAY['PRINT_RECEPTION_DELIVERY','RECEPTION'],
     ARRAY['collection.receive'],  ARRAY[]::TEXT[], NULL, NULL);
EXCEPTION WHEN unique_violation THEN NULL; END $$;

-- The single lease row. Seeded already-expired so the first process to reach
-- runDelayTick() acquires it cleanly; without a row the first acquisition
-- would have to INSERT, which races.
DO $$ BEGIN
  INSERT INTO "SchedulerLease" ("id", "ownerId", "acquiredAt", "expiresAt")
  VALUES ('delay-scheduler', '', TIMESTAMP 'epoch', TIMESTAMP 'epoch');
EXCEPTION WHEN unique_violation THEN NULL; END $$;
