# Contract: Notification Service

Owner: 053. Public module `~/server/notifications`; internal files are never imported by consumers. Every
read and write is server-authoritative: `getActor()` → scope check → Zod validation → mutation +
`audit.record(tx, …)` in one transaction → commit. The processor and scheduler are the only actors that are
not a signed-in user; they run under a system identity and are documented as such below.

## `processOutboxBatch(limit)`

```ts
// System actor — not a signed-in user. Runs inside the Next.js process.
function processOutboxBatch(limit?: number): Promise<{
  processed: number;      // events fully processed
  unmapped: number;       // events with no catalog entry (FR-019)
  failed: number;         // events left for retry (FR-008)
  notificationsCreated: number;
}>
// default limit: 100
```

Behavior:
1. Claim a batch of `NotificationEvent` rows where `processedAt IS NULL AND processingStatus = 'PENDING'`,
   ordered by `createdAt` ascending (FIFO — FR-009), using a single conditional UPDATE so a concurrent
   processor cannot claim the same rows.
2. For each claimed event, look up its catalog entry by canonical type **or alias** (research.md §4). No
   entry → mark `UNMAPPED`, increment the Admin-visible counter, continue. Never throws.
3. Resolve recipients: union of `recipientUserIds`, `recipientRoles`, `recipientDepartmentIds`, and
   `recipientPermissions`, each expanded against **active** users only, deduplicated by user
   (FR-002, FR-003).
4. Insert one `Notification` per resolved user with the catalog's captured title, body, and deep link
   (FR-018, FR-022), and mark the event `PROCESSED` with `processedAt` — all in **one transaction per
   event** (FR-005). A duplicate insert against the `@@unique([sourceEventId, userId])` pair is caught and
   treated as success, not an error (FR-007).
5. On a per-event failure: mark `FAILED` with `lastError` and `attemptCount + 1`, do **not** set
   `processedAt`, and continue with the rest of the batch. After `MAX_ATTEMPTS` (5), stop retrying that
   event and surface it on the thresholds screen (FR-008).
6. Publish a live signal to each affected user's connected clients (see `notification-stream.md`).
7. Errors: never throws for per-event failures. Throws only `OUTBOX_UNAVAILABLE` if the claim query itself
   fails, in which case the caller (the scheduler tick) records the failure on the `SchedulerRun`.

**Ordering guarantee**: an event is only visible to this function once its recording transaction has
committed, so a notification can never describe a state change that was rolled back (FR-009, constitution V).

## `resolveRecipients(spec)`

```ts
type RecipientSpec = {
  userIds?: readonly string[];
  roles?: readonly string[];
  departmentIds?: readonly string[];
  permissions?: readonly Permission[];
};

function resolveRecipients(spec: RecipientSpec): Promise<ReadonlySet<string>>
// returns ACTIVE user ids only (isActive = true), deduplicated
```

Behavior:
1. Union the four modes: explicit ids as given (filtered to active users), `UserRole` joined to active
   `User`, `UserDepartment` joined to active `User`, and `RolePermission ∪ UserPermission` joined to active
   `User`.
2. A role, department, or permission held by nobody active contributes nothing.
3. Never throws on an unknown role/permission string — an unrecognized value resolves to an empty
   contribution, and the caller's audit/observability records the miss. A *configured* threshold with an
   unknown value is rejected earlier, at write time (see `delayThresholds.update`).

## `notificationCenter.list(actor, filter)`

```ts
// requires no permission key: scoped by user identity
type NotificationFilter = {
  read?: "read" | "unread";        // default: all
  type?: string;                   // canonical catalog type
  page?: number;                   // default 1
  pageSize?: number;               // default 20, max 100
};

function list(actor: Actor, filter?: NotificationFilter): Promise<{
  rows: NotificationView[];
  total: number;
  unreadTotal: number;             // for the bell, independent of the filter
  nextPage?: number;
}>

type NotificationView = {
  id: string;
  type: string;
  title: string;                   // captured Arabic title
  body: string | null;
  severity: "INFO" | "ACTION" | "URGENT";
  entityType: string | null;
  entityId: string | null;
  linkHref: string | null;
  readAt: string | null;           // ISO-8601 UTC
  createdAt: string;               // ISO-8601 UTC
};
```

Behavior:
1. `WHERE userId = actor.userId AND archivedAt IS NULL`, ordered `createdAt DESC` (FR-021).
2. When `type` is a catalog **alias**, expand to its canonical type and all aliases (research.md §4), so the
   page's filter behaves the same regardless of which spelling an emitter used.
3. For a row whose `entityId` the actor may no longer view, return the row with `linkHref: null` and
   `body: null` — the notification is retained (constitution III) but reveals nothing (FR-025).
4. A missing Work Item or Order that was hard-removed returns `linkHref: null`, never a throw and never a
   500 (spec Edge Cases).
