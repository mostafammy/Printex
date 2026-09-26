---

description: "Task list for 053-notifications — internal notification center & delay detection"
---

# Tasks: Notifications & Delay Detection

**Input**: Design documents from `/specs/053-notifications/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — the constitution requires automated tests for permission checks, audit event emission, and gate behavior; spec acceptance criteria (SC-001…SC-016) are test-shaped, and the four criteria in PRI-17 are directly testable.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `prisma/`, `config/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature scaffold and configuration seeds

- [ ] T001 Create notifications module scaffold per plan.md structure: `src/server/notifications/index.ts` (placeholder barrel), `src/components/notifications/`, test dirs `tests/unit/notifications/`, `tests/integration/notifications/`, `tests/contract/notifications/`
- [ ] T002 [P] Create config seed `config/053-notifications.yaml` with the five default thresholds per spec FR-036: DESIGN 240min, REVIEW 60min, PRICING 120min, PRODUCTION 480min, COLLECTION 1440min, plus scheduler `intervalMinutes: 5` (FileConfig/YAML precedent: `config/052-finance.yaml`)
- [ ] T003 [P] Wire notifications test include paths into `vitest.config.ts` so `tests/{unit,integration,contract}/notifications/` are collected
- [ ] T004 [P] Add the `notifications` namespace to `src/messages/ar.json` plus `ops.alert.<type>` keys for 091's five ops events (091 contracts/backup-health.md §5), including every empty/error/validation string named in contracts/ui.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, catalog, and recipient resolution that EVERY story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create `prisma/schema/notifications.prisma` with all models from data-model.md, quoting each constraint: `Notification` (**`@@unique([sourceEventId, userId])`** — the idempotency boundary, research.md §1; write-once `title`/`body`/`linkHref`; mutable `readAt`/`archivedAt` only), `NotificationTypeOverride` (**`type` unique**; four recipient arrays; union-not-replace semantics, data-model.md §NotificationTypeOverride — FR-017), `DelayThreshold` (`phase` **unique**, `thresholdMinutes` nullable, three recipient arrays, `escalationMinutes`), `DelayBreach` (**`@@unique([workItemId, phase, breachSequence])`**, threshold snapshot, `escalated`/`escalatedAt`/`notifiedAt`), `SchedulerRun`, `SchedulerLease` (singleton)
- [ ] T006 Extend `prisma/schema/core.prisma`'s `NotificationEvent` per data-model.md §NotificationEvent: **reuse** 002's already-shipped reserved columns `deliveredAt DateTime?` and `deliveryStatus String?` (do **not** add a parallel `processedAt`/`processingStatus` pair — FR-006), retype `deliveryStatus` to the new `DeliveryStatus` enum, add the four new columns `attemptCount Int @default(0)`, `lastAttemptAt DateTime?`, `lastError String?`, `recipientPermissions String[] @default([])` — and extend `src/server/core/notifications/notify.ts`'s `NotifyEvent` with the optional `permissions` field (FR-016, additive; flag to Fady per plan.md)
- [ ] T007 Create migration `prisma/schema/migrations/<timestamp>_notifications/`: **six** tables, the four new `notification_event` columns plus the `deliveryStatus` retype, all indexes from data-model.md (`notification(userId, readAt, createdAt)`, `notification(userId, type, createdAt)`, `notification(sourceEventId)`, `notification_event(deliveredAt, deliveryStatus, createdAt)`, `notification_event(type, createdAt)`, `delay_breach(workItemId, phase)`, `scheduler_run(startedAt)`), the `deliveryStatus IS NULL → 'PENDING'` backfill **before** the index (shipped features 012/013/014/015/016 already have rows in the outbox — without the backfill the claim predicate silently skips every one of them), `CHECK (thresholdMinutes IS NULL OR thresholdMinutes > 0)`, the five seeded `DelayThreshold` rows from the Clarification defaults, and the single `SchedulerLease` row
- [ ] T008 [P] Implement `src/server/notifications/errors.ts`: the SCREAMING_SNAKE codes shared across the feature (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `NOTIFICATION_NOT_FOUND`, `INVALID_THRESHOLD`, `INVALID_ESCALATION`, `UNKNOWN_ROLE`, `UNKNOWN_PERMISSION`, `UNKNOWN_DEPARTMENT`, `OUTBOX_UNAVAILABLE`, `STREAM_CAPACITY`)
- [ ] T009 [P] Implement `src/server/notifications/recipients.ts`: `resolveRecipients(spec)` per contracts/notification-service.md — four-mode union (explicit ids, `UserRole`, `UserDepartment`, `RolePermission ∪ UserPermission`) restricted to **active** users (`isActive = true`), deduplicated by user; an unrecognized role/permission string contributes nothing and never throws. It **unions** the type's `NotificationTypeOverride` row (FR-017, data-model.md §NotificationTypeOverride) with the spec it is given — a non-empty override array adds recipients and never removes the catalog's own, so a missing override row is a `null` read on an indexed unique column, not a join (FR-001, FR-002, FR-003)
- [ ] T010 [P] Implement `src/server/notifications/delays.ts` age derivation per research.md §8: `waitingSince(state)` mapping `WorkItemState` → the open `PhaseTiming` QUEUE segment's `startedAt`, and PRICING → `051`'s `pendingSince(workItemId)`; plus `formatAge(minutes)` → the single Arabic formatter used by the catalog, the delayed list, and notification bodies (SC-012 renders one way everywhere) (FR-038)
- [ ] T011 Implement `src/server/notifications/catalog.ts` per contracts/event-catalog.md: the `Events` constant object (every emitter references a constant, never a literal), `lookup(type)` matching canonical **or** alias (research.md §4), `renderEntry(entry, ctx)` producing `{title, body, linkHref, recipients, severity}` with a body-function failure degrading to title-only rather than dropping the event
- [ ] T012 Freeze `src/server/notifications/index.ts` barrel exporting the public surface only, consistent with `src/server/pricing/index.ts` and `src/server/finance/index.ts` style (FR-011)
- [ ] T013 [P] Contract test `tests/contract/notifications/catalog.test.ts`: every entry in contracts/event-catalog.md resolves by canonical type; `workitem.rejected` and `work_item.rejected` both hit one entry; `work_item.state_changed` is `TRIGGER` and never produces a notification; `customer.ready_for_collection` produces none; every entry has a non-empty Arabic title
- [ ] T014 [P] Contract test `tests/contract/notifications/vocabulary.test.ts`: 053 adds **no** permission key — `ALL_PERMISSIONS` is unchanged; every `RoleKey` in the catalog exists in `ALL_ROLE_KEYS`; every `Permission` in the catalog exists in `ALL_PERMISSIONS`
- [ ] T015 [P] Unit test `tests/unit/notifications/ages.test.ts`: state→phase mapping for all 15 states; a Work Item in a terminal state maps to no phase; `requiresDesign = false` never maps to a design phase; PRICING age reads 051's `waitingSince` and is independent of workflow state (PRD §55 Rule 9)
- [ ] T016 [P] Unit test `tests/unit/notifications/formatAge.test.ts`: one shared formatter renders `2h 14m` / `٣س ١٤د` identically for the catalog body, the delayed list, and the notification page

