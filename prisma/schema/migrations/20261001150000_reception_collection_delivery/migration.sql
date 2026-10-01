-- Grant RECEPTION `collection.receive` and `delivery.record`.
--
-- seed.ts has listed these two on RECEPTION for some time, but the role rows in
-- the live database were written by an older seed run that predates them, and
-- nothing ever reconciled the two: role_permission is populated by seed.ts only
-- (migration 20260924084346 creates the table empty). So the live RECEPTION role
-- had neither permission even though the seed said it should.
--
-- The consequence was that the front desk could not hand a job off: every edge
-- out of PRODUCTION_COMPLETED is gated on `collection.receive` or
-- `delivery.record` (src/server/board/edges/collection.ts), so the board offered
-- a RECEPTION user no moves at all out of مكتمل الإنتاج — a station they can
-- see and act in nowhere. Verified against the live database before this
-- migration:
--
--   RECEPTION (9): customer.manage, finance.view, order.cancel, order.create,
--   order.edit, payment.record, pricing.use_fixed, workitem.assign_designer,
--   workitem.send_to_production
--
-- `payment.record` was fixed the same way by 20261001120000; this is the rest of
-- the gap.
--
-- Data migration rather than on-read self-provisioning, for the reason given in
-- 20261001120000: role permissions are a security boundary, and code that
-- re-inserts a grant on every read would silently undo a deliberate later
-- revoke. A migration runs once.
--
-- Explicit id because `RolePermission.id` defaults to a Prisma-level cuid(),
-- which is not a database default and so has no value for a raw INSERT.
-- `ON CONFLICT DO NOTHING` covers the unique (roleId, permission) pair, and the
-- SELECT means a database with no RECEPTION role is left untouched rather than
-- failing the migration.
INSERT INTO role_permission (id, "roleId", permission)
SELECT 'rp_reception_collection_receive', r.id, 'collection.receive'
  FROM role r
 WHERE r.key = 'RECEPTION'
ON CONFLICT ("roleId", permission) DO NOTHING;

INSERT INTO role_permission (id, "roleId", permission)
SELECT 'rp_reception_delivery_record', r.id, 'delivery.record'
  FROM role r
 WHERE r.key = 'RECEPTION'
ON CONFLICT ("roleId", permission) DO NOTHING;