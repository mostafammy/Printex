-- 092-performance T055 (investigation §7.2) — trigram index for customer
-- name search.
--
-- WHY THIS FILE EXISTS: `findCustomers` searches with
-- `normalizedName: { contains: … }`, which Prisma emits as `LIKE '%x%'`. A
-- btree index cannot serve a leading-wildcard match — `Customer_normalizedName_idx`
-- (declared in prisma/schema/core.prisma) is never used by that query. The GIN
-- trigram index below is what actually makes it fast.
--
-- WHY IT IS NOT IN THE SCHEMA: Prisma cannot express an index with a non-default
-- operator class (`gin_trgm_ops`). The index therefore exists ONLY in this
-- file and in the migration tree
-- (`prisma/schema/migrations/20260930084032_customer_name_trgm/migration.sql`).
--
-- CONSEQUENCE — WHY THIS STEP IS MANDATORY: `prisma db push` reconciles the
-- database to the .prisma models, so it DROPS an index it does not know about.
-- Any environment built that way (CI, and every dev machine that runs
-- `pnpm db:push`) would silently lose this index and fall back to a full scan
-- on every customer search. Re-applying this file after `db push` is what
-- closes the gap; CI does it in the step below, mirroring how the append-only
-- REVOKEs and the 016 constraints are handled.
--
-- Apply manually (this project uses `prisma db push`, not `prisma migrate`):
--   pnpm exec prisma db execute \
--     --file prisma/manual-sql/customer-name-trgm-index.sql \
--     --schema prisma/schema
--
-- CREATE EXTENSION requires privileges the app role does not have; run this as
-- a superuser (CI uses the postgres superuser via DIRECT_URL/psql).

-- pg_trgm provides the gin_trgm_ops operator class used below.
-- IF NOT EXISTS: re-applying this file is safe (CI runs it on every build).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Serves `normalizedName LIKE '%x%'` in findCustomers. Safe to re-create: the
-- IF NOT EXISTS keeps `db push`-then-apply idempotent.
CREATE INDEX IF NOT EXISTS "Customer_normalizedName_trgm_idx"
  ON "Customer" USING gin ("normalizedName" gin_trgm_ops);