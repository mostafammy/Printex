# Contract: Designer Assignment & Timers

Owner: 012 (this feature). Consumers: 013 (review — reads `WorkItem.assigneeId`, produces
`REWORK_REQUIRED` this feature reacts to), 090 (dashboard — reads `getDesignerWorkload`,
`phaseDurations`), 014 (production timers — reuses `PhaseTiming`/`openSegment`/`closeOpenSegment`
the same way this feature does, per research.md §2).

All functions below live in `src/server/designers/**` and are re-exported from the barrel
`src/server/designers/index.ts` — the only legal import path for code outside this module (new
`eslint.config.js` module-boundary rule, same shape as `src/server/orders/**`'s).

Every function takes `actor: Actor` (from `~/server/auth`'s `getActor()`) as its first argument and
calls `authorize(actor, permission)` as its first statement — see the Authorization table at the
bottom.

## `getEligibleDesigners`

```ts
function getEligibleDesigners(
  actor: Actor,
  workItemId: string,
): Promise<EligibleDesigner[]>;   // shape: data-model.md
```

1. `authorize(actor, "workitem.assign_designer")`.
2. Load the target `WorkItem` (with `order.customerId`) — throws `DomainDesignerError("WORK_ITEM_NOT_FOUND")` if missing, `DomainDesignerError("NOT_ASSIGNABLE")` if its state isn't one of `NEW`, `ASSIGNED`, `REWORK_REQUIRED`, `IN_DESIGN` (FR-001).
3. Query active users holding `design.work` (same role→permission join `getActor()` uses).
4. For each, compute `activeWorkItemCount`, `queueSize` (V1: same value), `estimatedWaitMinutes`
   (research.md §6 — a simple derived figure, exact formula left to implementation, not
   contract-frozen), `pastJobsForCustomer` (data-model.md).
5. Mark exactly one row `isSuggested: true` — the lowest `activeWorkItemCount`, ties broken by
   earliest most-recent-assignment `WorkItemTransition.at`, then by `name` (FR-003).
6. Read-only — no `db.$transaction`, no audit event (nothing is mutated).

## `assignDesigner`

```ts
function assignDesigner(
  actor: Actor,
  workItemId: string,
  designerId: string,
  reason?: string,   // required (validated) when this is a reassignment (FR-005)
): Promise<void>;
```

1. `authorize(actor, "workitem.assign_designer")`.
2. `db.$transaction(async (tx) => { ... })`:
   a. Load the `WorkItem` inside `tx`. Throws `DomainDesignerError("NOT_ASSIGNABLE")` if its state
      isn't `NEW`, `ASSIGNED`, `REWORK_REQUIRED`, or `IN_DESIGN`.
   b. If `workItem.assigneeId` is already set and differs from `designerId` (a **reassignment**):
      - Throws `DomainDesignerError("REASON_REQUIRED")` if `reason` is empty/whitespace-only
        (FR-005).
      - If an open `ACTIVE` `PhaseTiming` segment exists for this Work Item, `closeOpenSegment(tx,
        { workItemId, kind: "ACTIVE" })` (research.md §3, US2 Acceptance Scenario 2 — reassigning
        mid-timer closes it, preserving the prior designer's recorded time).
      - `tx.workItem.update({ where: { id: workItemId }, data: { assigneeId: designerId } })` —
        **no** `transitionWorkItem` call; state is unchanged (research.md §3).
      - `audit.record(tx, { action: "workitem.reassigned", entityType: "WorkItem", entityId: workItemId, actorId: actor.userId, before: { assigneeId: previousAssigneeId }, after: { assigneeId: designerId }, reason })`.
   c. Else (initial assignment, `NEW → ASSIGNED`):
      - `transitionWorkItem(tx, { workItemId, to: "ASSIGNED", actor })` — validates the edge and
        writes `WorkItemTransition`; `assigneeId` is set via a `tx.workItem.update` in the same
        `tx`, immediately after (both share the transaction, so they commit/roll back together —
        constitution V).
      - `audit.record(tx, { action: "workitem.assigned", entityType: "WorkItem", entityId: workItemId, actorId: actor.userId, after: { assigneeId: designerId } })`.
   d. `notify(tx, { type: "workitem.assigned", entity: { type: "WorkItem", id: workItemId }, recipients: { userIds: [designerId] }, payload: { orderId, ... } })` (FR-006) — same call for both
      the initial-assignment and reassignment branches.

## `getMyQueue`

```ts
function getMyQueue(actor: Actor): Promise<MyQueueRow[]>;   // shape: data-model.md
```

1. No `authorize()` call beyond the caller being an authenticated actor — mirrors 011's
   `listReceptionQueue`/`getOrderDetail` rationale (contracts/order-entry.md: "authenticated actor
   only", every role can have a queue).
2. `db.workItem.findMany({ where: { assigneeId: actor.userId, state: { in: ["ASSIGNED", "IN_DESIGN", "REWORK_REQUIRED"] } }, include: { order: { include: { customer: true } }, productType: true } })`.
3. For each `REWORK_REQUIRED` row, load its most recent `WorkItemTransition` landing in
   `REWORK_REQUIRED` for `rejectionDetails` (FR-019).
4. For each row, check for an open `ACTIVE` `PhaseTiming` segment (`hasOpenTimer`).
5. Sort: `priority === "URGENT"` first, then `assignedAt` ascending (FR-008).

## `startTimer`

```ts
function startTimer(actor: Actor, workItemId: string): Promise<void>;
```

1. `authorize(actor, "design.work")`.
2. `db.$transaction(async (tx) => { ... })`:
   a. Load the `WorkItem`. Throws `DomainDesignerError("NOT_ASSIGNEE")` if `assigneeId !==
      actor.userId` (FR-013). Throws `DomainDesignerError("NOT_TIMEABLE")` if `state` isn't
      `ASSIGNED`, `REWORK_REQUIRED`, or already `IN_DESIGN`.
   b. If any *other* Work Item currently has an open `ACTIVE` segment for `actor.userId`,
      `closeOpenSegment(tx, { workItemId: otherWorkItemId, kind: "ACTIVE" })` first (FR-012 — one
      active timer per designer; the query is `db.phaseTiming.findFirst({ where: { userId:
      actor.userId, kind: "ACTIVE", endedAt: null } })`).
   c. If `state !== "IN_DESIGN"`: `transitionWorkItem(tx, { workItemId, to: "IN_DESIGN", actor })`
      (FR-009/FR-020 — covers both the first start from `ASSIGNED`/`REWORK_REQUIRED` and, per
      FR-020, a rework resuming). `transitionWorkItem`'s own step 5
      (`src/server/core/workflow/transition.ts`) already closes the outgoing phase's open `QUEUE`
      segment as part of every transition — that closed segment IS the Work Item's queue time
      (FR-014); no separate manual close is needed or correct here.
   d. `openSegment(tx, { workItemId, phase: "IN_DESIGN", kind: "ACTIVE", userId: actor.userId })`.
   e. `audit.record(tx, { action: "workitem.timer_started", entityType: "WorkItem", entityId: workItemId, actorId: actor.userId })`.

"Resume" (FR-011) is this same function called again on an already-`IN_DESIGN` Work Item whose
`ACTIVE` segment is currently closed — step (c)'s `if` is skipped (no redundant transition), step
(d) opens a fresh segment. There is no separate `resumeTimer` export.

## `pauseTimer`

```ts
function pauseTimer(actor: Actor, workItemId: string): Promise<void>;
```

1. `authorize(actor, "design.work")`.
2. `db.$transaction(async (tx) => { ... })`:
   a. Load the `WorkItem`. Throws `DomainDesignerError("NOT_ASSIGNEE")` if `assigneeId !==
      actor.userId` (FR-013).
   b. `closeOpenSegment(tx, { workItemId, kind: "ACTIVE" })` — no-op (per `closeOpenSegment`'s own
      contract) if nothing is open; no state change (FR-010).
   c. `audit.record(tx, { action: "workitem.timer_paused", entityType: "WorkItem", entityId: workItemId, actorId: actor.userId })`.

"Stop" (PRI-9's fourth timer verb) is this same function — the underlying `PhaseTiming` model has
only "segment open" / "segment closed" states (research.md §2); there is no third state a separate
`stopTimer` would need to represent. The UI MAY label the same action "Stop" instead of "Pause"
depending on context; both call `pauseTimer`.

## `uploadDesignVersion`

```ts
function uploadDesignVersion(
  actor: Actor,
  workItemId: string,
  file: { stream: NodeJS.ReadableStream; fileName: string; mimeType?: string },
  note?: string,
): Promise<{ designVersionId: string; version: number }>;
```

1. `authorize(actor, "design.work")`.
2. Load the `WorkItem`. Throws `DomainDesignerError("NOT_ASSIGNEE")` if `assigneeId !==
   actor.userId`. Throws `DomainDesignerError("NOT_TIMEABLE")`-equivalent (`"NOT_IN_DESIGN"`) if
   `state !== "IN_DESIGN"` (FR-016).
3. Compute `storageKey` (e.g. `design-versions/${workItemId}/${nextVersion}`), call
   `storageAdapter.put(storageKey, file.stream)` — **outside** the DB transaction (network/disk I/O
   should not hold a DB transaction open; if the DB insert below fails, the orphaned stored blob is
   acceptable per `StorageAdapter`'s own contract, which does not guarantee transactional
   consistency with the caller's database).
4. `db.$transaction(async (tx) => { ... })`:
   a. Compute `version = 1 + (await tx.designVersion.count({ where: { workItemId } }))`.
   b. `tx.designVersion.create({ data: { workItemId, version, storageKey, fileName: file.fileName, mimeType: file.mimeType, sizeBytes, sha256, note, uploadedById: actor.userId } })`.
   c. `audit.record(tx, { action: "designversion.uploaded", entityType: "WorkItem", entityId: workItemId, actorId: actor.userId, after: { version, fileName: file.fileName, note } })`.
5. Return `{ designVersionId, version }`. Does not change `WorkItem.state` (FR-016).

## `markDesignComplete`

```ts
function markDesignComplete(actor: Actor, workItemId: string): Promise<void>;
```

1. `authorize(actor, "design.work")`.
2. `db.$transaction(async (tx) => { ... })`:
   a. Load the `WorkItem`. Throws `DomainDesignerError("NOT_ASSIGNEE")` if `assigneeId !==
      actor.userId`. Throws `DomainDesignerError("NOT_IN_DESIGN")` if `state !== "IN_DESIGN"`.
      Throws `DomainDesignerError("NO_DESIGN_VERSION")` if `tx.designVersion.count({ where: {
      workItemId } }) === 0` (FR-017).
   b. `closeOpenSegment(tx, { workItemId, kind: "ACTIVE" })` (FR-018).
   c. `transitionWorkItem(tx, { workItemId, to: "DESIGN_COMPLETED", actor })`.
   d. `transitionWorkItem(tx, { workItemId, to: workItem.requiresReview ? "WAITING_REVIEW" : "APPROVED", actor })` (research.md §5 — two chained transitions, both legal `ALLOWED_EDGES` steps).
   e. No separate `audit.record` beyond what `transitionWorkItem` itself already writes via
      `WorkItemTransition` — matches 002's own pattern of not double-recording state changes in
      both `AuditEvent` and `WorkItemTransition` (`WorkItemTransition` *is* this feature's audit
      trail for state changes; `AuditEvent` is used for non-state mutations like FR-016's upload).

## `phaseDurations`

```ts
function phaseDurations(actor: Actor, workItemId: string): Promise<PhaseDurations>; // shape: data-model.md
```

1. No `authorize()` beyond authenticated actor (read-only display helper, same rationale as
   `getMyQueue`).
2. Load the Work Item's `PhaseTiming` rows, split by `kind`, call `calculatePhaseDurationMs()` for
   `queueTimeMs`/`activeTimeMs` (FR-014/FR-015).
3. `totalPhaseDurationMs`: `null` unless a `WorkItemTransition` row exists landing in
   `DESIGN_COMPLETED`; if it does, `(that row's at) - (the most recent ASSIGNED/REWORK_REQUIRED
   transition's at)`.

## `getDesignerWorkload`

```ts
function getDesignerWorkload(actor: Actor): Promise<Array<{ userId: string; name: string; activeWorkItemCount: number }>>;
```

Read-only, no `authorize()` beyond authenticated actor (090's dashboard consumes this directly, per
PRI-9's contract line). Same underlying query as `getEligibleDesigners` step 3–4, without the
per-work-item scoping (whole-shop view, not "eligible for this one Work Item").

## Authorization table

| Function | Permission | Additional check |
|---|---|---|
| `getEligibleDesigners` | `workitem.assign_designer` | Work Item state ∈ assignable set |
| `assignDesigner` | `workitem.assign_designer` | reassignment requires non-empty `reason` |
| `getMyQueue` | none (authenticated only) | rows scoped to `actor.userId` |
| `startTimer` | `design.work` | `assigneeId === actor.userId` |
| `pauseTimer` | `design.work` | `assigneeId === actor.userId` |
| `uploadDesignVersion` | `design.work` | `assigneeId === actor.userId`, state `IN_DESIGN` |
| `markDesignComplete` | `design.work` | `assigneeId === actor.userId`, ≥1 `DesignVersion` exists |
| `phaseDurations` | none (authenticated only) | read-only |
| `getDesignerWorkload` | none (authenticated only) | read-only |

`DomainDesignerError` is a small local error class (`src/server/designers/errors.ts`), matching
011's `DomainOrderError` pattern exactly (not `core`'s `Result`/`DomainError` — this module is not
part of `src/server/core/**`, so it follows the "let it throw, Server Action boundary catches"
convention `src/server/orders/**`/`src/server/admin/**` already use). Codes: `"NOT_ASSIGNABLE"`,
`"REASON_REQUIRED"`, `"NOT_ASSIGNEE"`, `"NOT_TIMEABLE"`, `"NOT_IN_DESIGN"`, `"NO_DESIGN_VERSION"`,
`"WORK_ITEM_NOT_FOUND"`.