5. Errors: `UNAUTHENTICATED`.

**View scope (FR-025)**: the row itself is returned even when the target is out of scope, because the actor
has a right to their own notification history; only the navigable detail is withheld. A Work Item the actor
cannot view must not be discoverable by following the link.

## `notificationCenter.unreadCount(actor)`

```ts
// requires no permission key
function unreadCount(actor: Actor): Promise<number>
// SELECT count(*) FROM notification WHERE userId = ? AND readAt IS NULL AND archivedAt IS NULL
```

Behavior: single indexed count, no join, no event resolution (research.md §2). This is what the shell bell
renders on every authenticated page, so it must be a constant-cost query. Errors: `UNAUTHENTICATED`.

## `notificationCenter.markRead(actor, id)` / `markUnread(actor, id)` / `markAllRead(actor)`

```ts
// requires no permission key — a user may only ever change their OWN notifications
function markRead(actor: Actor, notificationId: string): Promise<NotificationView>
function markUnread(actor: Actor, notificationId: string): Promise<NotificationView>
function markAllRead(actor: Actor): Promise<{ updated: number }>
```

Behavior:
1. `WHERE id = ? AND userId = actor.userId` — a notification belonging to another user is
   `NOTIFICATION_NOT_FOUND`, never a silent success on someone else's row.
2. `markRead` sets `readAt = now()` (UTC) and writes `notification.read`; `markUnread` sets `readAt = NULL`
   and writes `notification.unread`; both in one transaction (FR-061, FR-023).
3. `markAllRead` updates only the actor's own unread rows and writes **one** `notification.read_all` audit
   event carrying the affected count, not one event per row.
4. `markRead` on an already-read notification is a no-op success and writes no second audit event.
5. Errors: `UNAUTHENTICATED`, `NOTIFICATION_NOT_FOUND`.

## `getDelayedWorkItems(actor, filter)`

```ts
// requires no permission key — scope is derived from the actor (FR-057)
type DelayedFilter = {
  phase?: DelayPhase;
  priority?: OrderPriority;
  departmentId?: string;
  from?: string;   // ISO-8601; workItem created on/after
  to?: string;     // ISO-8601; workItem created on/before
  page?: number;   // default 1
  pageSize?: number; // default 50, max 200
};

function getDelayedWorkItems(actor: Actor, filter?: DelayedFilter): Promise<{
  rows: DelayedWorkItemView[];
  total: number;
  nextPage?: number;
}>

type DelayedWorkItemView = {
  workItemId: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  productTypeName: string | null;
  state: WorkItemState;         // 002's vocabulary
  phase: DelayPhase;            // the measured phase
  priority: OrderPriority;
  waitingSince: string;         // ISO-8601 UTC — the anchor, not a computed age
  waitingAgeMinutes: number;    // server-computed, UTC clock
  thresholdMinutes: number;
  responsibleDepartmentId: string | null;
  responsibleDepartmentName: string | null;
};
```

Behavior:
1. Select non-terminal Work Items (`state NOT IN ('DELIVERED','COMPLETED','CANCELLED')` — FR-039), compute
   each one's waiting age from its anchor (002 `PhaseTiming` open QUEUE segment, or 051
   `pricing.pendingSince()` for the pricing phase), and keep those exceeding an enabled threshold.
2. Derive the phase from the Work Item's current state; skip a Work Item whose current state maps to no
   measured phase (FR-040) — a Work Item with no design requirement is never in a design state and so is
   never design-delayed.
3. Scope by the actor: a `PRODUCTION_OPERATOR` sees only Work Items in their `departmentIds`; a `DESIGNER`
   sees only Work Items assigned to them; `ADMIN_OWNER`, `RECEPTION`, and `HEAD_DESIGNER` see the whole
   shop. Anything outside the actor's scope is not returned and not counted (FR-057).
4. Order `waitingAgeMinutes` descending — the worst first.
5. Errors: `UNAUTHENTICATED`, `VALIDATION` (bad `pageSize`).

**Derivation, not storage (FR-059)**: no `delayed` column exists on `WorkItem`. A Work Item that has moved
on is absent from the result on the very next call, and lowering a threshold changes the result with no
migration and no backfill.

## `getDelayedWorkItemIds()`

```ts
// for 011's reserved seam: opts.getDelayedWorkItemIds?: () => Promise<ReadonlySet<string>>
function getDelayedWorkItemIds(): Promise<ReadonlySet<string>>
// all currently-delayed Work Item ids, unscoped — the CALLER applies its own scope
```

Behavior: the same derivation as `getDelayedWorkItems` with no filters and no actor, projected to ids.
011's `listReceptionQueue` uses the set to set `OrderQueueRow.delayed` on any order containing one of these
ids. It is unscoped by design because it is a membership test inside 011's own already-authorized query,
not a read of Work Item content — 011 performs its own authorization (011 contracts/order-entry.md).

