# Quickstart: Production Workflow

Manual QA scenarios, run against a seeded dev DB with at least two `Department` rows (one normal,
one `isExternalProduction: true`) and two `PRODUCTION_OPERATOR` users each scoped to a different
department.

## Prerequisites

- 001/002/011/012/013 seeded and merged (or this feature's implementation branch based on
  013-review-rework-impl per plan.md's cross-feature dependency note).
- At least one Work Item per department reachable at `READY_FOR_PRODUCTION` (route through
  011 order creation → 012 design assignment → 013 approval to get there naturally, or seed
  directly for speed).

## Scenario 1 — Department-scoped queue (US1)

1. Log in as Operator A (Department 1 only).
2. Open `/production`. Confirm only Department 1's ready Work Items appear, urgent-first.
3. Log in as Operator B (Department 2 only). Confirm Department 2's items appear and Department
   1's do not.
4. As Operator B, request Department 1's Work Item's job card directly by URL. Confirm it is
   refused.

## Scenario 2 — Job card, approved-file-only download (US2)

1. As an operator scoped to the item's department, open its job card.
2. Confirm dimensions/quantity/material/notes render read-only.
3. Upload a newer, unapproved draft `DesignVersion` for the same Work Item (via 012's designer
   flow) without approving it.
4. Reload the job card. Confirm the download still offers only the previously approved version,
   never the new draft.

## Scenario 3 — Timer start/pause/resume (US3)

1. Start the job card's timer. Confirm the Work Item moves to `IN_PRODUCTION`.
2. Pause after a short wait. Note the recorded active duration.
3. Wait, then resume. Confirm duration continues accruing from the resume point and the total
   equals the sum of both active intervals, re-derivable from stored timestamps (refresh the page
   mid-pause to confirm nothing resets).

## Scenario 4 — Completion with produced quantity (US4)

1. With the timer paused or running, submit completion with an empty produced-quantity field.
   Confirm it is rejected with a validation error and the Work Item stays `IN_PRODUCTION`.
2. Resubmit with a produced quantity and a note. Confirm the Work Item reaches
   `PRODUCTION_COMPLETED`, the timer stops accruing, and completion time + operator are recorded.
3. Open the Collection/Print Reception queue (015, or a direct query if 015 isn't built yet).
   Confirm the completed Work Item appears.

## Scenario 5 — Send back to design (US5)

1. Start production on a Work Item, then send it back to design with a reason.
2. Confirm a `Return` record exists with origin `PRODUCTION_ISSUE`, the Work Item leaves the
   production queue (state `REWORK_REQUIRED`), and the assigned designer has a notification.
3. Retry the send-back with an empty reason on a different Work Item. Confirm it's rejected and
   the Work Item stays in production.

## Scenario 6 — External vendor flow (US6)

1. Route a Work Item to the `isExternalProduction` department.
2. Record "sent to vendor" with a vendor name. Attempt completion. Confirm it's refused
   (vendor-receipt gate).
3. Record "received from vendor". Retry completion. Confirm it now succeeds.

## Scenario 7 — Revised-file alert mid-production (US7)

1. Start production on a Work Item.
2. As a Head Designer, approve a newer `DesignVersion` for the same Work Item (013's flow).
3. Reload the operator's job card. Confirm a revised-file alert is visible.
4. Attempt to resume/continue the timer. Confirm it is blocked.
5. Acknowledge the revision. Confirm the timer can now resume normally.

## Scenario 8 — Multi-department operator (Edge Case)

1. As an operator scoped to both departments, open `/production`. Confirm the queue shows the
   union of both departments' ready items in one combined urgent-first/oldest-first list, not
   grouped separately per department.
