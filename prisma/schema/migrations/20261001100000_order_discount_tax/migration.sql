-- Order-level discount and tax (reception-entered, stored).
--
-- The order TOTAL stays derived: `computeOrderSummary` sums the WorkItemPrice
-- rows the accountant writes from each frozen productionTotal, then applies
-- these two columns as `subtotal - discount + tax`. What was missing was any
-- place to record the discount and tax reception agreed with the customer — the
-- form collected both and the server dropped them, so the number shown at the
-- desk was a number nobody stored.
--
-- The NOTE columns record whether each amount was entered as a flat sum or as a
-- percentage, which the amount alone cannot express.
--
-- NOT NULL DEFAULT 0 so every existing order keeps working and reads as "no
-- discount, no tax" without a backfill.

ALTER TABLE "Order"
  ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountNote"   TEXT,
  ADD COLUMN "taxNote"        TEXT;