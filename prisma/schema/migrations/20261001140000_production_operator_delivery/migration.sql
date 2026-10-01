-- Grant PRODUCTION_OPERATOR `collection.receive` and `delivery.record`.
--
-- Every edge out of PRODUCTION_COMPLETED is gated on `collection.receive` or
-- `delivery.record` (src/server/board/edges/collection.ts) — there is no
-- production-scoped exit from that state at all. PRODUCTION_OPERATOR held
-- neither, so the printer could *see* cards sitting in مكتمل الإنتاج (the
-- `production` slice includes the collection station, and visibility.ts lists
-- PRODUCTION_COMPLETED in PRODUCTION_ONWARD_STATES) but had zero moves on them:
-- a lane you can see and do nothing with. Same for READY_FOR_COLLECTION.
--
-- In this shop the printer is the one who prints, checks and packs the job and
-- hands it to the customer, so they own the delivery hand-off alongside
-- reception. That is a shop decision, not a pipeline one — hence a grant rather
-- than a new edge.
--
-- Data migration rather than on-read self-provisioning, for the same reason as
-- 20261001120000_reception_payment_record: role permissions are a security
-- boundary. Code that re-inserts a grant on every read would silently undo a
-- deliberate later revoke; a migration runs once and never again.
--
-- Explicit ids because `RolePermission.id` defaults to a Prisma-level cuid(),
-- which is not a database default and so has no value for a raw INSERT.
-- `ON CONFLICT DO NOTHING` covers the unique (roleId, permission) pair, and the
-- SELECT means a database with no PRODUCTION_OPERATOR role is left untouched
-- rather than failing the migration.
--
-- Note: `collection.receive` and `delivery.record` are both in
-- FLOOR_WIDE_PERMISSIONS (visibility.ts), so this also widens the operator's
-- board from department-scoped to floor-wide. That is the pre-existing
-- behaviour for every other role holding these — RECEPTION and
-- PRINT_RECEPTION_DELIVERY — and is what lets the printer see the hand-off
-- queue at all.
INSERT INTO role_permission (id, "roleId", permission)
SELECT 'rp_production_operator_collection_receive', r.id, 'collection.receive'
  FROM role r
 WHERE r.key = 'PRODUCTION_OPERATOR'
ON CONFLICT ("roleId", permission) DO NOTHING;

INSERT INTO role_permission (id, "roleId", permission)
SELECT 'rp_production_operator_delivery_record', r.id, 'delivery.record'
  FROM role r
 WHERE r.key = 'PRODUCTION_OPERATOR'
ON CONFLICT ("roleId", permission) DO NOTHING;