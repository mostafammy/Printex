# Data Model: Notifications & Delay Detection

Source: [spec.md](./spec.md) Key Entities + Functional Requirements, resolved against
[research.md](./research.md). This is the authoritative shape for `prisma/schema/notifications.prisma`.

## Ownership boundary

`User`, `Role`, `UserRole`, `UserDepartment`, `AuditEvent`, and the `Permission` vocabulary remain owned by
001. `Order`, `WorkItem`, `WorkItemState`, `PhaseTiming`, `NotificationEvent`, and `notify()` remain owned by
002/011. `ProductType` is 011's. `PricingStatus.waitingSince` and `pendingSince()` are 051's. `Return` is 013's.
`FileAsset` and design versions are 050/012/014's. Collection policy and discrepancy records are 015's.
Specification versions and change requests are 016's. Operational alert reports are 091's.

053 adds `Notification`, `DelayThreshold`, `DelayBreach`, `SchedulerRun`, and the `NotificationEvent` columns
listed under "Changes to 002's table" — the outbox row itself stays 002's model; 053 is its only reader and the
only writer of its processing columns. `DelayThreshold` is 053-owned configuration data associated with a
phase, not a mutation of any existing model.

## Changes to 002's `NotificationEvent`

The outbox table is 002's. 053's migration adds the processing columns; no other feature writes them
(002 contracts/notifications.md reserves them for 053).

| Field | Type | Notes |
|---|---|---|
| `processedAt` | DateTime? | set once when the event is fully processed; null = unprocessed |
| `processingStatus` | DeliveryStatus? | PENDING / PROCESSED / FAILED / UNMAPPED |
| `attemptCount` | Int | default 0; incremented per processing attempt (FR-008) |
| `lastAttemptAt` | DateTime? | UTC; for Admin diagnosis of a stuck event |
| `lastError` | String? | failure reason; cleared on eventual success |
| `recipientPermissions` | String[] | **new addressing mode** (FR-002/FR-016); default `[]`, additive to the three existing columns |

`processedAt IS NULL AND processingStatus = 'PENDING'` is the claim predicate the processor uses to select
work; setting it and creating the notifications happen in one transaction (FR-005).

`UNMAPPED` is distinct from `PROCESSED`: both produce no notification, but `UNMAPPED` additionally increments
the Admin-visible unmapped-type counter (FR-019, research.md §9).

## Entities

### Notification

| Field | Type | Rules |
|---|---|---|
| `id` | String | PK, cuid |
| `userId` | String | required FK to 001 User; indexed — the bell's read axis |
| `sourceEventId` | String | required FK to 002 `NotificationEvent`; indexed |
| `type` | String | canonical catalog type (FR-011); not a raw emitter string |
| `title` | String | captured Arabic title at creation (FR-018) |
| `body` | String? | captured Arabic body; may be null when the entry has no body |
| `entityType` | String? | e.g. `"WorkItem"`, `"Order"`; mirrors the event |
| `entityId` | String? | deep-link target id; null for catalog entries with no target |
| `linkHref` | String? | deep link resolved at processing time (FR-022); null when not linkable |
| `severity` | NotificationSeverity | INFO / ACTION / URGENT — drives visual weight, not priority |
| `readAt` | DateTime? | null = unread; the bell counts `readAt IS NULL` |
| `createdAt` | DateTime | server now, UTC |
| `archivedAt` | DateTime? | archival only (FR-024); never a hard delete |

Relationships: one per (outbox event, user); read by 053's own pages and by any feature that needs a
per-user notification count.

**`@@unique([sourceEventId, userId])`** — the idempotency boundary. This constraint is what makes FR-007
structurally true rather than a convention (research.md §1). A second insert for the same pair fails at the
database regardless of application-level care or concurrency.

Constraints: `Notification` rows are never hard-deleted (FR-024, constitution III). The only mutable columns
are `readAt` and `archivedAt` — reading a notification is a legitimate state change, unlike a money record's
amount, and both are audited (FR-061). Title, body, and link are written once and never rewritten (FR-018).

Validation (server, Zod): none on write — 053 creates notifications from trusted catalog entries and resolved
user ids. Read filters validate their enum values (`read`/`unread`, catalog type).

### DelayThreshold

