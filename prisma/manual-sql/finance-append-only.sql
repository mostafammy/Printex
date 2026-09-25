-- Enforces constitution III / 052-finance spec FR-004 & FR-016: no
-- application code path or direct SQL client may ever UPDATE or DELETE a
-- Payment, FinanceVoid, Expense, ExpenseApproval or DirectCost row.
-- Corrections are appended FinanceVoid rows; approval is an appended
-- ExpenseApproval row (data-model.md "Immutability envelope").
--
-- DEPLOYMENT PREREQUISITE: this REVOKE only binds against a NON-SUPERUSER
-- role (a superuser bypasses GRANT/REVOKE). If your DATABASE_URL connects as
-- a cluster superuser the statement succeeds silently with no effect —
-- verify by attempting an UPDATE against "Payment" afterwards and confirming
-- Postgres rejects it. Prisma's `postgres` role on this project's Supabase
-- instance is the table owner (not a cluster superuser), so CURRENT_USER
-- framing binds there; CI's split-role setup applies the equivalent
-- `REVOKE ... FROM printex_app` explicitly (ci.yml).
--
-- Apply manually (this project uses prisma db push, not prisma migrate, for
-- schema sync — triggers in 20260925000000_finance/migration.sql are the
-- migrate-deploy/production layer; this REVOKE is the runtime-role layer):
--   pnpm exec prisma db execute \
--     --file prisma/manual-sql/finance-append-only.sql \
--     --schema prisma/schema
--
-- After applying, verify empirically:
--   pnpm exec prisma db execute --stdin --schema prisma/schema <<'SQL'
--   UPDATE "Payment" SET note = 'tampered' WHERE false;
--   SQL
-- Postgres should respond: ERROR: permission denied for table Payment

REVOKE UPDATE, DELETE ON "Payment" FROM CURRENT_USER;
REVOKE UPDATE, DELETE ON "FinanceVoid" FROM CURRENT_USER;
REVOKE UPDATE, DELETE ON "Expense" FROM CURRENT_USER;
REVOKE UPDATE, DELETE ON "ExpenseApproval" FROM CURRENT_USER;
REVOKE UPDATE, DELETE ON "DirectCost" FROM CURRENT_USER;