**Checkpoint**: Foundation ready — every story can now be implemented against a real schema, a real catalog, and a real resolver

---

## Phase 3: User Story 1 - The right employee hears about the right event within seconds (Priority: P1) 🎯 MVP

**Goal**: An outbox processor that resolves recipients and creates exactly one notification per user, so a rejection reaches the responsible designer in seconds

**Independent Test**: Drive each catalog event through its emitter and confirm the exact recipient set receives one notification with the right Arabic title and a working deep link; process the same event twice and confirm one row

### Tests for User Story 1 (required — constitution: permissions + audit + reliability)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T017 [US1] Integration test `tests/integration/notifications/processorIdempotency.test.ts`: **SC-002 / issue acceptance #2** — process one event, assert exactly one `Notification` per resolved user; then force the event back to unprocessed and process again, assert the row count is unchanged and the unique violation was caught as success
- [ ] T018 [P] [US1] Integration test `tests/integration/notifications/processorConcurrent.test.ts`: two concurrent `processOutboxBatch()` calls over the same batch → one claim wins, no duplicate notification, no unhandled rejection
- [ ] T019 [P] [US1] Integration test `tests/integration/notifications/recipientResolution.test.ts`: **SC-004** — explicit user, role, department, and permission modes each resolve correctly; a user matching by two modes receives **one** notification; a deactivated user is excluded; an event resolving to zero recipients is marked `PROCESSED` with no error and no notification (FR-004)
- [ ] T020 [P] [US1] Integration test `tests/integration/notifications/rejectionLatency.test.ts`: **SC-001 / issue acceptance #1** — a rejection through 013's server path creates the designer's notification within 2s, with the rejection reason in the body
- [ ] T021 [P] [US1] Contract test `tests/contract/notifications/eventAliases.test.ts`: every type 012/013/014/015/016/091 actually emits resolves to a catalog entry; unmapped types are marked `UNMAPPED`, produce no notification, and raise no error (FR-019) (FR-035)
- [ ] T082 [P] [US1] Contract test `tests/contract/notifications/noHardcodedRecipients.test.ts`: **SC-015 (first clause)** — walk every catalog entry's recipient specification and assert each `userIds` / `roles` / `departmentIds` / `permissions` value is either a valid `RoleKey`, a valid `Permission`, an active `Department` id, or a seeded fixture user id — and that no entry carries a display name or free-text person string; also assert `DelayThreshold` and `NotificationTypeOverride` rows are the only per-recipient data, so the criterion is falsifiable by a future catalog edit
- [ ] T076 [P] [US1] Integration test `tests/integration/notifications/outboxBackfill.test.ts`: **A-001 regression** — a `NotificationEvent` row already in the outbox before the migration (`deliveryStatus IS NULL`) is claimed and processed exactly once after the backfill, not skipped by the claim predicate; the seeded pre-migration rows from 012/013/014 produce their notifications
- [ ] T080 [P] [US1] Integration test `tests/integration/notifications/crashRecovery.test.ts`: **SC-013 (clause a)** — kill the process in the window between the per-event transaction's notification writes and its outbox `PROCESSED` mark (fault-inject by aborting inside the transaction, not by timing), restart, and assert the event is re-claimed and yields **exactly one** `Notification` per resolved user — the `@@unique([sourceEventId, userId])` pair is what makes this safe, so this test proves the property rather than assuming it; assert no duplicate and no lost event. Distinct from T017 (same-process reprocessing, SC-002) and T076 (migration backfill)