| Field | Type | Rules |
|---|---|---|
| `id` | String | PK, cuid |
| `phase` | DelayPhase | **unique**; one row per phase (FR-035) |
| `thresholdMinutes` | Int? | null = disabled; `> 0` enforced by a DB CHECK |
| `alertRoles` | String[] | RoleKeys alerted on breach; default per phase |
| `alertPermissions` | String[] | Permission keys; same addressing mode as recipients (FR-002) |
| `alertDepartmentIds` | String[] | Department ids; resolves to their members |
| `escalationMinutes` | Int? | null = no escalation tier in V1 (FR-047); `> thresholdMinutes` when set |
| `updatedById` | String? | FK to 001 User; null until first Admin write (seeded rows) |
| `updatedAt` | DateTime | `@updatedAt`; UTC |

`phase` is an enum of the five measured phases, distinct from `WorkItemState`: a Work Item in
`WAITING_REVIEW` is measured against the *review* threshold, and the mapping from state to phase is
053-owned configuration logic, not a second state machine (constitution I).

Validation (server, Zod): `thresholdMinutes` null or a positive integer; `escalationMinutes` null or greater
than `thresholdMinutes`; every entry in the three recipient arrays must be a known RoleKey, Permission, or
active Department respectively — an unknown value is a `VALIDATION` error, not a silently-ignored row
(constitution VI).

### DelayBreach

| Field | Type | Rules |
|---|---|---|
| `id` | String | PK, cuid |
| `workItemId` | String | required FK to 002 WorkItem; indexed |
| `phase` | DelayPhase | required; which threshold was exceeded |
| `breachSequence` | Int | 1 for the first breach of this (workItem, phase); increments on re-breach |
| `thresholdMinutes` | Int | the threshold in force when the breach happened — a snapshot |
| `escalated` | Boolean | default false; set when the escalation tier fires (FR-047) |
| `escalatedAt` | DateTime? | UTC; set with `escalated` |
| `notifiedAt` | DateTime? | UTC; when the alert was created in the same transaction |
| `detectedAt` | DateTime | server now, UTC |

Relationships: one row per (Work Item, phase, breach occurrence). Never updated except to set `escalated`/
`escalatedAt`, which is the one legitimate state change (research.md §7).

**`@@unique([workItemId, phase, breachSequence])`** — makes "once per breach" a schema property. The
scheduler's second tick for an unchanged breach attempts an insert that already exists; the catch is what
prevents the duplicate alert, not a timing coincidence.

Constraints: the alert's `Notification` rows are created in the **same transaction** as this row (FR-042,
FR-043). A breach with no notification is only possible when the phase's recipient arrays are all empty, and
that case is legitimate and specified (FR-005 scenario 2 in US5).

### SchedulerRun

| Field | Type | Rules |
|---|---|---|
| `id` | String | PK, cuid |
| `ownerId` | String | the process instance that ran the tick (hostname/pid/boot id) |
| `startedAt` | DateTime | server now, UTC |
| `finishedAt` | DateTime? | null while running |
| `evaluated` | Int | Work Items examined |
| `flagged` | Int | Work Items newly flagged delayed |
| `alerted` | Int | breach rows created |
| `escalated` | Int | escalation-tier breaches created |
| `outcome` | SchedulerOutcome | RUNNING / OK / ERROR |
| `error` | String? | failure detail; null on success |

Relationships: none required. Purely an observability record (FR-053), read by the thresholds screen.

Constraints: append-only in practice — a run row is inserted at start and completed in place. Unlike
`Notification` and `DelayBreach`, a run row is transient operational telemetry rather than an operational
record, so in-place completion is acceptable and keeps the table small. Retention: a cleanup routine MAY
delete run rows older than a configurable window; this is explicitly **not** subject to FR-024, which governs
notifications, and is called out here so the distinction is deliberate rather than an oversight.

### SchedulerLease

| Field | Type | Rules |
|---|---|---|
| `id` | String | fixed singleton key; `PK` |
| `ownerId` | String | the process instance holding the lease |
| `acquiredAt` | DateTime | UTC |
| `expiresAt` | DateTime | UTC; a lease past this is reclaimable |

Relationships: none. Exactly one row, created by the migration (research.md §6).

Constraints: this is the one table 053 legitimately mutates on every tick — it is a mutex, not a record.
A process acquires the lease only if the row is absent or `expiresAt < now()`, in a single conditional
UPDATE, so two instances racing produces exactly one winner. A lease acquired mid-run and not renewed before
expiry is safe: the other instance's tick finds the same breaches and the `DelayBreach` unique constraint
absorbs the duplicate (research.md §6).

