-- Grant RECEPTION `payment.record`, so the front desk can log a deposit.
--
-- Reception physically takes the customer's money at the counter, and the order
-- form has always had a "paid / deposit" field. Until now that field went
-- nowhere: `recordPayment` requires `payment.record`, which RECEPTION did not
-- hold (it holds `finance.view`, which is read-only), so recording a deposit
-- failed with ForbiddenError *after* the order and its frozen specs were already
-- committed — a 500, a half-written order, and the deposit missing from both.
--
-- This is a DATA migration rather than on-read self-provisioning (the pattern
-- used for width rules and finishings) on purpose. Role permissions are a
-- security boundary and, unlike a finishing rate, an operator may legitimately
-- REVOKE this later. Code that re-inserts the grant on every read would silently
-- undo that revoke; a migration runs once and never again, so a deliberate
-- removal sticks.
--
-- The id is explicit because `RolePermission.id` defaults to a Prisma-level
-- cuid(), which is not a database default and so has no value for a raw INSERT.
-- `ON CONFLICT DO NOTHING` covers the unique (roleId, permission) pair, and the
-- SELECT means a database with no RECEPTION role is left untouched rather than
-- failing the migration.
INSERT INTO role_permission (id, "roleId", permission)
SELECT 'rp_reception_payment_record', r.id, 'payment.record'
  FROM role r
 WHERE r.key = 'RECEPTION'
ON CONFLICT ("roleId", permission) DO NOTHING;
