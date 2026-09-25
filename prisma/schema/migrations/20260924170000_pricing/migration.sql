-- 051 Pricing Engine — additive migration (T004).
-- Schema owner approval confirmed before applying to the shared database;
-- `prisma db push` is deliberately NOT used (tasks.md T004).
--
-- Contents (data-model.md "Migration and backfill"):
--   1. Pricing enums.
--   2. ProductPricingPolicy, PriceList, PriceTier, CustomerPricingRule,
--      WorkItemPrice, PricingStatus tables + indexes + FKs.
--   3. Tier/effective-date/amount CHECK constraints (Prisma-expressible).
--   4. Database-only non-overlap EXCLUDE constraints for effective intervals
--      and quantity tiers — these cannot be expressed in prisma/schema, so
--      they live here (T003's documented database-only constraints) and are
--      additionally guarded by the application layer in configuration.ts.
--   5. Append-only enforcement triggers: commercial values on WorkItemPrice,
--      PriceList, PriceTier and CustomerPricingRule are never updated or
--      deleted; PriceList/CustomerPricingRule may only flip `status`
--      (retirement), WorkItemPrice may only gain `replacedAt`.
--   6. Backfill: every existing Work Item gets PENDING pricing status with
--      waitingSince = migration timestamp. No historical price is fabricated.
--
-- The script is written to replay cleanly on a fresh database (IF NOT EXISTS
-- / guarded DO blocks) and to be a no-op when re-run on an existing one.

-- --- 1. Enums ---------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "PricingMode" AS ENUM ('FIXED', 'VARIABLE');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PricingUnit" AS ENUM ('PIECE', 'SQUARE_METER', 'LINEAR_METER', 'SHEET', 'PACK');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PriceSource" AS ENUM ('LIST', 'CUSTOMER_RULE', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PricingStatusValue" AS ENUM ('PENDING', 'PRICED', 'DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerRuleKind" AS ENUM ('FIXED', 'PERCENT_DISCOUNT');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PriceConfigStatus" AS ENUM ('ACTIVE', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

-- --- 2. Tables --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ProductPricingPolicy" (
    "id" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "mode" "PricingMode" NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductPricingPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PriceList" (
    "id" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "unit" "PricingUnit" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "PriceConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PriceTier" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "minimumQuantity" INTEGER NOT NULL,
    "maximumQuantity" INTEGER,
    "basePrice" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "PriceTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerPricingRule" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "unit" "PricingUnit" NOT NULL,
    "kind" "CustomerRuleKind" NOT NULL,
    "fixedPrice" DECIMAL(12,2),
    "discountPercent" DECIMAL(5,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "PriceConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerPricingRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkItemPrice" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "source" "PriceSource" NOT NULL,
    "quoteBreakdown" JSONB,
    "setById" TEXT NOT NULL,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "specFingerprint" TEXT,
    "replacedAt" TIMESTAMP(3),
    CONSTRAINT "WorkItemPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PricingStatus" (
    "workItemId" TEXT NOT NULL,
    "status" "PricingStatusValue" NOT NULL DEFAULT 'PENDING',
    "waitingSince" TIMESTAMP(3),
    "disputeReason" TEXT,
    "currentPriceId" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingStatus_pkey" PRIMARY KEY ("workItemId")
);

-- --- 3. Indexes -------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "ProductPricingPolicy_productTypeId_key" ON "ProductPricingPolicy"("productTypeId");
CREATE INDEX IF NOT EXISTS "PriceList_productTypeId_unit_effectiveFrom_effectiveTo_idx" ON "PriceList"("productTypeId", "unit", "effectiveFrom", "effectiveTo");
CREATE INDEX IF NOT EXISTS "PriceList_status_effectiveFrom_effectiveTo_idx" ON "PriceList"("status", "effectiveFrom", "effectiveTo");
CREATE INDEX IF NOT EXISTS "PriceTier_priceListId_minimumQuantity_maximumQuantity_idx" ON "PriceTier"("priceListId", "minimumQuantity", "maximumQuantity");
CREATE INDEX IF NOT EXISTS "CustomerPricingRule_customerId_productTypeId_unit_effective_idx" ON "CustomerPricingRule"("customerId", "productTypeId", "unit", "effectiveFrom", "effectiveTo");
CREATE INDEX IF NOT EXISTS "CustomerPricingRule_status_effectiveFrom_effectiveTo_idx" ON "CustomerPricingRule"("status", "effectiveFrom", "effectiveTo");
CREATE INDEX IF NOT EXISTS "WorkItemPrice_workItemId_setAt_idx" ON "WorkItemPrice"("workItemId", "setAt");
CREATE INDEX IF NOT EXISTS "WorkItemPrice_workItemId_replacedAt_idx" ON "WorkItemPrice"("workItemId", "replacedAt");
CREATE INDEX IF NOT EXISTS "PricingStatus_status_waitingSince_idx" ON "PricingStatus"("status", "waitingSince");

-- --- 4. CHECK constraints ---------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_minimumQuantity_positive" CHECK ("minimumQuantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_maximumQuantity_ge_minimum" CHECK ("maximumQuantity" IS NULL OR "maximumQuantity" >= "minimumQuantity");
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_basePrice_positive" CHECK ("basePrice" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_effective_window" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerPricingRule" ADD CONSTRAINT "CustomerPricingRule_effective_window" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerPricingRule" ADD CONSTRAINT "CustomerPricingRule_kind_values" CHECK (
    ("kind" = 'FIXED' AND "fixedPrice" IS NOT NULL AND "fixedPrice" > 0 AND "discountPercent" IS NULL)
    OR ("kind" = 'PERCENT_DISCOUNT' AND "discountPercent" IS NOT NULL AND "discountPercent" >= 0 AND "discountPercent" < 100 AND "fixedPrice" IS NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkItemPrice" ADD CONSTRAINT "WorkItemPrice_amount_positive" CHECK ("amount" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkItemPrice" ADD CONSTRAINT "WorkItemPrice_currency_egp" CHECK ("currency" = 'EGP');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

-- --- 4a. Database-only non-overlap constraints ------------------------------
-- Prisma cannot express interval/tier non-overlap (data-model.md
-- "Invariants and indexes"); btree_gist turns the documented invariant into a
-- hard database constraint. Ranges are half-open '[)' so adjacent effective
-- windows (to = from) do not collide, and only ACTIVE configuration rows are
-- constrained so retired history never blocks a new configuration.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- NOTE: `tsrange` (timestamp without time zone) is used rather than
-- `tstzrange` because the columns are TIMESTAMP(3) and the timestamp ->
-- timestamptz cast depends on the session TimeZone, which Postgres refuses to
-- index (must be IMMUTABLE).
DO $$ BEGIN
  ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_no_overlap"
    EXCLUDE USING gist (
      "productTypeId" WITH =,
      "unit" WITH =,
      tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::TIMESTAMP), '[)') WITH &&
    ) WHERE ("status" = 'ACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerPricingRule" ADD CONSTRAINT "CustomerPricingRule_no_overlap"
    EXCLUDE USING gist (
      "customerId" WITH =,
      "productTypeId" WITH =,
      "unit" WITH =,
      tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::TIMESTAMP), '[)') WITH &&
    ) WHERE ("status" = 'ACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_no_overlap"
    EXCLUDE USING gist (
      "priceListId" WITH =,
      int4range("minimumQuantity", "maximumQuantity", '[]') WITH &&
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

-- --- 5. Foreign keys --------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "ProductPricingPolicy" ADD CONSTRAINT "ProductPricingPolicy_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductPricingPolicy" ADD CONSTRAINT "ProductPricingPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerPricingRule" ADD CONSTRAINT "CustomerPricingRule_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerPricingRule" ADD CONSTRAINT "CustomerPricingRule_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerPricingRule" ADD CONSTRAINT "CustomerPricingRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkItemPrice" ADD CONSTRAINT "WorkItemPrice_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkItemPrice" ADD CONSTRAINT "WorkItemPrice_setById_fkey" FOREIGN KEY ("setById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PricingStatus" ADD CONSTRAINT "PricingStatus_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PricingStatus" ADD CONSTRAINT "PricingStatus_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

-- --- 6. Append-only enforcement ---------------------------------------------
-- Commercial history is retired or superseded, never rewritten (constitution
-- III, FR-010). The database itself refuses destructive writes so the
-- guarantee holds even if application code regresses.

CREATE OR REPLACE FUNCTION pricing_commercial_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% is append-only: rows are never deleted (051 constitution III)', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_TABLE_NAME = 'WorkItemPrice' THEN
    -- History rows are immutable except for the supersede marker `replacedAt`.
    IF NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."workItemId" IS DISTINCT FROM OLD."workItemId"
      OR NEW."amount" IS DISTINCT FROM OLD."amount"
      OR NEW."currency" IS DISTINCT FROM OLD."currency"
      OR NEW."source" IS DISTINCT FROM OLD."source"
      OR NEW."quoteBreakdown" IS DISTINCT FROM OLD."quoteBreakdown"
      OR NEW."setById" IS DISTINCT FROM OLD."setById"
      OR NEW."setAt" IS DISTINCT FROM OLD."setAt"
      OR NEW."reason" IS DISTINCT FROM OLD."reason"
      OR NEW."specFingerprint" IS DISTINCT FROM OLD."specFingerprint"
    THEN
      RAISE EXCEPTION 'WorkItemPrice commercial values are append-only: insert a new row instead'
        USING ERRCODE = 'restrict_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'PriceList' THEN
    -- Only `status` may change (ACTIVE -> RETIRED); dates, unit and rates stay.
    IF NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."productTypeId" IS DISTINCT FROM OLD."productTypeId"
      OR NEW."unit" IS DISTINCT FROM OLD."unit"
      OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom"
      OR NEW."effectiveTo" IS DISTINCT FROM OLD."effectiveTo"
      OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
      OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION 'PriceList rows are append-only: only status (retirement) may change'
        USING ERRCODE = 'restrict_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'PriceTier' THEN
    RAISE EXCEPTION 'PriceTier rows are immutable: insert a new price list instead'
      USING ERRCODE = 'restrict_violation';
  ELSIF TG_TABLE_NAME = 'CustomerPricingRule' THEN
    -- Only `status` may change (ACTIVE -> RETIRED); amounts and dates stay.
    IF NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."customerId" IS DISTINCT FROM OLD."customerId"
      OR NEW."productTypeId" IS DISTINCT FROM OLD."productTypeId"
      OR NEW."unit" IS DISTINCT FROM OLD."unit"
      OR NEW."kind" IS DISTINCT FROM OLD."kind"
      OR NEW."fixedPrice" IS DISTINCT FROM OLD."fixedPrice"
      OR NEW."discountPercent" IS DISTINCT FROM OLD."discountPercent"
      OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom"
      OR NEW."effectiveTo" IS DISTINCT FROM OLD."effectiveTo"
      OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
      OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION 'CustomerPricingRule rows are append-only: only status (retirement) may change'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "WorkItemPrice_append_only" ON "WorkItemPrice";
CREATE TRIGGER "WorkItemPrice_append_only"
  BEFORE UPDATE OR DELETE ON "WorkItemPrice"
  FOR EACH ROW EXECUTE FUNCTION pricing_commercial_append_only();

DROP TRIGGER IF EXISTS "PriceList_append_only" ON "PriceList";
CREATE TRIGGER "PriceList_append_only"
  BEFORE UPDATE OR DELETE ON "PriceList"
  FOR EACH ROW EXECUTE FUNCTION pricing_commercial_append_only();

DROP TRIGGER IF EXISTS "PriceTier_append_only" ON "PriceTier";
CREATE TRIGGER "PriceTier_append_only"
  BEFORE UPDATE OR DELETE ON "PriceTier"
  FOR EACH ROW EXECUTE FUNCTION pricing_commercial_append_only();

DROP TRIGGER IF EXISTS "CustomerPricingRule_append_only" ON "CustomerPricingRule";
CREATE TRIGGER "CustomerPricingRule_append_only"
  BEFORE UPDATE OR DELETE ON "CustomerPricingRule"
  FOR EACH ROW EXECUTE FUNCTION pricing_commercial_append_only();

-- --- 7. Backfill ------------------------------------------------------------
-- Existing Work Items become PENDING with waitingSince = migration time. No
-- price is invented; items stay undeliverable until explicitly priced
-- (data-model.md "Migration and backfill").

INSERT INTO "PricingStatus" ("workItemId", "status", "waitingSince", "updatedAt")
SELECT "id", 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "WorkItem"
ON CONFLICT ("workItemId") DO NOTHING;