## Enums

```text
DeliveryStatus:      PENDING, PROCESSED, FAILED, UNMAPPED
NotificationSeverity: INFO, ACTION, URGENT
DelayPhase:          DESIGN, REVIEW, PRICING, PRODUCTION, COLLECTION
SchedulerOutcome:    RUNNING, OK, ERROR
```

`DelayPhase` is a fixed five-value code vocabulary, not Admin-configurable data — a new *threshold* is
configuration (a `DelayThreshold` row), but a new *kind of phase to measure* is a code change, because it
requires a new age source and a new derivation rule. This mirrors 001's permission-vocabulary decision and
constitution VI's "roles are permission scopes" reasoning applied to measurement axes.

## Derived (never stored)

- **Waiting age (workflow phases)** — `now() − PhaseTiming.startedAt` of the open `QUEUE` segment for the
  Work Item's current state; open = `endedAt IS NULL`. No Work Item column, no counter (research.md §8).
- **Waiting age (pricing)** — `now() − PricingStatus.waitingSince` for a Work Item whose pricing status is
  `PENDING` or `DISPUTED` (051 FR-011/FR-014). Independent of workflow state, so a Work Item in production
  with an unresolved price still ages (PRD §55 Rule 9).
- **Delayed state** — a Work Item is delayed iff its current phase's `thresholdMinutes` is non-null and its
  derived waiting age exceeds it. Recomputed on every query and every tick; never stored on the Work Item.
- **Unread count** — `count(Notification where userId = ? and readAt IS NULL and archivedAt IS NULL)`.
- **Responsible department for a delay** — the Work Item's `departmentId` for production/collection phases;
  the Head-Designer population for review; the assignee for design; the configured pricing roles for
  pricing. Each is a documented mapping from phase to responsible party, held in code as part of the
  catalog, not as configuration — it encodes PRD §50's "show responsible department" and would be noise to
  make configurable.
- **Resumed-reports-as-delayed** — a Work Item that left a delayed phase and returned to it is delayed again
  if its age exceeds the threshold, and gets a new `DelayBreach` row with an incremented sequence.

## Indexes (expected)

- `notification(userId, readAt, createdAt desc)` — the bell count and the dropdown's newest-first page.
- `notification(userId, type, createdAt desc)` — the type filter on the notifications page.
- `notification(sourceEventId)` — idempotency lookup and event-to-notification drill-down.
- `notification_event(processedAt, processingStatus, createdAt)` — the processor's claim query.
- `notification_event(type, createdAt)` — the unmapped-type counter and the Admin catalog view.
- `delay_breach(workItemId, phase)` — "is this Work Item already in breach?" and the delayed query.
- `delay_threshold(phase)` — covered by the unique constraint.
- `scheduler_run(startedAt desc)` — the thresholds screen's recent-runs list.

## Relationships Summary

```text
User 1───* Notification *───1 NotificationEvent (002)
                              │
DelayPhase 1───1 DelayThreshold          (config, seeded)
DelayPhase 1───* DelayBreach *───1 WorkItem (002)

SchedulerRun        SchedulerLease        (standalone operational records)
```

## Migration and immutability notes

- One additive migration: create the four new tables, add the five columns to `notification_event`, create
  the indexes above, insert the five seeded `DelayThreshold` rows with the Clarification defaults
  (4h / 1h / 2h / 8h / 24h), and insert the single `SchedulerLease` row.
- `notification` gets a `CHECK` on nothing beyond the unique pair; `delay_threshold.thresholdMinutes` gets
  `CHECK (thresholdMinutes IS NULL OR thresholdMinutes > 0)` so a non-positive threshold is refused by the
  database as well as by Zod (FR/US5 scenario 5).
- `REVOKE DELETE ON notification` is **not** applied: FR-024 requires that no user-facing path deletes a
  notification, but a hard DB-level revoke would also block the archival path and the operational cleanup of
  nothing else in this schema. The guarantee is enforced at the application layer and covered by a test that
  asserts no delete path exists — the same argument 052 makes for `Notification` vs its `FinanceVoid` tables,
  inverted because archival (not voiding) is the model here.
- All tables live in the existing primary PostgreSQL database, so they fall inside the existing DB backup set.
  053 adds no new persistent store and therefore no new backup obligation (constitution Backups, spec
  Dependencies).
