-- CreateEnum
CREATE TYPE "WorkItemState" AS ENUM ('NEW', 'ASSIGNED', 'IN_DESIGN', 'DESIGN_COMPLETED', 'WAITING_REVIEW', 'REWORK_REQUIRED', 'APPROVED', 'WAITING_PRICING', 'READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'READY_FOR_COLLECTION', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WALK_IN', 'WHATSAPP', 'PHONE', 'RETURNING', 'DIRECT_TO_DESIGNER');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "OrderMode" AS ENUM ('GROUPED', 'SEPARATE');

-- CreateEnum
CREATE TYPE "PhaseTimingKind" AS ENUM ('QUEUE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "RejectionCategory" AS ENUM ('DESIGN_ISSUE', 'DIMENSION_ISSUE', 'CUSTOMER_CHANGE', 'PRICING_ISSUE', 'ACCOUNTING_ISSUE', 'PRODUCTION_ISSUE', 'MISSING_INFORMATION', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkItemDimensionUnit" AS ENUM ('MM', 'CM', 'M', 'IN');

-- CreateEnum
CREATE TYPE "ReturnAttachmentKind" AS ENUM ('VOICE_NOTE', 'IMAGE', 'FILE');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('ORIGINAL', 'DESIGN_VERSIONS', 'REVIEW_PROOF', 'APPROVED', 'PRODUCTION', 'SUPPORTING');

-- CreateEnum
CREATE TYPE "FileLifecycleStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'VOID', 'ARCHIVED', 'CORRUPTED');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('VOICE_NOTE', 'IMAGE', 'FILE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'APPROVE', 'VOID', 'ARCHIVE', 'SUPERSEDE');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('FILE_OBJECT', 'FILE_ASSET', 'FILE_VERSION', 'ATTACHMENT');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isExternalProduction" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL DEFAULT '',
    "nationalId" TEXT,
    "notes" TEXT,
    "isCashCustomer" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "classificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "priority" "OrderPriority" NOT NULL,
    "mode" "OrderMode" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productTypeId" TEXT,
    "departmentId" TEXT,
    "state" "WorkItemState" NOT NULL,
    "requiresDesign" BOOLEAN NOT NULL DEFAULT true,
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "assigneeId" TEXT,
    "description" TEXT,
    "quantity" INTEGER,
    "widthValue" DECIMAL(10,2),
    "heightValue" DECIMAL(10,2),
    "dimensionUnit" "WorkItemDimensionUnit",
    "material" TEXT,
    "finishNotes" TEXT,
    "dueDate" TIMESTAMP(3),
    "producedQuantity" INTEGER,
    "productionNotes" TEXT,
    "pendingFileRevisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDepartmentId" TEXT,
    "defaultRequiresDesign" BOOLEAN NOT NULL DEFAULT true,
    "defaultRequiresReview" BOOLEAN NOT NULL DEFAULT true,
    "pricingModeHint" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemTransition" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "from" "WorkItemState" NOT NULL,
    "to" "WorkItemState" NOT NULL,
    "actorId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "rejectionCategory" "RejectionCategory",
    "meta" JSONB,

    CONSTRAINT "WorkItemTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseTiming" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "phase" "WorkItemState" NOT NULL,
    "userId" TEXT,
    "kind" "PhaseTimingKind" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PhaseTiming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignVersion" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "note" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "DesignVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "originDepartmentId" TEXT NOT NULL,
    "category" "RejectionCategory" NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "note" TEXT,
    "designVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnAttachment" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "kind" "ReturnAttachmentKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorProductionRecord" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,

    CONSTRAINT "VendorProductionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "recipientUserIds" TEXT[],
    "recipientRoles" TEXT[],
    "recipientDepartmentIds" TEXT[],
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "deliveryStatus" TEXT,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPhone" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerClassification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPromotion" (
    "id" TEXT NOT NULL,
    "sourceCustomerId" TEXT NOT NULL,
    "targetCustomerId" TEXT NOT NULL,
    "orderIds" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,

    CONSTRAINT "CustomerPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "category" "FileCategory" NOT NULL,
    "logicalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileVersion" (
    "id" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "fileObjectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "note" TEXT,
    "status" "FileLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "fileObjectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "FileLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" "AuditEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeValues" JSONB,
    "afterValues" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileConfig" (
    "id" TEXT NOT NULL DEFAULT 'files-config',
    "mimeAllowlist" JSONB NOT NULL,
    "maxFileSizeBytes" INTEGER NOT NULL,
    "departments" JSONB NOT NULL,
    "previewExpirySeconds" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "FileConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT NOT NULL,
    "displayUsername" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_department" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "user_department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "attachmentIds" TEXT[],
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Customer_normalizedName_idx" ON "Customer"("normalizedName");

-- CreateIndex
CREATE INDEX "Customer_isArchived_idx" ON "Customer"("isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "WorkItem_orderId_state_idx" ON "WorkItem"("orderId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_name_key" ON "ProductType"("name");

-- CreateIndex
CREATE INDEX "WorkItemTransition_workItemId_at_idx" ON "WorkItemTransition"("workItemId", "at");

-- CreateIndex
CREATE INDEX "PhaseTiming_workItemId_phase_kind_idx" ON "PhaseTiming"("workItemId", "phase", "kind");

-- CreateIndex
CREATE INDEX "DesignVersion_workItemId_createdAt_idx" ON "DesignVersion"("workItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DesignVersion_workItemId_version_key" ON "DesignVersion"("workItemId", "version");

-- CreateIndex
CREATE INDEX "Return_workItemId_createdAt_idx" ON "Return"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnAttachment_returnId_idx" ON "ReturnAttachment"("returnId");

-- CreateIndex
CREATE INDEX "VendorProductionRecord_workItemId_idx" ON "VendorProductionRecord"("workItemId");

-- CreateIndex
CREATE INDEX "NotificationEvent_entityType_entityId_idx" ON "NotificationEvent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPhone_phoneE164_key" ON "CustomerPhone"("phoneE164");

-- CreateIndex
CREATE INDEX "CustomerPhone_customerId_kind_idx" ON "CustomerPhone"("customerId", "kind");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_isDefault_idx" ON "CustomerAddress"("customerId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerClassification_name_key" ON "CustomerClassification"("name");

-- CreateIndex
CREATE INDEX "CustomerPromotion_sourceCustomerId_performedAt_idx" ON "CustomerPromotion"("sourceCustomerId", "performedAt");

-- CreateIndex
CREATE INDEX "CustomerPromotion_targetCustomerId_performedAt_idx" ON "CustomerPromotion"("targetCustomerId", "performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_storageKey_key" ON "FileObject"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_sha256_key" ON "FileObject"("sha256");

-- CreateIndex
CREATE INDEX "FileObject_sha256_idx" ON "FileObject"("sha256");

-- CreateIndex
CREATE INDEX "FileAsset_workItemId_category_idx" ON "FileAsset"("workItemId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_workItemId_category_logicalName_key" ON "FileAsset"("workItemId", "category", "logicalName");

-- CreateIndex
CREATE INDEX "FileVersion_fileAssetId_createdAt_idx" ON "FileVersion"("fileAssetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileVersion_fileAssetId_versionNumber_key" ON "FileVersion"("fileAssetId", "versionNumber");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_fileObjectId_idx" ON "Attachment"("fileObjectId");

-- CreateIndex
CREATE INDEX "FileAuditEvent_entity_entityId_idx" ON "FileAuditEvent"("entity", "entityId");

-- CreateIndex
CREATE INDEX "FileAuditEvent_actorId_createdAt_idx" ON "FileAuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "role_key_key" ON "role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_roleId_permission_key" ON "role_permission"("roleId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_userId_roleId_key" ON "user_role"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_userId_permission_key" ON "user_permission"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "user_department_userId_departmentId_key" ON "user_department"("userId", "departmentId");

-- CreateIndex
CREATE INDEX "audit_event_entityType_entityId_idx" ON "audit_event"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_event_actorId_createdAt_idx" ON "audit_event"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_event_action_createdAt_idx" ON "audit_event"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "CustomerClassification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_defaultDepartmentId_fkey" FOREIGN KEY ("defaultDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemTransition" ADD CONSTRAINT "WorkItemTransition_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemTransition" ADD CONSTRAINT "WorkItemTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseTiming" ADD CONSTRAINT "PhaseTiming_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseTiming" ADD CONSTRAINT "PhaseTiming_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersion" ADD CONSTRAINT "DesignVersion_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersion" ADD CONSTRAINT "DesignVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersion" ADD CONSTRAINT "DesignVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_originDepartmentId_fkey" FOREIGN KEY ("originDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_designVersionId_fkey" FOREIGN KEY ("designVersionId") REFERENCES "DesignVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnAttachment" ADD CONSTRAINT "ReturnAttachment_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProductionRecord" ADD CONSTRAINT "VendorProductionRecord_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProductionRecord" ADD CONSTRAINT "VendorProductionRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPhone" ADD CONSTRAINT "CustomerPhone_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPromotion" ADD CONSTRAINT "CustomerPromotion_sourceCustomerId_fkey" FOREIGN KEY ("sourceCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPromotion" ADD CONSTRAINT "CustomerPromotion_targetCustomerId_fkey" FOREIGN KEY ("targetCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_fileObjectId_fkey" FOREIGN KEY ("fileObjectId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_fileObjectId_fkey" FOREIGN KEY ("fileObjectId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAuditEvent" ADD CONSTRAINT "FileAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileConfig" ADD CONSTRAINT "FileConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department" ADD CONSTRAINT "user_department_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department" ADD CONSTRAINT "user_department_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
