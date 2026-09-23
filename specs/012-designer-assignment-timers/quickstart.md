# Quickstart: Designer Assignment & Timers

Validates this feature end-to-end once implemented. Assumes the repo is already set up per the root
`README.md` (Postgres running, `.env`/`.env.test` configured) and `main` includes 001, 002, and 011.

## Prerequisites

```bash
git checkout 012-designer-assignment-timers
pnpm install
pnpm exec prisma db push        # applies data-model.md's schema diff (DesignVersion)
pnpm exec prisma db seed
pnpm dev
```

Log in as a seeded `RECEPTION` user for Scenarios 1–2, then a seeded `DESIGNER` user for Scenarios
3–6 (see `prisma/seed.ts` for seeded credentials). Scenario 7 is an optional operator note, not a
scripted step.

You'll need at least one Order with an un-designed Work Item already in the system — create one via
`/reception/quick-create` (011) first if none exists.

## Scenario 1 — Assign a designer (User Story 1, P1)

1. As RECEPTION, open the order detail page for a Work Item in state `NEW`.
2. Open the assignment dialog.
3. **Expected**: every active `DESIGNER`-role user appears with their active-item count, queue
   size, estimated wait, and past-jobs-for-this-customer count; exactly one is visually marked as
   suggested (the lightest-loaded); nobody is pre-selected.
4. Pick a designer (not necessarily the suggested one) and confirm — no reason field required (this
   is an initial assignment, not a reassignment).
5. **Expected**: the Work Item now shows state `ASSIGNED` and the picked designer as assignee.
6. **Verifies**: `getEligibleDesigners`, `assignDesigner`'s initial-assignment branch (both
   `contracts/designer-assignment.md`), the `NEW → ASSIGNED` edge via `transitionWorkItem`.

## Scenario 2 — Reassign with a reason (User Story 2, P1)

1. As RECEPTION, reopen the assignment dialog on the Work Item from Scenario 1 (now `ASSIGNED`).
2. Pick a different designer. Try to confirm with an empty reason.
3. **Expected**: blocked, asking for a reason.
4. Enter a reason and confirm.
5. **Expected**: the Work Item's assignee changes; its state stays `ASSIGNED` (no state change); an
   audit trail entry records the reason.
6. **Verifies**: `assignDesigner`'s reassignment branch, FR-005.

## Scenario 3 — Work the queue with a timer (User Story 3, P1)

1. Log in as the designer now assigned to the Work Item from Scenario 2.
2. Navigate to `/my-queue` (existing placeholder route from 002 — this feature replaces its
   content).
3. **Expected**: the Work Item appears, showing customer, product, due date; if other Work Items
   are assigned to this designer, urgent ones appear first, then oldest-assigned first.
4. Start its timer.
5. **Expected**: state becomes `IN_DESIGN`; the UI shows an increasing elapsed time.
6. Refresh the browser mid-session.
7. **Expected**: elapsed time is unchanged by the refresh (still increasing from the same
   baseline) — confirms FR-015's re-derivation guarantee, not a client-side stopwatch.
8. Pause the timer, wait a few seconds, resume it.
9. **Expected**: the paused interval is NOT counted toward active time; resuming continues
   accumulating.
10. **Verifies**: `startTimer`/`pauseTimer` (contracts/designer-assignment.md), `phaseDurations`.

## Scenario 4 — Concurrent-timer auto-pause (User Story 3, P1)

1. With the Scenario 3 Work Item's timer still running, start the timer on a second Work Item
   assigned to the same designer (assign one via Scenario 1 first if needed).
2. **Expected**: the first Work Item's timer auto-pauses (its active segment closes) the instant the
   second one starts; only the second shows as actively running.
3. **Verifies**: FR-012, the "one active timer per designer" rule.

## Scenario 5 — Upload a design version and mark complete (User Story 4, P2)

1. On an `IN_DESIGN` Work Item, try to mark it design-complete without uploading anything first.
2. **Expected**: blocked (FR-017).
3. Upload a file with a short note.
4. **Expected**: the version appears in the Work Item's history with the note; state is unchanged.
5. Mark it design-complete.
6. **Expected**: if its product type requires review, state becomes `WAITING_REVIEW`; if not,
   `APPROVED`. Either way, the active timer (if any) is closed, and `phaseDurations`' `totalPhaseDurationMs` is now a fixed number.
7. **Verifies**: `uploadDesignVersion`, `markDesignComplete`'s two chained transitions
   (research.md §5).

## Scenario 6 — Rework re-entry (User Story 5, P2)

1. Directly set a Work Item's state to `REWORK_REQUIRED` (simulating 013, not yet built) via a
   `WorkItemTransition` row with a `rejectionCategory` and `reason`/explanation, still assigned to
   the same designer.
2. As that designer, reload `/my-queue`.
3. **Expected**: the item reappears with a rework badge and the rejection details visible.
4. Start its timer.
5. **Expected**: state becomes `IN_DESIGN`; `phaseDurations`' `activeTimeMs` continues accumulating
   on top of whatever was recorded before the rejection, not reset to zero.
6. **Verifies**: FR-019/FR-020.

## Scenario 7 — Operator note: granting HEAD_DESIGNER reassignment rights (optional)

Not a functional scenario — a configuration note. By default only `RECEPTION` and `ADMIN_OWNER`
can reassign (Clarifications, 2026-09-23). To let a shop's Head Designer also reassign, an admin
adds `"workitem.assign_designer"` to the `HEAD_DESIGNER` row in `prisma/seed.ts`'s
`ROLE_SEED_DATA` and re-seeds — no code change beyond that data edit (data-model.md's Seed data
addition section).

