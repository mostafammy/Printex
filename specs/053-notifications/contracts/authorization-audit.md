# Contract: Authorization & Audit

Owner: 001 (vocabulary + primitives). This file binds 053's usage. Every entry point:
`getActor()` → scope check → Zod validation → mutation + `audit.record(tx, …)` in one transaction →
commit. The system-actor entry points (the processor and the scheduler) are the sole exception and are
covered in their own section at the end.

## Permission mapping (frozen vocabulary — **no new permission key**)

| Action | Permission | Seeded holders (001 matrix) |
|---|---|---|
| `notificationCenter.list`, `unreadCount` | **none** — scoped by `userId` alone | every signed-in user |
| `notificationCenter.markRead` / `markUnread` / `markAllRead` | **none** — a user may only change their own rows; the query is `WHERE id = ? AND userId = actor.userId` | every signed-in user |
| `getDelayedWorkItems`, `getDelayedWorkItemIds` | **none** — scope is derived from the actor's roles and departmentIds inside the function (FR-057) | every signed-in user, each scoped |
| `delayThresholds.read` | **none** — read-only seed view; shows thresholds, never recipients' private data | every signed-in user |
| `delayThresholds.update` | `admin.config` | Admin/Owner |
| `delayThresholds.schedulerStatus` | `admin.config` | Admin/Owner |
| Outbox / notification-log inspection (Admin) | `audit.view` | Admin/Owner |
| `startDelayScheduler` / `stopDelayScheduler` (manual trigger from Admin UI) | `admin.config` | Admin/Owner |

**No new permission key is introduced by 053.** This is deliberate and load-bearing: 001's 22 keys are frozen
(constitution VI, `src/server/auth/permissions.ts`), and adding one would require a 001 amendment. Reading and
marking one's own notifications needs no key at all — it is scoped by identity, exactly as 012's `getMyQueue`
is. The thresholds screen reuses `admin.config`, which PRD §48 already assigns to Admin/Owner for
"Configure notifications". The outbox log reuses `audit.view`.

**Every surface also re-checks authentication on read.** `getActor()` is called on every notification read,
not cached across the request (001 FR-004's `isActive` re-check). A deactivated user's session stops
resolving to an `Actor` at all, so they cannot read their own history through the live API — an auditor
reads it with `audit.view` instead (spec US3 scenario 7).

## Audit actions (all via `audit.record(tx, …)` — 001 is the only `AuditEvent` writer)

| Action | entityType | before / after | `reason` |
|---|---|---|---|
| `notification.read` | `Notification` | `readAt: null` → `readAt: <ts>` | optional |
| `notification.unread` | `Notification` | `readAt: <ts>` → `readAt: null` | optional |
| `notification.read_all` | `User` | `unreadCount: n` → `unreadCount: 0` | optional |
| `notification.threshold_updated` | `DelayThreshold` | full row → full row | **required** |
| `notification.recipient_override_updated` | `NotificationType` | full entry → full entry | **required** |
| `notification.scheduler_triggered` | `SchedulerRun` | `null` → run row | optional (manual Admin trigger) |
| `notification.archived` | `Notification` | `archivedAt: null` → `<ts>` | **required** |

**The underlying business action's own audit event already exists and 053 does not duplicate it.** When 013
rejects a design, 013's transaction writes its own `workitem.rejected` audit event (constitution III, PRD
§45); 053 then creates a `Notification` pointing at that same event. The notification is a **pointer**, never
the record (spec US7, FR-060). No `notification.created` audit event is written per notification — that would
write one audit row per recipient per event, multiplying the audit log by the recipient count for information
the outbox row already holds. The outbox row itself is the audit trail of delivery (FR-063), and its full
recipient specification is retained after processing so delivery can be reconstructed independently.

Rules:
- One audit row per mutation, in the same transaction as the mutation.
- Reason policy: required for threshold changes, recipient-override changes, and archival — the three
  configuration-level or history-affecting actions, matching 001's existing reason policy for `admin.override`
  and `pricing.override`. Optional for the three read-state changes.
