# Quickstart: Order Change Control

These are manual QA scenarios, run against a seeded dev DB that has these users: one `RECEPTION`,
one `HEAD_DESIGNER`, one `DESIGNER`, one `PRODUCTION_OPERATOR` scoped to Department 1, one
`ADMIN_OWNER`, and one `ACCOUNTING`.

## Prerequisites

- 001/002/010–014 are on `main` (they are, as of this writing). 016's schema has been applied
  (tasks T002) and the constraints SQL applied (T004).
- `change.approve` is seeded to `HEAD_DESIGNER` and `ADMIN_OWNER`. Re-run `pnpm exec prisma db seed` after
  T003.
- There is one Work Item per scenario at the stated state. To get one naturally: 011 create →
  012 assign/complete → 013 approve → 014 start. To go faster, use the test factories.

## Scenario 0: Backfill on an existing database (US1, FR-005, SC-001)

1. Before applying 016, note `SELECT count(*) FROM "WorkItem"` as `N`.
2. Apply T002 (db push), then run `pnpm exec prisma db execute --file
   prisma/manual-sql/016-spec-version-backfill.sql --schema prisma/schema`.
3. Run the three verification queries from data-model.md "Step 4". Queries (a) and (b) return
   zero rows. Query (c) equals `N`.
4. Run the backfill file a **second time**. The `SpecVersion` count is unchanged, and one extra
   `spec_version.backfilled` audit row exists.
5. Open any pre-existing order. Its Work Item history shows v1 labeled "Backfilled", with no
   author. Earlier `workitem.edited` audit entries are still visible in Admin → Audit Log.

## Scenario 1: v1 on creation, v2 with diff (US1, US4)

1. As Reception, quick-create an order with a Work Item of quantity 500, material Vinyl. Open the
   order. History shows **v1 (Initial)**.
2. Edit the quantity to 800 while the item is `NEW`. History shows v1 (500) and v2 (800,
   "Direct edit"). The diff between them shows exactly one row: **Quantity 500 → 800**.
3. Edit the width from `1.50` to `1.5`. This is refused with "no changes".
4. Add finish notes. The diff shows "— → <notes>".
5. Add a second Work Item to the order after the first is in production (later scenario). It gets
   its own v1, and no change request is needed (FR-030).

## Scenario 2: Edit policy by state (US2)

1. For a Work Item `IN_DESIGN` with an assigned designer, edit the quantity as Reception. It
   succeeds, and the designer's notifications include "customer modification".
2. For a Work Item `APPROVED` (requiresDesign), edit the material. The form demands a choice.
   - Choose **Send back to design**. The item becomes `REWORK_REQUIRED`, and the review timeline
     shows a Return with category Customer change.
   - On another `APPROVED` item, choose **Keep design**. A version is created with no state
     change.
3. For a Work Item `IN_PRODUCTION`, the edit form is not shown, and "Request change" is offered
   instead. Using devtools or a crafted Server Action call, submit `editSpec` anyway. It is
   refused with "change request required", and there is no new version or audit edit.
4. For a `DELIVERED` Work Item as Reception, the edit is refused with "admin action required".
5. Open the same `NEW` Work Item in two tabs and save a different quantity in each. The second
   save is refused as stale.

## Scenario 3: Change request, continue production (US3)

1. As the Operator, start production on an item at v1 (quantity 500). The timer is running.
2. As Reception, choose **Request change** and set quantity 800 with reason "customer called".
   - The Operator's job card now shows a "change pending" banner.
   - The timer is paused.
   - Resume, Complete, and Send back each refuse with "change pending".
3. As Reception, try to record a second request. It is refused.
4. As Reception, open `/changes/<id>` or call approve. It is forbidden. As the Operator, opening
   `/changes` is forbidden.
5. As the Head Designer, open `/changes`. The request is listed, urgent orders first. Open it.
   The diff shows **Quantity 500 → 800**. Approve with **Continue production**.
6. History shows v2 (800, "Change request") and v1 (500), which is still readable.
7. As the Operator, resume is refused until **Acknowledge revised instruction** is pressed. The
   job card diff shows "production started from v1, current v2". After acknowledging, resume and
   complete work.
8. In Admin → Audit Log, filter by the Work Item. The log shows `change_request.created`,
   `spec_version.created`, `change_request.approved`, and `change_request.acknowledged`, each with
   actor and time.

## Scenario 4: Change request, send back to design / reject / withdraw (US3)

1. Repeat Scenario 3 up to step 2, then approve with **Send back to design**. The item becomes
   `REWORK_REQUIRED`, and a Return with category Customer change is created, with its origin set
   to the production department. The designer is notified.
2. On a `requiresDesign = false` item, the **Send back to design** outcome is not offered. A
   crafted call is refused.
3. Record a new request and **reject** it with a reason. There is no new version, the banner
   disappears at once, and resume works with no acknowledgment.
4. Record another request, and as Reception **withdraw** it with a reason. The result is the same
   as a rejection.

## Scenario 5: Pricing reset hook (US5)

With 051 not installed, approving a change succeeds (Scenario 3). The outbox table
`NotificationEvent` has a `work_item.spec_changed` row with `fromVersion: 1, toVersion: 2,
changedFields: ["quantity"]`. The automated test `tests/integration/changes/pricingReset.test.ts`
covers the listener → PENDING path and the listener-failure rollback.

## Scenario 6: Late cancellation (US6)

1. For an `IN_PRODUCTION` item, as Reception, use the ordinary **Cancel item**. It is refused with
   "late cancellation required".
2. Cancel the whole order when it has one `NEW` and one `IN_PRODUCTION` item. The `NEW` item is
   cancelled, and the result lists the in-production item as needing late cancellation.
3. Open **Late cancellation** on the in-production item. Submitting without a cost is refused, and
   so is a cost of `-5`. Submit with reason "customer cancelled" and cost `350.00`.
   - The item is `CANCELLED`.
   - The timer is stopped.
   - `LateCancellation` holds 350.00 EGP.
   - The audit log has `workitem.late_cancelled`.
4. Repeat on an item with a pending change request. The request becomes "closed by
   cancellation".
5. Try late cancellation on a `READY_FOR_PRODUCTION` item. It is refused.

## Scenario 7: Admin override (US7)

1. As Admin, on a `DELIVERED` item, override the quantity with reason "invoice correction". A new
   version labeled Admin override is created, and the prior version is unchanged.
2. Submit without a reason. It is refused. Try as Reception. It is forbidden.
3. On an `IN_PRODUCTION` item with no pending request, override with **Continue production**. The
   change request list for the item shows an approved Admin override request, and the Operator
   must acknowledge.
4. On an item with a pending request, the override is refused. On a `CANCELLED` item, it is
   refused.

## Automated checks

```bash
pnpm check                                   # lint + typecheck
pnpm test tests/unit/changes tests/contract/changes tests/integration/changes
pnpm test tests/unit/workflow-edges.test.ts tests/contract/role-permission-matrix.test.ts
pnpm test tests/integration/orders tests/integration/production tests/integration/review  # regressions
```
