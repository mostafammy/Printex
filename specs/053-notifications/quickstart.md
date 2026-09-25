# Quickstart: Notifications & Delay Detection

Validation guide for the 053 feature branch. Proves the spec's acceptance criteria end-to-end.
Implementation details live in `tasks.md`; this file only says how to run and what to expect.

## Prerequisites

- Repo checked out on the 053 branch with `pnpm install` complete.
- **Deployment prerequisite**: the test database must be reachable and migrated. Integration tests hit a
  real Postgres instance (`pnpm test:db` prepares it); they are not mocked.
- The 053 migration applied: `pnpm db:generate` (or `pnpm db:migrate` against a prepared database).
- `config/053-notifications.yaml` seeded with the five default thresholds (4h / 1h / 2h / 8h / 24h).
- Seeded users covering the roles the acceptance criteria need: a designer, a head designer, a production
  operator, reception, and an admin/owner.
- For the internet-offline scenarios: the ability to disable the machine's network adapter (scenarios 10
  and 11 are best run on the LAN server itself, or by unplugging the WAN cable — the LAN must stay up, which
  is the actual requirement).

## Commands

```bash
pnpm check                                    # lint + typecheck — must pass before done
pnpm test                                     # full suite
pnpm vitest run tests/unit/notifications/     # ages, phase mapping, formatting, catalog
pnpm vitest run tests/integration/notifications/  # processor, center, scheduler, scope
pnpm vitest run tests/contract/notifications/     # 011 seam, 051 read, 001 vocabulary, aliases
pnpm dev                                      # manual exercise of the bell / thresholds / delayed list
```

## Validation scenarios (map to spec acceptance)

### 1. Rejection reaches the designer within 2 seconds (SC-001, US1 — issue acceptance #1)

1. Sign in as a head designer; sign in as a designer in a second browser (or an incognito window).
2. Create an order with a Work Item, assign it to the designer, and have the designer submit the design.
3. Reject the design as the head designer, and note the click time.
4. Watch the designer's screen **without refreshing**.

Expected: a notification appears in the designer's bell within 2 seconds, titled `تم رفض التصميم`, carrying
the rejection reason, and the unread badge increments. `pnpm vitest run tests/integration/notifications/
rejectionLatency.test.ts` asserts the same path server-side.

### 2. Processing the same event twice creates one notification (SC-002, US1 — issue acceptance #2)

1. Record one outbox event (any catalog type) via a normal business action.
2. Run `processOutboxBatch()` once; count the resulting notifications.
3. Force the event back to unprocessed (or call `processOutboxBatch()` concurrently from two promises).
4. Run it again.

Expected: the recipient has exactly one notification both times, and `count(Notification where
sourceEventId = X) === count(distinct userId)`. A duplicate insert raises a unique-constraint violation that
the processor catches and treats as success — the test asserts the *absence* of a second row, not the
absence of an error.

### 3. A threshold breach alerts once, not once per tick (SC-003, US2 — issue acceptance #3)

1. As admin, set the **review** threshold to 1 minute (`/admin/notifications`).
2. Park a Work Item in `WAITING_REVIEW` and leave it there.
3. Run `runDelayTick()` ten times in a row (or set the interval low and wait).

Expected: exactly one `work_item.phase_delayed` notification per configured recipient, one `DelayBreach`
row, and `SchedulerRun.alerted === 1` on the first tick and `0` on each of the next nine. The Work Item is
flagged delayed in `getDelayedWorkItems()` the whole time.

### 4. A re-breach alerts again (SC-044, US2)

1. With the item still in `WAITING_REVIEW` and already alerted, move it out of the phase and back in.
2. Run `runDelayTick()`.

Expected: a **new** `DelayBreach` row with `breachSequence = 2`, and a second alert. The old breach row is
retained.

### 5. Every catalog entry resolves to exactly its recipients (SC-004, US1)

1. Drive one event of each type in `contracts/event-catalog.md` through its emitter.
2. For each, read the resolved recipient set.

