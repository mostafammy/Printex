-- 011-orders-reception: product catalog, order due date/number sequence,
-- and work-item descriptive fields. Non-destructive and idempotent so it can
-- be applied to databases that were previously synced with `prisma db push`.

DO $$ BEGIN
  CREATE TYPE "WorkItemDimensionUnit" AS ENUM ('MM', 'CM', 'M', 'IN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Order: due date + ever-increasing number (FR-008a)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

CREATE SEQUENCE IF NOT EXISTS order_number_seq;
ALTER TABLE "Order" ALTER COLUMN "number" SET DEFAULT nextval('order_number_seq');
ALTER SEQUENCE order_number_seq OWNED BY "Order"."number";
SELECT setval('order_number_seq', GREATEST((SELECT COALESCE(MAX("number"), 0) FROM "Order"), 1), (SELECT COUNT(*) > 0 FROM "Order"));

-- WorkItem descriptive fields
ALTER TABLE "WorkItem"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "dimensionUnit" "WorkItemDimensionUnit",
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finishNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "heightValue" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "material" TEXT,
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "widthValue" DECIMAL(10,2);

-- ProductType catalog
CREATE TABLE IF NOT EXISTS "ProductType" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "ProductType_name_key" ON "ProductType"("name");

DO $$ BEGIN
  ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_productTypeId_fkey"
    FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_defaultDepartmentId_fkey"
    FOREIGN KEY ("defaultDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