- `attachmentIds` is always `[]` for 053: a notification carries no attachment, and a delayed-work alert
  references a Work Item rather than a file.
- **No audit event on a refused action.** A `FORBIDDEN` threshold write writes nothing (FR-062).
- `markRead` on an already-read notification is a no-op and writes no second `notification.read`.

## Immutability guarantee (defense in depth)

1. **Notification content is write-once.** `title`, `body`, `type`, `entityType`, `entityId`, `linkHref`, and
   `createdAt` are written once at creation and never updated by any path (FR-018). The only mutable columns
   are `readAt` and `archivedAt`. This is the constitution III property in a form that suits a notification:
   a notification is a statement about a moment, and a later change to the Work Item must not rewrite what it
   said.
2. **No delete path exists.** No server entry point issues `DELETE` against `notification` (FR-024).
   Archival is the only removal model, and it is an audit-backed status change. Covered by a test that
   asserts no delete path exists, mirroring 052's SC-002 test for money rows — but inverted: 053 relies on
   the application layer plus a test rather than a DB `REVOKE`, because a `REVOKE DELETE` would also block
   nothing useful here (there is no void-row pattern for notifications) while making any future data-retention
   cleanup impossible. The choice is recorded in [data-model.md](../data-model.md) § Migration and
   immutability notes.
3. **Delay state is derived.** There is no `delayed` column on `WorkItem`, so there is nothing to drift and
   nothing to keep in sync across the twelve transitions that can move a Work Item out of a phase
   (FR-059, research.md §7/§8). `DelayBreach` is the only stored delay record, and it exists solely to make
   "once per breach" a schema property.

## Transaction ordering (every write path)

```text
getActor() → authorize/scope check → Zod validation → BEGIN
  → mutation row(s) → audit.record(tx, …) → COMMIT
```

The processor and the scheduler each use the same rule with a system identity instead of `getActor()`: BEGIN
→ create the notification/breach rows → mark the outbox row processed (processor) or complete the run row
(scheduler) → COMMIT. A notification is therefore never visible to a reader before the outbox row that
produced it is marked processed, and a partial batch is impossible — a failed event rolls back entirely
(FR-005).

## System-actor entry points (no signed-in user)

`processOutboxBatch`, `startDelayScheduler`, and `runDelayTick` run without an `Actor`. They are authorized
by **position in the system**, not by permission:

- They are reachable only from the server process — never from a route handler, never from a client.
- The single manual entry point (`schedulerStatus`'s "run now" button) re-authorizes with `admin.config`
  before invoking a tick, so the system path cannot be reached from an unauthenticated context.
- Their `AuditEvent` rows are written with a `null` `actorId` — the only case where 001's contract permits
  omitting an actor (001's own pre-auth login events). `SchedulerRun.ownerId` carries the process identity
  that 001's `actorId` cannot express.

**No permission check is skipped by this exception.** It replaces authentication, not authorization: the
system path performs strictly *fewer* operations than a user path (it creates notifications and breach rows;
it never marks anything read, never changes a threshold, and never touches a Work Item's state), and every
one of those operations is idempotent and audit-tracked.

## Scope rules for the delayed-work query

`getDelayedWorkItems` takes no permission key and instead derives scope inside the function (FR-057):

| Actor role | Sees |
|---|---|
| `PRODUCTION_OPERATOR` | Work Items whose `departmentId` ∈ their `departmentIds` |
| `DESIGNER` | Work Items assigned to them |
| `HEAD_DESIGNER` | all Work Items in the shop |
| `RECEPTION` | all Work Items in the shop |
| `ADMIN_OWNER` | all Work Items in the shop |

A Work Item outside the actor's scope is neither returned nor counted in `total`, so the count itself does
not leak the existence of out-of-scope work (spec US6 scenario 3). This mirrors 014's own rule that
production operators see only relevant Work Items (PRD §17) and 011's existing department-scoped queries —
053 does not introduce a new access model, it applies the one 001 already froze.