Expected: the set matches the catalog's `recipients` spec exactly — no under-notification, no
over-notification. `tests/contract/notifications/catalog.test.ts` walks the whole table. Alias coverage is
included: `workitem.rejected` (013's spelling) and `work_item.rejected` (the canonical) both resolve to the
same entry.

### 6. A user is never notified about work they cannot see (SC-005, US1/US3)

1. Create a Work Item in Digital production; assign the operator to Digital.
2. As a **Banner**-department operator, call `getDelayedWorkItems()` and `notificationCenter.list()`.
3. Confirm the Banner operator sees neither the Digital Work Item's delay nor any notification about it.

Expected: no rows, and `total` does not count them either. A notification retained after a transfer shows
`linkHref: null` rather than a navigable link.

### 7. Unread count is exact (SC-006, US3)

1. Generate five notifications for one user.
2. Read the bell; mark one read; mark all read; mark one unread again.

Expected: 5 → 4 → 0 → 1, exactly, on every re-read. `pnpm vitest run tests/integration/notifications/
unreadCount.test.ts` asserts the count matches a direct database count.

### 8. Audit events accompany every change (SC-007, US7)

1. Mark a notification read, mark all read, change a threshold, and trigger a manual scheduler run.
2. Read the audit log for each.

Expected: `notification.read`, `notification.read_all`, `notification.threshold_updated` (with the required
reason), and `notification.scheduler_triggered`, each with actor and timestamp, each committed atomically
with its change. A refused action writes none.

### 9. Delay detection never intervenes (FR-068, US2/US6)

1. Breach a threshold and record a Work Item's full state before and after `runDelayTick()`.
2. Attempt a `PricingStatus` read before and after.

Expected: identical Work Item state, identical pricing status, and no transition was blocked. The scheduler
only ever writes `Notification`, `DelayBreach`, `SchedulerRun`, and `SchedulerLease`.

### 10. Works with the internet unplugged (SC-008, US4 — issue acceptance #4)

1. Unplug the WAN cable (keep the LAN up).
2. Repeat scenarios 1, 3, 5, and 7 end to end.

Expected: identical behavior. No scenario needs an external service, and no error mentions DNS, a
certificate, or an unreachable host. This is the criterion constitution VII and PRD §52 exist for.

### 11. Fallback delivery is a complete path (FR-029/FR-034, US4)

1. Open the app; block the stream URL in devtools (or use a browser without SSE).
2. Trigger a rejection from another session.

Expected: the notification still appears, via polling, with the transport indicator showing the fallback
path. Nothing is lost — only the latency differs. Then unblock the stream and confirm the live path resumes
and the client catches up.

### 12. A missed scheduler window is evaluated on restart (FR-051, US2)

1. Park a Work Item past its threshold; stop the process.
2. Wait past several intervals; start the process.

Expected: the first tick on startup flags and alerts the item exactly once — the missed window is
evaluated, not skipped, and not replayed repeatedly.

### 13. Unknown event types are surfaced, not swallowed (FR-019, US5)

1. Insert an outbox row with `type: "totally.unknown.event"`.
2. Run `processOutboxBatch()`; open `/admin/notifications`.

Expected: the row is marked `UNMAPPED` (not `PROCESSED`), no notification is created, no error is raised,
and the type appears in the unmapped-types table with its count and last-seen time.

### 14. Only one scheduler runs at a time (FR-050, US2)

1. Call `startDelayScheduler()` twice in one process.
2. Then simulate two processes by calling `runDelayTick()` concurrently from two promises.

Expected: (1) creates one interval, not two; (2) one tick acquires the lease and the other skips, and the
`DelayBreach` unique constraint absorbs any overlap — so at most one alert per breach either way.

### 15. A terminal or skipped phase is never delayed (SC-011, FR-039/FR-040, US6)

1. Move a Work Item to `DELIVERED` after it was delayed.
2. Create a Work Item with `requiresDesign = false` and drive it straight to `READY_FOR_PRODUCTION`.

Expected: (1) it disappears from `getDelayedWorkItems()` immediately; (2) it is never design-delayed, and
the design threshold is never evaluated for it.
