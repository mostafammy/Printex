-- 092-performance T055 — pg_trgm GIN index for customer name search
-- (PERFORMANCE_INVESTIGATION.md §7.2).
--
-- customers/service.ts filters Customer.normalizedName with Prisma `contains`
-- (SQL LIKE '%x%'), which the existing btree Customer_normalizedName_idx
-- (prefix-only) cannot serve; a trigram GIN index backs anywhere-match
-- probes instead. Phone search (CustomerPhone.phoneE164 startsWith) stays
-- btree-served and is out of scope.
--
-- Fidelity note: the Prisma schema does not model trgm/GIN indexes (raw-SQL
-- only) — no *.prisma edit per tasks.md T055; consequences recorded in
-- specs/092-performance/db-verification.md (091 baseline follow-up).
-- Write-cost (DB-005): Customer is write-light (name set at create/edit);
-- one extra GIN maintenance per name write, no FK churn.
-- Replay-safe: IF NOT EXISTS guards; re-run is a no-op.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Customer_normalizedName_trgm_idx" ON "Customer" USING gin ("normalizedName" gin_trgm_ops);