### Implementation for User Story 1

- [ ] T022 [US1] Implement `processOutboxBatch(limit)` in `src/server/notifications/processor.ts` per contracts/notification-service.md: conditional-UPDATE claim of `PENDING` rows ordered by `createdAt` (FIFO, FR-009) → catalog lookup by canonical or alias → `resolveRecipients` → insert one `Notification` per user with captured title/body/link (FR-018) → mark `PROCESSED` with `deliveredAt`, all in **one transaction per event** (FR-005); catch the unique violation as success (FR-007); per-event failure marks `FAILED` + `attemptCount` without `deliveredAt` and stops retrying after 5 (FR-008); `TRIGGER` and `RECORDED_ONLY` types mark `PROCESSED` and produce nothing (`RECORDED_ONLY` differs from `UNMAPPED`: it is a *known* type with a deliberately empty audience, so it drains without raising the Admin's unmapped counter)
- [ ] T023 [P] [US1] Create `src/server/notifications/derived.ts` implementing the `work_item.state_changed` derivation per contracts/event-catalog.md (pure mapping — names catalog entries, never queries or writes), covering: `src/server/notifications/derived.ts`: `to === WAITING_REVIEW` → `work_item.awaiting_review` to `design.review` holders; `to === READY_FOR_PRODUCTION` → `work_item.ready_for_production` to the department; `to === IN_PRODUCTION` → `work_item.production_started`; production-side + order `URGENT` → `work_item.urgent` to department + `RECEPTION`; a user matching two derived entries on one transition receives one notification at the higher severity (research.md §5)
- [ ] T024 [US1] Wire `processOutboxBatch` to run immediately after each business write that emits an event — a post-commit hook in the server request path, not only on the scheduler interval, so the 2-second criterion does not depend on the tick (FR-028, research.md §1 rationale). Must run **after** commit, never inside the caller's transaction
- [ ] T025 [US1] Freeze the public exports: `processOutboxBatch`, `resolveRecipients`, `Events`, `lookup`, `renderEntry` from `src/server/notifications/index.ts`

**Checkpoint**: US1 functional — every catalog event is delivered exactly once to exactly the right people

---

## Phase 4: User Story 2 - A late job is flagged once, to the people who can unblock it (Priority: P1)

**Goal**: Per-phase threshold detection with exactly one alert per breach, driven by a leased in-process scheduler

**Independent Test**: Set a threshold to 1 minute, park a Work Item in each phase, run the tick ten times, confirm one alert per breach and one delayed flag; resolve and re-breach, confirm a second alert

### Tests for User Story 2 (required — constitution: permissions + audit + gate integrity)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T026 [US2] Integration test `tests/integration/notifications/oncePerBreach.test.ts`: **SC-003 / issue acceptance #3** — ten consecutive `runDelayTick()` calls over one unchanged breach produce exactly one `DelayBreach`, one alert per configured recipient, and `SchedulerRun.alerted` of 1 then 0 nine times
- [ ] T027 [P] [US2] Integration test `tests/integration/notifications/rebreach.test.ts`: a Work Item that leaves a delayed phase and returns gets `breachSequence = 2` and a **new** alert; the prior breach row is retained (FR-044 — SC-010 is the all-phases case and is covered by T026/T061)
- [ ] T028 [P] [US2] Integration test `tests/integration/notifications/schedulerLease.test.ts`: **FR-050** — two concurrent `runDelayTick()` calls → one acquires the lease, one skips; `startDelayScheduler()` twice creates one interval
- [ ] T029 [P] [US2] Integration test `tests/integration/notifications/detectionIsInert.test.ts`: **FR-068 / US2 + US6** — a full tick changes no `WorkItem` state and no `PricingStatus`; no transition is blocked; a terminal Work Item is never flagged (FR-039) (FR-046, FR-048)
- [ ] T030 [P] [US2] Integration test `tests/integration/notifications/missedWindow.test.ts`: **FR-051 / SC-013 (clause b)** — a Work Item parked past its threshold while the process is down is flagged and alerted exactly once on the first tick after startup
- [ ] T031 [P] [US2] Integration test `tests/integration/notifications/thresholdChangeEffect.test.ts`: **FR-045** — lowering a threshold flags and alerts already-waiting Work Items on the next tick with no restart; a Work Item no longer exceeding the raised threshold drops out of the delayed query
- [ ] T078 [P] [US2] Integration test `tests/integration/notifications/schedulerStopStart.test.ts`: **FR-054** — `stopDelayScheduler()` clears the interval, releases the lease so `schedulerStatus()` reports stopped, and is a no-op when already stopped; restarting after a stop still yields **exactly one** alert per existing breach (the `DelayBreach` rows survive the stop, so a stop/start cycle cannot double-alert)
- [ ] T081 [P] [US2] Integration test `tests/integration/notifications/bulkBreach.test.ts`: **SC-014** — seed 200 Work Items breaching across all 5 `DelayPhase` values, run one tick, then run three more; assert the alert count equals the number of breached Work Items and is **unchanged** by the extra ticks (one alert per breach, not one per tick), no scheduler error, and every `DelayBreach` sequence correct

### Implementation for User Story 2

- [ ] T032 [US2] Implement `getDelayedWorkItems(actor, filter)` and `getDelayedWorkItemIds()` in `src/server/notifications/delays.ts` per contracts/notification-service.md: non-terminal Work Items only, waiting age from the research.md §8 anchors, exceeding an enabled threshold, derived at query time with no stored column (FR-059); actor scope per contracts/authorization-audit.md (FR-057)
- [ ] T033 [US2] Implement `runDelayTick()` in `src/server/notifications/scheduler.ts`: conditional lease acquisition (single UPDATE where absent or expired) → insert `SchedulerRun` (`RUNNING`) → evaluate each non-terminal Work Item's current phase → for each newly-breached item insert `DelayBreach` + `work_item.phase_delayed` notifications **in one transaction** (FR-042/FR-043) → complete the run row; catch every throw, record `ERROR` on the run row, never propagate into the request path (FR-052)
- [ ] T034 [US2] Implement `startDelayScheduler()` / `stopDelayScheduler()`: idempotent interval creation, an immediate tick on start so a missed window is evaluated (FR-051), interval from config (seed 5 minutes, FR-049), and the PRICING phase's `work_item.pricing_delayed` using 051's `pendingSince` with PRD §27's exact body wording (FR-037, FR-047, FR-049)
- [ ] T035 [US2] Bind the scheduler start to the server process's boot path, guarded so a hot reload in dev does not stack intervals; add `runDelayTick` to the manual-trigger path behind `admin.config`

**Checkpoint**: US2 functional — a late job is flagged once, alerted once, and observable

---

## Phase 5: User Story 3 - Each employee has one place to see everything that needs them (Priority: P1)

**Goal**: Bell with unread count, dropdown, and a full page with mark read/unread and deep links

**Independent Test**: Generate notifications for one user, confirm the count matches, open the dropdown, mark read individually and in bulk, navigate from a notification, confirm it survives a reload

### Tests for User Story 3 (required — constitution: permissions + audit)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T036 [US3] Integration test `tests/integration/notifications/unreadCount.test.ts`: **SC-006** — the count from `unreadCount(actor)` equals a direct database count after every mark read/unread/mark-all transition
- [ ] T037 [P] [US3] Integration test `tests/integration/notifications/centerScope.test.ts`: **FR-025** — `markRead` on another user's notification is `NOTIFICATION_NOT_FOUND`, never a silent success; a list row whose target is out of scope returns `linkHref: null` and no body; `markAllRead` touches only the actor's own rows
- [ ] T038 [P] [US3] Integration test `tests/integration/notifications/auditEmission.test.ts`: **SC-007** — `notification.read`, `notification.read_all`, and `notification.unread` are written with actor and timestamp in the same transaction; `markAllRead` writes **one** event carrying the count, not one per row; a no-op `markRead` on an already-read row writes nothing

### Implementation for User Story 3

- [ ] T039 [US3] Implement `src/server/notifications/center.ts`: `list` / `unreadCount` / `markRead` / `markUnread` / `markAllRead` per contracts/notification-service.md — all scoped `WHERE userId = actor.userId`; type filters expand aliases to canonical (FR-015); the read-query withholds `linkHref`/`body` for out-of-scope targets and for hard-removed entities without throwing (FR-025, spec Edge Cases) (FR-012, FR-013, FR-014, FR-020, FR-022, FR-023)
- [ ] T040 [P] [US3] Create `src/components/notifications/NotificationBell.tsx` + `NotificationDropdown.tsx` per contracts/ui.md: Server Component reading `unreadCount(actor)`, `99+` display bound over an exact count, Arabic labels, `role="menu"` with arrow keys and Escape, empty and error states in Arabic
- [ ] T041 [US3] Wire the bell into `src/app/(shell)/layout.tsx` as a shell header row (not a floating overlay, which would collide with the sidebar's positioning and the logical-property lint); add Server Actions `markReadAction` / `markUnreadAction` / `markAllReadAction` under the feature
- [ ] T042 [P] [US3] Create `src/app/(shell)/notifications/page.tsx` + `NotificationList.tsx`: All/Unread/Read and type filters via URL search params, 20/page newest-first, absolute timestamps, `السابق`/`التالي` disabled at the ends, Arabic empty state per filter (FR-021, FR-026)
- [ ] T043 [US3] Verify no `DELETE` path against `notification` exists in any server entry point (FR-024) and add the test that proves it (SC-007's immutability half)

**Checkpoint**: US3 functional — every employee has a working, accurate notification center

---

## Phase 6: User Story 4 - New notifications arrive without the employee asking (Priority: P2)

**Goal**: LAN real-time push within 2 seconds, with polling fallback that is a complete delivery path

**Independent Test**: Hold a session open, trigger a rejection from another session, measure time-to-appearance; then block the stream and confirm delivery still happens

### Tests for User Story 4 (required — constitution: local-first, no external dependency)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T044 [US4] Integration test `tests/integration/notifications/streamDelivery.test.ts`: **FR-028 / SC-001** — a connected client receives the `notification` signal within 2s of creation; the signal payload carries **only** id/type/severity, never title, body, or link (FR-010, stream contract)
- [ ] T045 [P] [US4] Integration test `tests/integration/notifications/streamIsolation.test.ts`: **FR-032** — an unauthenticated stream request is 401; a connection whose session ends is closed; no user's notifications are ever written to another user's connection
- [ ] T046 [P] [US4] Integration test `tests/integration/notifications/streamCapacity.test.ts`: **FR-033** — a saturated connection drops the *signal* without losing the notification (the persisted row still exists and the next poll finds it); a dead connection is reclaimed within one tick
- [ ] T047 [US4] Integration test `tests/integration/notifications/fallbackCompleteness.test.ts`: **FR-034 / SC-009** — a notification created while a client is disconnected is present after reconnect and on the next poll; nothing is lost because the transport was unavailable

### Implementation for User Story 4

- [ ] T048 [US4] Implement `src/server/notifications/stream.ts`: the in-process registry (user id → connection set), `publish(userId, signal)` writing only to that user's connections, per-connection write-in-flight bound, dead-connection reclamation, a total-connection cap returning 503 beyond it, and no cross-user delivery — the publish id always comes from the notification's own `userId`
- [ ] T049 [US4] Create `src/app/api/notifications/stream/route.ts` per contracts/notification-stream.md: `text/event-stream`, `getActor()` first, `ready` then `retry` events, one `notification` event per creation carrying identifiers only, a `count` event for the badge, a 25s ping comment, abort handling, and `X-Accel-Buffering: no`
- [ ] T050 [US4] Call `publish` from the processor **after** each event's transaction commits (never inside it), so a rolled-back event never produces a signal
- [ ] T051 [P] [US4] Create `src/components/notifications/use-notification-stream.ts`: opens the stream, falls back to a 15s `unreadCount` poll on any error or on a browser without SSE, exposes `{connected, transport}` for the indicator, re-reads on tab visibility change, and cleans up on unmount (FR-030) (FR-029, FR-031)

**Checkpoint**: US4 functional — notifications appear without a refresh, and the fallback is complete

---

## Phase 7: User Story 5 - The person responsible for configuring alerts can set them (Priority: P2)

**Goal**: An Admin screen for the five thresholds, their recipients, escalation inputs, and scheduler observability

**Independent Test**: Change every threshold and recipient list through the screen, confirm the next tick uses the new values and every change is audited

### Tests for User Story 5 (required — constitution: permissions + audit)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T052 [US5] Integration test `tests/integration/notifications/thresholdAuthz.test.ts`: **US5 scenario 4** — a user without `admin.config` is refused on read-write and on submit, with nothing stored and no audit event; a non-positive threshold and an escalation below the threshold are `VALIDATION` with nothing written (FR-062)
- [ ] T053 [P] [US5] Integration test `tests/integration/notifications/thresholdValidation.test.ts`: unknown RoleKey, unknown Permission, and unknown Department are each rejected with their specific code; a valid update writes `notification.threshold_updated` with actor, before, after, and the required reason in the same transaction (SC-007)
- [ ] T054 [P] [US5] Integration test `tests/integration/notifications/emptyRecipients.test.ts`: **US5 scenario 2** — a phase with an empty recipient list still flags the Work Item delayed and still returns it from `getDelayedWorkItems`, but sends no alert (FR-041)
- [ ] T077 [P] [US5] Integration test `tests/integration/notifications/recipientOverride.test.ts`: **FR-017** — an override **unions** with the catalog default (a non-empty `roles` array adds recipients and never removes the default's); no override row leaves the default untouched; `setRecipientOverride` with an unknown type, an unknown role/permission/department, or an empty reason is `VALIDATION` and writes nothing; `clearRecipientOverride` DELETEs the row and writes `notification.recipient_override_updated` with its required reason; a non-`admin.config` actor gets `FORBIDDEN` and writes nothing

### Implementation for User Story 5

- [ ] T055 [US5] Implement `src/server/notifications/thresholds.ts`: `read()`, `update(actor, input)` with `authorize(actor, "admin.config")`, Zod validation against `ALL_ROLE_KEYS`/`ALL_PERMISSIONS`/active `Department`s, a required reason validated **before** `audit.record` (052's pattern), and `schedulerStatus()` aggregating the lease, the latest `SchedulerRun`, and the unmapped-type counts (FR-019, FR-053) (FR-061)
- [ ] T079 [P] [US5] Create `src/server/notifications/overrides.ts` implementing contracts/notification-service.md §`recipientOverride` / `setRecipientOverride` / `clearRecipientOverride`: `recipientOverride(type)` reads `NotificationTypeOverride` by canonical type (`null` when absent — the union read T009 calls, one indexed hit, no join); `setRecipientOverride(actor, input)` authorizes `admin.config`, Zod-validates `type` against the catalog (unknown type is `VALIDATION`, never a dormant row) and the four recipient arrays against `ALL_ROLE_KEYS`/`ALL_PERMISSIONS`/active `Department`s, requires a non-empty `reason`, and upserts the row + writes `notification.recipient_override_updated` with the **required** reason in one transaction; `clearRecipientOverride(actor, type, reason)` DELETEs the configuration row and writes the same audit action (FR-017, FR-062) — the only `DELETE` in 053, and it removes configuration, never history
- [ ] T056 [US5] Create `src/app/(shell)/admin/notifications/page.tsx` + `ThresholdsScreen.tsx` per contracts/ui.md: one row per phase with an enable toggle, duration input, recipient pickers, and escalation input; scheduler panel with running state, last run, counts, and next run; a `تشغيل الفحص الآن` button behind `admin.config`; a `تشغيل الفحص التلقائي` / `إيقاف الفحص التلقائي` toggle whose label reflects current state (**FR-054** — startable and stoppable without a redeploy); the per-catalog-type recipient-override editor with its catalog default shown, a `إلغاء التجاوز` action, and a **required** reason field on save (**FR-017**); the unmapped-types table
- [ ] T057 [US5] Add the `admin/notifications` and `delayed` nav entries to `src/app/(shell)/nav.ts` using the existing `ADMIN: RoleKey` constant; add `updateThresholdsAction`, `triggerSchedulerAction`, `setRecipientOverrideAction`, and `stopSchedulerAction` Server Actions with inline Arabic validation messages (an empty reason on an override save is rejected client-side with `السبب مطلوب` before the request)

**Checkpoint**: US5 functional — an Admin can configure and observe alerting

---

## Phase 8: User Story 6 - Every screen can ask "what is late, and whose fault is it?" (Priority: P2)

**Goal**: The delayed-work query surfaced in 011's reception queue badge and 053's own delayed list

**Independent Test**: Compare the query and the queue badge across the same data as three roles; confirm each sees only their scope

### Tests for User Story 6 (required — constitution: permission checks per role)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T058 [US6] Integration test `tests/integration/notifications/delayedQueryScope.test.ts`: **SC-005 / US6 scenario 3** — a Banner-department operator sees neither a Digital Work Item's delay nor a count that reveals it; a designer sees only assigned work; reception and admin see the whole shop
- [ ] T059 [P] [US6] Contract test `tests/contract/notifications/receptionQueueSeam.test.ts`: **FR-058** — `getDelayedWorkItemIds()` is consumable as 011's `opts.getDelayedWorkItemIds` callback, and 011's `listReceptionQueue(actor)` works correctly and marks nothing delayed when the callback is not supplied (011 FR-008a)
- [ ] T060 [P] [US6] Contract test `tests/contract/notifications/delayedViewShape.test.ts`: `DelayedWorkItemView` carries `waitingSince`, `waitingAgeMinutes`, `phase`, and `responsibleDepartmentId`/`Name` for every row (FR-055, US6 scenario 4)
- [ ] T061 [P] [US6] Integration test `tests/integration/notifications/terminalAndSkipped.test.ts`: **SC-011** — a `DELIVERED` Work Item drops out of the query immediately after breaching; a `requiresDesign = false` Work Item is never design-delayed (FR-039/FR-040)

### Implementation for User Story 6

- [ ] T062 [US6] Bind `opts.getDelayedWorkItemIds` in `src/app/(shell)/reception/page.tsx` and add a `متأخر` badge to 011's existing status-badge cell; leave 011's query, authorization, and ordering untouched (FR-058, quickstart §15) (FR-056)
- [ ] T063 [P] [US6] Create `src/app/(shell)/delayed/page.tsx` + `DelayedList.tsx`: phase/priority/department/date filters, a table with order #, customer, product, phase, server-computed age, responsible department, and priority, each row linking straight to the Order; a distinct empty state explaining when no threshold is enabled for a phase

**Checkpoint**: US6 functional — reception and management can see what is late and whose it is

---

## Phase 9: User Story 7 - A notification is a pointer, never the record (Priority: P2)

**Goal**: Every notification-producing action keeps its own audit record, and the outbox retains the full recipient specification after processing

**Independent Test**: Take an event, inspect the audit log, mark every notification read, confirm the audit record and the outbox row are unchanged and independently readable

### Tests for User Story 7 (required — constitution: append-only history)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T064 [US7] Integration test `tests/integration/notifications/auditIsIndependent.test.ts`: **SC-007 / US7 scenario 1** — every notification-producing action has its own `AuditEvent` with actor and timestamp, independent of the `Notification` row; marking every notification read changes no audit record of the underlying action (FR-060)
- [ ] T065 [P] [US7] Integration test `tests/integration/notifications/contentIsWriteOnce.test.ts`: **FR-018 / US7 scenario 4** — after creation, a Work Item's state, customer name, and a catalog template change leave the notification's captured title, body, and link unchanged
- [ ] T066 [P] [US7] Integration test `tests/integration/notifications/outboxReconstruction.test.ts`: **FR-063 / US7 scenarios 2-3** — the outbox row retains `recipientUserIds`/`recipientRoles`/`recipientDepartmentIds`/`recipientPermissions` and its processed status after delivery, so the recipient set and delivery outcome can be reconstructed without the notifications

### Implementation for User Story 7

- [ ] T067 [US7] Verify and document that no `notification.created` audit event is written per notification (contracts/authorization-audit.md) — the outbox row is the delivery audit trail; add a test asserting the audit log is **not** multiplied by the recipient count
- [ ] T068 [US7] Add the `audit.view`-gated outbox inspection (processed/failed/unmapped with counts and last-seen) to the thresholds screen's unmapped-types area, so an Admin can reconstruct delivery without log access (FR-006, US7 scenario 3)

**Checkpoint**: US7 functional — the record survives the notification

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T069 [P] Run `pnpm check` and `pnpm test`; confirm both pass clean (constitution Development Workflow)
- [ ] T070 [P] Verify the RTL logical-property lint passes across every new component and the shell layout change (constitution IX, 002 SC-007 precedent)
- [ ] T071 [P] Confirm every emitter still passes the **same** `tx` the triggering write used — 053 must not have changed any existing `notify()` call site's transaction boundary; likewise confirm 053 does **not** send to WhatsApp or any external channel, does not send email/SMS/push, does not decide when a domain event happens, adds no per-user notification preferences, does not build the dashboard/portal/quoting inbox, and adds no working-hours calendar or multi-tier escalation ladder (FR-064, FR-065, FR-066, FR-067, FR-069, FR-070 — these MUST NOTs are verified by absence, which is why they carry no build task)
- [ ] T072 Performance smoke per SC-012: notification visible within 2s p95, bell + first dropdown page < 500ms p95, `getDelayedWorkItems` first page < 500ms p95 on a full shop
- [ ] T073 [P] Backup scope confirmation: all six tables are inside the existing primary PostgreSQL database and therefore inside the existing DB backup set; 053 adds no new persistent store (constitution Backups) (FR-027)
- [ ] T074 Verify constitution VII end-to-end: run quickstart §10 and §11 with the WAN cable unplugged, confirming every scenario behaves identically (SC-008)
- [ ] T075 Confirm the outbox drains: after a full day of seeded activity, no row is left in `PENDING` and no row is stuck retrying

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational → 🎯 MVP
- **US2 (Phase 4)**: Depends on Foundational (the delayed query) + US1's `Notification` writer; the scheduler and the processor are independent at runtime
- **US3 (Phase 5)**: Depends on US1 (notifications must exist to be read)
- **US4 (Phase 6)**: Depends on US1 (the stream signals on processor output)
- **US5 (Phase 7)**: Depends on US2 (it configures and observes the scheduler)
- **US6 (Phase 8)**: Depends on US2's `getDelayedWorkItems`; the 011 binding is independent of US3/US4
- **US7 (Phase 9)**: Depends on US1 (the outbox and the notifications it produced)
- **Polish (Phase 10)**: Depends on all stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational only → independent MVP
- **US2 (P1)**: Foundational only (writes the same `Notification` rows as US1)
- **US3 (P1)**: US1
- **US4 (P2)**: US1
- **US5 (P2)**: US2
- **US6 (P2)**: US2
- **US7 (P2)**: US1

### Within Each Story

- Tests first (must FAIL before implementation) → services → components → routes/actions → checkpoint

### Parallel Opportunities

- Setup: T002 ∥ T003 ∥ T004 · Foundational: T008 ∥ T009 ∥ T010 ∥ T013 ∥ T014 ∥ T015 ∥ T016
- US1 tests: T017 ∥ T018 ∥ T019 ∥ T020 ∥ T021 · US1 impl: T023 ∥ T025
- US2 tests: T027 ∥ T028 ∥ T029 ∥ T030 ∥ T031 · US2 impl: T032 ∥ T034
- US3 tests: T037 ∥ T038 · US3 components: T040 ∥ T042
- US4 tests: T045 ∥ T046 ∥ T047 · US4 impl: T048 ∥ T051
- US5 tests: T053 ∥ T054 · US5 impl: T055 ∥ T056 ∥ T057
- US6 tests: T058 ∥ T059 ∥ T060 ∥ T061 · US6 impl: T062 ∥ T063
- US7 tests: T065 ∥ T066 · Polish: T069 ∥ T070 ∥ T071 ∥ T073
- After Foundational: US1 ∥ US2 (separate files, both write `Notification`) staffed in parallel; then US3/US4 off US1, US5/US6 off US2, US7 off US1

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together first (must fail):
Task: "T017 integration test tests/integration/notifications/processorIdempotency.test.ts"
Task: "T018 integration test tests/integration/notifications/processorConcurrent.test.ts"
Task: "T019 integration test tests/integration/notifications/recipientResolution.test.ts"
Task: "T020 integration test tests/integration/notifications/rejectionLatency.test.ts"
Task: "T021 contract test tests/contract/notifications/eventAliases.test.ts"

# Then parallel implementation (different files):
Task: "T023 derived events src/server/notifications/derived.ts"
Task: "T025 freeze barrel src/server/notifications/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart §1, §2, and §5 — a rejection reaches the designer in seconds, exactly once, to exactly the right people
5. Ship: the notification rows already exist and are readable by any query, so the feature delivers value before any UI lands

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Test independently → **MVP**: rejection, assignment, and every catalog event delivered correctly
3. US2 → Test independently → Delay detection: a late job flagged once and alerted once
4. US3 + US4 → Test independently → The employee can see it, live
5. US5 + US6 → Test independently → Configurable thresholds, and the queue/dashboard surfaces
6. US7 → Test independently → The record is provably independent of the notification

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (processor) then US3 (center)
   - Developer B: US2 (scheduler) then US5 + US6
   - Developer C: US4 (stream) then US7
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No task may add a permission key: the vocabulary is frozen in 001 and 053 reuses `admin.config` + `audit.view`
- The `@@unique([sourceEventId, userId])` pair and the `@@unique([workItemId, phase, breachSequence])` pair are the two guarantees that make the spec's idempotency and once-per-breach requirements structural rather than conventional — never "optimize away"
- `work_item.state_changed` is a TRIGGER, never a delivered notification; do not add a recipient list to it
- The `workitem.*` / `work_item.*` split is handled by aliases; do not rename an existing emitter as part of 053
- 053 must not import `~/server/collection`, `~/server/changes`, or any 015/016/091 module at compile time — their event types are catalog entries, nothing more
- 053 must import `Actor` from `~/server/auth`, never `~/server/core` (the core `Actor` lacks `permissions`)
- The scheduler and processor run under a system identity, not a signed-in `Actor`; only their manual trigger is `admin.config`-authorized
- Commit after each task or logical group; stop at each checkpoint to validate the story independently
