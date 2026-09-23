# Quickstart: Head Designer Review & Rework Loop

Prerequisites: 012 (Designer Assignment & Timers) implemented and merged — this feature reads its
`DesignVersion` model and extends it. Dev DB seeded (`pnpm exec prisma db seed`) so a
`HEAD_DESIGNER`-permissioned user and at least one `DESIGNER`-permissioned user exist.

## Setup

```bash
pnpm install
pnpm exec prisma generate
pnpm exec prisma db push   # after data-model.md's Return/ReturnAttachment/DesignVersion columns land
pnpm exec prisma db seed
pnpm dev
```

## Scenario 1 — Review queue ordering (User Story 1)

1. As a Reception/Admin user, create three Work Items and drive each to `WAITING_REVIEW` (upload a
   design version, mark design complete — 012's `markDesignComplete`).
2. Set one to `URGENT` priority (011).
3. As a `HEAD_DESIGNER` user, open `/review`.
4. Expect: the urgent item listed first, the other two ordered oldest-`WAITING_REVIEW`-entry-first.

## Scenario 2 — Approve (User Story 2)

1. Open a `WAITING_REVIEW` Work Item's review screen (`/review/[workItemId]`) as a `HEAD_DESIGNER`
   user who did **not** upload its current design version.
2. Confirm the screen shows the current version's preview, prior versions (if any), the order's
   dimensions/quantity/material, and any customer notes.
3. Click Approve.
4. Expect: the current `DesignVersion` row gets `approvedAt`/`approvedById` set; the Work Item
   reaches `APPROVED` (and `READY_FOR_PRODUCTION` if 002's pricing-independent edge allows it
   regardless of pricing status).

## Scenario 3 — Self-review guard (User Story 2, Acceptance Scenario 4)

1. As a `DESIGNER`-and-`HEAD_DESIGNER` dual-permission user, upload a design version for a Work
   Item assigned to yourself, then mark it complete (reaching `WAITING_REVIEW`).
2. Open that Work Item's review screen and click Approve.
3. Expect: a guard failure (`GUARD_FAILED`) — no state change, no `approvedAt` set.

## Scenario 4 — Reject with required fields (User Story 3)

1. Open a `WAITING_REVIEW` Work Item's review screen.
2. Click Reject without filling in a category or explanation.
3. Expect: a validation error, no state change, no `Return` row created.
4. Fill in category "Dimension issue", origin department, and an explanation; submit.
5. Expect: the Work Item moves to `REWORK_REQUIRED`; a `Return` row is created with all required
   fields; the assigned designer's notifications include one deep-linked to this rejection.

## Scenario 5 — Attachments on a rejection (User Story 3, Acceptance Scenario 4)

1. Repeat Scenario 4, additionally attaching an image and a short voice-note recording.
2. Expect: both attachments are stored and listed against the resulting `Return` in the version
   timeline.

## Scenario 6 — Version timeline (User Story 4)

1. Take a Work Item through: upload v1 → reject v1 (category "Design issue") → upload v2 → approve
   v2.
2. Open the Work Item's timeline.
3. Expect: v1 listed with outcome REJECTED (category, explanation, reviewer, timestamp), v2 listed
   with outcome APPROVED (reviewer, timestamp) — both in version order.
4. Attempt to upload a replacement file reusing v2's version number directly (bypassing the normal
   upload flow, e.g. via a direct API call) — expect this to be rejected; only a new version number
   is accepted.

## Scenario 7 — Rework counter (User Story 5)

1. Take the same Work Item from Scenario 6 through a second rejection cycle (upload v3, reject it).
2. Check the Work Item's summary (review queue row or order detail).
3. Expect: rework count reads 2 (two completed rejection cycles: v1's and v3's).

## Scenario 8 — Urgent does not skip review (Edge Cases)

1. Mark a `WAITING_REVIEW` Work Item `URGENT`.
2. Confirm it still requires an explicit Approve/Reject action — it does not auto-advance and does
   not appear anywhere as already decided.
