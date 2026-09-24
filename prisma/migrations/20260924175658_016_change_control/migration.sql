-- 016 · Order Change Control — additive schema only.
--
-- `prisma migrate diff` against the live shared dev DB also proposed dropping
-- Attachment/FileAsset/FileAuditEvent/FileConfig/FileObject/FileVersion and
-- their enums (AttachmentKind/AuditAction/AuditEntity/FileCategory/
-- FileLifecycleStatus). Those belong to spec 050-files, which was pushed to
-- this shared DB previously but never merged into main's schema (no current
-- schema file defines them; current code uses ReturnAttachment instead).
-- They are intentionally left untouched here — this migration is scoped to
-- 016 only. Cleaning up that drift is 050-files' concern, not 016's.

-- CreateEnum
CREATE TYPE "SpecVersionOrigin" AS ENUM ('INITIAL', 'BACKFILL', 'DIRECT_EDIT', 'CHANGE_REQUEST', 'ADMIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CLOSED_BY_CANCELLATION');

-- CreateEnum
CREATE TYPE "ChangeRequestOutcome" AS ENUM ('CONTINUE_PRODUCTION', 'REDESIGN');

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN     "currentSpecVersionId" TEXT;

-- CreateTable
CREATE TABLE "SpecVersion" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "origin" "SpecVersionOrigin" NOT NULL,
    "productTypeId" TEXT,
    "description" TEXT,
    "quantity" INTEGER,
    "widthValue" DECIMAL(10,2),
    "heightValue" DECIMAL(10,2),
    "dimensionUnit" "WorkItemDimensionUnit",
    "material" TEXT,
    "finishNotes" TEXT,
    "stateAtCreation" "WorkItemState" NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "baseSpecVersionId" TEXT NOT NULL,
    "proposedPatch" JSONB NOT NULL,
    "requestReason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedRunningTimerAt" TIMESTAMP(3),
    "isAdminOverride" BOOLEAN NOT NULL DEFAULT false,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "outcome" "ChangeRequestOutcome",
    "resultingSpecVersionId" TEXT,
    "returnId" TEXT,
    "productionAcknowledgedAt" TIMESTAMP(3),
    "productionAcknowledgedById" TEXT,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LateCancellation" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "stateAtCancellation" "WorkItemState" NOT NULL,
    "reason" TEXT NOT NULL,
    "costIncurred" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "producedQuantitySoFar" INTEGER,
    "costNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LateCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpecVersion_workItemId_version_key" ON "SpecVersion"("workItemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeRequest_resultingSpecVersionId_key" ON "ChangeRequest"("resultingSpecVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeRequest_returnId_key" ON "ChangeRequest"("returnId");

-- CreateIndex
CREATE INDEX "ChangeRequest_workItemId_status_idx" ON "ChangeRequest"("workItemId", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_status_createdAt_idx" ON "ChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LateCancellation_workItemId_key" ON "LateCancellation"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_currentSpecVersionId_key" ON "WorkItem"("currentSpecVersionId");

-- AddForeignKey
ALTER TABLE "SpecVersion" ADD CONSTRAINT "SpecVersion_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecVersion" ADD CONSTRAINT "SpecVersion_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecVersion" ADD CONSTRAINT "SpecVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_baseSpecVersionId_fkey" FOREIGN KEY ("baseSpecVersionId") REFERENCES "SpecVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_resultingSpecVersionId_fkey" FOREIGN KEY ("resultingSpecVersionId") REFERENCES "SpecVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_productionAcknowledgedById_fkey" FOREIGN KEY ("productionAcknowledgedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateCancellation" ADD CONSTRAINT "LateCancellation_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateCancellation" ADD CONSTRAINT "LateCancellation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_currentSpecVersionId_fkey" FOREIGN KEY ("currentSpecVersionId") REFERENCES "SpecVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