Errors: `OUTBOX_UNAVAILABLE` only if the underlying query fails; 011's queue continues to work if the
callback is simply not supplied (011 FR-008a, FR-058).

## `delayThresholds.read()` / `delayThresholds.update(actor, input)`

```ts
type ThresholdInput = {
  phase: DelayPhase;
  thresholdMinutes: number | null;   // null disables the phase
  alertRoles?: readonly RoleKey[];
  alertPermissions?: readonly Permission[];
  alertDepartmentIds?: readonly string[];
  escalationMinutes?: number | null; // must exceed thresholdMinutes when both set
  reason?: string;
};

function delayThresholds.read(): Promise<ThresholdView[]>   // no permission — read-only seed view

// requires permission: admin.config
function delayThresholds.update(actor: Actor, input: ThresholdInput): Promise<ThresholdView>
```

Behavior:
1. `update` → `authorize(actor, "admin.config")` → validate: `thresholdMinutes` null or `> 0`;
   `escalationMinutes` null or `> thresholdMinutes`; every `RoleKey` ∈ `ALL_ROLE_KEYS`; every
   `Permission` ∈ `ALL_PERMISSIONS`; every `alertDepartmentId` an existing active `Department` (FR/US5
   scenario 5).
2. Upsert the `DelayThreshold` row for that phase and write `notification.threshold_updated` with actor,
   before, after, and a required reason — same transaction (FR-061).
3. `escalationMinutes` is accepted and stored but **inactive in V1** until at least one phase sets it
   (FR-047). A threshold change takes effect on the next tick and on the next query with no restart (FR-045).
4. Errors: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION` (`INVALID_THRESHOLD`, `INVALID_ESCALATION`,
   `UNKNOWN_ROLE`, `UNKNOWN_PERMISSION`, `UNKNOWN_DEPARTMENT`).

**No new permission key (research.md, dependency table)**: `admin.config` already exists in 001's frozen
vocabulary and PRD §48 assigns "Configure notifications" to Admin/Owner. The unmapped-type counter and the
recent-runs list are read under `audit.view` and rendered on the same screen.

## `delayThresholds.schedulerStatus()`

```ts
// requires permission: admin.config
function schedulerStatus(): Promise<{
  running: boolean;               // lease held and not expired
  lastRun: SchedulerRunView | null;
  leaseOwner: string | null;
  nextRunAt: string | null;       // lastRun.startedAt + interval
  intervalMinutes: number;        // configurable, seed 5
  unmappedTypes: Array<{ type: string; count: number; lastSeenAt: string }>;  // FR-019
}>
```

Behavior: read the `SchedulerLease` row and the most recent `SchedulerRun`, and aggregate
`processingStatus = 'UNMAPPED'` outbox rows by type. This is what makes "are alerts actually running?" and
"what have we never heard about?" answerable without reading logs (FR-053, FR-019). Errors:
`UNAUTHENTICATED`, `FORBIDDEN`.

## `startDelayScheduler()` / `stopDelayScheduler()`

```ts
// System — module-load guarded, idempotent
function startDelayScheduler(opts?: { intervalMinutes?: number }): void   // seed 5
function stopDelayScheduler(): void
```

Behavior:
1. On first call, start a `setInterval` that runs `runDelayTick()`. Repeat calls are no-ops — a second
   start does not create a second interval (this is the in-process half of the exactly-once guarantee).
2. Each tick: acquire the `SchedulerLease` conditionally (single UPDATE where absent or expired). No
   acquisition → skip the tick silently; another instance is running (research.md §6).
3. With the lease: insert a `SchedulerRun` (`RUNNING`), evaluate every non-terminal Work Item's current
   phase, insert `DelayBreach` + `Notification` rows for newly-breached items, complete the run row.
4. On startup, run one tick immediately — a window missed during downtime is evaluated, not skipped
   (FR-051).
5. Any throw inside a tick is caught, recorded on the `SchedulerRun` as `ERROR`, and does **not** propagate
   to the Next.js request path or crash the process (FR-052).
6. Errors: never throws. Failure is observable only through `delayThresholds.schedulerStatus()`.

## Guarantees (all paths)

- No code path issues `DELETE` against `notification` (FR-024). Archival is `archivedAt` + audit.
- The `@@unique([sourceEventId, userId])` pair makes duplicate notifications impossible regardless of
  retries, restarts, or concurrent processors (FR-007, research.md §1).
- No client-supplied value influences recipient resolution, notification content, or delay state
  (FR-010, constitution V).
- Every read path is scoped to the actor; every mutating path writes an audit event in the same
  transaction (FR-007 in FR-061, constitution III).
- Nothing in this module changes a Work Item's workflow state, a pricing status, or any business gate
  (FR-068, constitution II).
- Nothing in this module performs outbound network I/O (FR-031, FR-064, constitution VII).
