-- 093-order-production-workflow — additive schema for the frozen production
-- specification, finishing services, width exceptions and the accountant
-- approval that gates the printer.
--
-- ADDITIVE ONLY (constitution "destructive migrations on operational or audit
-- tables require explicit approval and a data-preservation plan"). Every
-- statement below is CREATE / ALTER-ADD. No column is dropped, renamed,
-- retyped or truncated; no existing row is updated except the one explicitly
-- backfilled and commented at the end.
--
-- Generated with `prisma migrate diff --from-schema-datasource --to-schema-datamodel`
-- and then hand-reviewed. The generated diff also proposed
--   DROP INDEX "Customer_normalizedName_trgm_idx";
-- which is DELIBERATELY OMITTED: that index is created by hand in
-- prisma/manual-sql/ (trigram extension), so it is invisible to the schema
-- diff and would be destroyed for no reason.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

CREATE TYPE "WidthExceptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ---------------------------------------------------------------------------
-- WorkItem: the frozen production specification snapshot (FR-001…FR-010).
--
-- All ten columns are NULLABLE on purpose. Existing Work Items have no
-- production specification yet, and forcing one would require inventing
-- history — exactly what SC-006 forbids. NULL means "never specified";
-- the pipeline guard treats NULL as "not ready for the printer".
-- ---------------------------------------------------------------------------

ALTER TABLE "WorkItem"
  ADD COLUMN "customerWidthCm"     DECIMAL(10,2),
  ADD COLUMN "productionWidthCm"   DECIMAL(10,2),
  ADD COLUMN "productionHeightM"   DECIMAL(10,2),
  ADD COLUMN "quantitySnapshot"    INTEGER,
  ADD COLUMN "productionAreaSqm"   DECIMAL(12,4),
  ADD COLUMN "baseRatePerSqm"      DECIMAL(12,2),
  ADD COLUMN "baseTotal"           DECIMAL(12,2),
  ADD COLUMN "finishingTotal"      DECIMAL(12,2),
  ADD COLUMN "productionTotal"     DECIMAL(12,2),
  ADD COLUMN "productionSpecAt"    TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Per-ProductType production constraints: the ordered width ladder, the
-- height ceiling, and the permitted EGP/m² band. Data, not code (constitution
-- VI). `ladderCm` is an INTEGER[] — see the model comment in core.prisma for
-- why this is a scalar list rather than a child table.
CREATE TABLE "ProductionWidthRule" (
    "id"            TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "ladderCm"      INTEGER[],
    "maxHeightM"    DECIMAL(10,2) NOT NULL,
    "minRatePerSqm" DECIMAL(12,2) NOT NULL,
    "maxRatePerSqm" DECIMAL(12,2) NOT NULL,
    "updatedById"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionWidthRule_pkey" PRIMARY KEY ("id")
);

-- An audited request to exceed the configured maximum width. Never a clamp
-- (FR-003); created once, then resolved by an explicit audited action.
CREATE TABLE "WidthExceptionTicket" (
    "id"               TEXT NOT NULL,
    "workItemId"       TEXT NOT NULL,
    "requestedWidthCm" DECIMAL(10,2) NOT NULL,
    "maxWidthCm"       DECIMAL(10,2) NOT NULL,
    "reason"           TEXT NOT NULL,
    "status"           "WidthExceptionStatus" NOT NULL DEFAULT 'PENDING',
    "raisedById"       TEXT NOT NULL,
    "resolvedById"     TEXT,
    "resolutionNote"   TEXT,
    "resolvedAt"       TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidthExceptionTicket_pkey" PRIMARY KEY ("id")
);

-- The accountant's sign-off. Its existence is exactly what the
-- `-> READY_FOR_PRODUCTION` guard checks (FR-014/FR-015).
CREATE TABLE "AccountingApproval" (
    "id"           TEXT NOT NULL,
    "workItemId"   TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "priceId"      TEXT,
    "totalAmount"  DECIMAL(12,2) NOT NULL,
    "note"         TEXT,
    "approvedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingApproval_pkey" PRIMARY KEY ("id")
);

-- Extensible per-m² finishing / add-on catalogue (FR-009). Same
-- effective-date + ACTIVE|RETIRED shape as 051's PriceList.
CREATE TABLE "FinishingService" (
    "id"            TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "labelAr"       TEXT NOT NULL,
    "ratePerSqm"    DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo"   TIMESTAMP(3),
    "status"        "PriceConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinishingService_pkey" PRIMARY KEY ("id")
);

-- One finishing selected on one Work Item with its rate and label FROZEN
-- (FR-010, SC-006). Strictly append-only: a re-price inserts a new
-- `generation` and leaves earlier rows untouched, so there is deliberately
-- NO unique constraint on (workItemId, finishingServiceId) — see the model
-- comment in pricing.prisma.
CREATE TABLE "WorkItemFinishing" (
    "id"                 TEXT NOT NULL,
    "workItemId"         TEXT NOT NULL,
    "finishingServiceId" TEXT NOT NULL,
    "generation"         INTEGER NOT NULL,
    "quotedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "labelSnapshot"      TEXT NOT NULL,
    "rateSnapshot"       DECIMAL(12,2) NOT NULL,
    "totalAmount"        DECIMAL(12,2) NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemFinishing_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "ProductionWidthRule_productTypeId_key" ON "ProductionWidthRule"("productTypeId");
CREATE INDEX "ProductionWidthRule_productTypeId_idx" ON "ProductionWidthRule"("productTypeId");

CREATE INDEX "WidthExceptionTicket_status_createdAt_idx" ON "WidthExceptionTicket"("status", "createdAt");
CREATE INDEX "WidthExceptionTicket_workItemId_createdAt_idx" ON "WidthExceptionTicket"("workItemId", "createdAt");

CREATE INDEX "AccountingApproval_workItemId_approvedAt_idx" ON "AccountingApproval"("workItemId", "approvedAt");

CREATE UNIQUE INDEX "FinishingService_code_key" ON "FinishingService"("code");
CREATE INDEX "FinishingService_status_effectiveFrom_effectiveTo_idx" ON "FinishingService"("status", "effectiveFrom", "effectiveTo");

CREATE INDEX "WorkItemFinishing_workItemId_quotedAt_idx" ON "WorkItemFinishing"("workItemId", "quotedAt");

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE "ProductionWidthRule" ADD CONSTRAINT "ProductionWidthRule_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionWidthRule" ADD CONSTRAINT "ProductionWidthRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WidthExceptionTicket" ADD CONSTRAINT "WidthExceptionTicket_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WidthExceptionTicket" ADD CONSTRAINT "WidthExceptionTicket_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WidthExceptionTicket" ADD CONSTRAINT "WidthExceptionTicket_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountingApproval" ADD CONSTRAINT "AccountingApproval_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingApproval" ADD CONSTRAINT "AccountingApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinishingService" ADD CONSTRAINT "FinishingService_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkItemFinishing" ADD CONSTRAINT "WorkItemFinishing_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkItemFinishing" ADD CONSTRAINT "WorkItemFinishing_finishingServiceId_fkey" FOREIGN KEY ("finishingServiceId") REFERENCES "FinishingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
