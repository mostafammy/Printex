-- Test-DB bootstrap, mirroring scripts/test-db.mjs.
--
-- The app role is separate from the owner so the append-only guarantees can
-- be tested: it can INSERT the immutable rows but not UPDATE or DELETE them,
-- so SC-002's "the database refuses the write" is a real refusal rather than
-- a promise in application code.

DO $$ BEGIN
  CREATE ROLE printex_app LOGIN PASSWORD 'printex_app_ci_pw';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT CONNECT ON DATABASE printex_test TO printex_app;
GRANT USAGE ON SCHEMA public TO printex_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO printex_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO printex_app;

-- 001: the audit log is append-only.
REVOKE UPDATE, DELETE ON audit_event FROM printex_app;

-- 052: money rows are append-only (SC-002).
REVOKE UPDATE, DELETE ON "Payment", "FinanceVoid", "Expense", "ExpenseApproval", "DirectCost"
  FROM printex_app;
