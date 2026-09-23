ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "normalizedName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "nationalId" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "classificationId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "CustomerClassification" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerClassification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerClassification_name_key" ON "CustomerClassification"("name");

CREATE TABLE IF NOT EXISTS "CustomerPhone" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPhone_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPhone_phoneE164_key" ON "CustomerPhone"("phoneE164");
CREATE INDEX IF NOT EXISTS "CustomerPhone_customerId_kind_idx" ON "CustomerPhone"("customerId", "kind");

CREATE TABLE IF NOT EXISTS "CustomerAddress" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "label" TEXT,
  "value" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CustomerAddress_customerId_isDefault_idx" ON "CustomerAddress"("customerId", "isDefault");

CREATE TABLE IF NOT EXISTS "CustomerPromotion" (
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
CREATE INDEX IF NOT EXISTS "CustomerPromotion_sourceCustomerId_performedAt_idx" ON "CustomerPromotion"("sourceCustomerId", "performedAt");
CREATE INDEX IF NOT EXISTS "CustomerPromotion_targetCustomerId_performedAt_idx" ON "CustomerPromotion"("targetCustomerId", "performedAt");

CREATE INDEX IF NOT EXISTS "Customer_normalizedName_idx" ON "Customer"("normalizedName");
CREATE INDEX IF NOT EXISTS "Customer_isArchived_idx" ON "Customer"("isArchived");

DO $$ BEGIN
  ALTER TABLE "Customer" ADD CONSTRAINT "Customer_classificationId_fkey"
    FOREIGN KEY ("classificationId") REFERENCES "CustomerClassification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CustomerPhone" ADD CONSTRAINT "CustomerPhone_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CustomerPromotion" ADD CONSTRAINT "CustomerPromotion_sourceCustomerId_fkey"
    FOREIGN KEY ("sourceCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CustomerPromotion" ADD CONSTRAINT "CustomerPromotion_targetCustomerId_fkey"
    FOREIGN KEY ("targetCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
