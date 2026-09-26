-- Missing indexes on WorkItem/Order columns that are filtered/joined on
-- directly (review queue's `state`, my-queue/designer-workload/eligible-
-- designers' `assigneeId` + `state`, and Order.customerId joins). At this
-- dataset's row count these were full sequential scans. Idempotent so it can
-- be applied to databases previously synced with `prisma db push`.

CREATE INDEX IF NOT EXISTS "WorkItem_state_idx" ON "WorkItem" ("state");
CREATE INDEX IF NOT EXISTS "WorkItem_assigneeId_state_idx" ON "WorkItem" ("assigneeId", "state");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order" ("customerId");
