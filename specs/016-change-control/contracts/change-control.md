# Contracts: Order Change Control (service functions)

All functions live in `src/server/changes/**` and are exported only from the barrel
`src/server/changes/index.ts`. A new module-boundary ESLint rule mirrors
`orders`/`designers`/`review`/`production`. Importing the barrel registers 016's guards as a side
effect (contracts/events-and-ports.md §Guards).

**Aspect layer**: every public command and query is built on the shared layer in
[aspects.md](./aspects.md). That file is the canonical copy, owned jointly with 015; 016 does not
redefine it. The module binding is `src/server/changes/aspect.ts` (research §11):
`aspects.forModule<ChangeError>({ module: "changes", mapGuardFailure, mapUniqueViolation })`.
Consequences for every entry point below:

- The signature is `(actor: Actor, raw: z.input<Schema>) => Promise<ChangeResult<T>>`, where
  `ChangeResult<T> = AspectResult<T, ChangeError>`. A public call never throws a domain error.
  Server Actions switch on `result.ok` / `result.error.code`, and no `try/catch` is needed.
- The pipeline is fixed by the engine: validate (Zod) → permission (`PermissionSpec`, no I/O) →
  transaction → `authorize` hook (load and scoped `ctx.check`, in the same tx) → `run` → audit
  entries returned by `run` (≥ 1, `actorId` from the actor) → commit.
- The base errors come from the engine: `VALIDATION`, `FORBIDDEN`, `NOT_FOUND { entity, id }`,
  `CONFLICT`, `INVALID_STATE`, and `GUARD_FAILED`. The table below lists only 016's own codes.
- Refusals inside `run` or the building blocks are raised with `fail({ code })`.
- `allowNoChange` is never used. A no-op is the `NO_CHANGES` refusal.

## Shared types (`specFields.ts`)

```ts
export const SPEC_FIELDS = [
  "productTypeId", "description", "quantity", "widthValue",
  "heightValue", "dimensionUnit", "material", "finishNotes",
] as const;
export type SpecField = (typeof SPEC_FIELDS)[number];

/** Normalized, comparison-ready snapshot. Decimals are canonical strings ("1.5", never "1.50"). */
export type SpecSnapshot = {
  productTypeId: string | null;
  description: string | null;
  quantity: number | null;
  widthValue: string | null;
  heightValue: string | null;
  dimensionUnit: WorkItemDimensionUnit | null;
  material: string | null;
  finishNotes: string | null;
};

/** Partial update. At least one key. "" → null for strings. Decimal inputs accept number | string. */
export const specPatchSchema: z.ZodType<SpecPatch>;
export type SpecPatch = Partial<SpecSnapshot>; // non-empty enforced by .refine

export type SpecVersionView = {
  id: string; workItemId: string; version: number; origin: SpecVersionOrigin;
  snapshot: SpecSnapshot; stateAtCreation: WorkItemState; reason: string | null;
  createdBy: { id: string; name: string } | null; createdAt: Date;
};
```

## Errors (`errors.ts`)

```ts
/** 016's module error union: objects raised with fail(), returned in AspectResult.error. */
export type ChangeError =
  | { readonly code: "CHANGE_REQUEST_REQUIRED" }      // editSpec on IN_PRODUCTION
  | { readonly code: "ADMIN_OVERRIDE_REQUIRED" }      // editSpec on PRODUCTION_COMPLETED..COMPLETED
  | { readonly code: "WORK_ITEM_LOCKED" }             // any change on CANCELLED
  | { readonly code: "NO_CHANGES" }
  | { readonly code: "STALE_SPEC_VERSION"; readonly currentVersion?: number }
  | { readonly code: "REDESIGN_CHOICE_REQUIRED" }
  | { readonly code: "REDESIGN_NOT_ALLOWED" }
  | { readonly code: "ORIGIN_DEPARTMENT_REQUIRED" }
  | { readonly code: "NOT_IN_PRODUCTION" }            // createChangeRequest outside IN_PRODUCTION
  | { readonly code: "CHANGE_REQUEST_PENDING" }       // second request / override while pending
  | { readonly code: "CHANGE_REQUEST_ALREADY_DECIDED" }
  | { readonly code: "WORK_ITEM_LEFT_PRODUCTION" }    // approval after the item left IN_PRODUCTION
  | { readonly code: "NOTHING_TO_ACKNOWLEDGE" }
  | { readonly code: "REVISION_UNACKNOWLEDGED" }      // admin override while a revision is unacknowledged
  | { readonly code: "LATE_CANCEL_NOT_APPLICABLE" }
  | { readonly code: "VERSION_MISMATCH" }
  | { readonly code: "CHANGE_HOLD" }                  // mapped from guardCode (mapGuardFailure)
  | { readonly code: "LATE_CANCELLATION_REQUIRED" }   // mapped from guardCode (mapGuardFailure)
  | { readonly code: "SPEC_CHANGE_VETOED"; readonly listener: string; readonly reason: string };
export type ChangeResult<T> = AspectResult<T, ChangeError>;
```

"Not found" cases use the engine's base `NOT_FOUND { entity: "WorkItem" | "ChangeRequest" |
"SpecVersion" | "ProductType", id }`. The earlier draft's `DomainChangeError` class,
module-local `WorkItemTransitionError`, and `ChangeActionResult` are **removed**, replaced by
`fail()`, `transitionOrThrow`/`ctx.transition`, and `AspectResult`.

## Authorization table

| Function | Permission | Scope (checked in-tx after load) | Audit action(s) |
|---|---|---|---|
| `getSpecHistory`, `getSpecVersionDiff` | `defineQuery` with an any-of `PermissionSpec`: `["order.edit", "finance.view", "design.work", "design.review", "change.approve", "admin.override", "production.operate"]`, i.e. anyone who can view the order (US4) | `authorize` hook: if `production.operate` is the actor's only qualifying key, `check("production.operate", { departmentId: effectiveDepartmentId })` | none (read) |
| `editSpec` | `order.edit` | none | `spec.edited` (+ `workitem.returned_for_customer_change` when redesign) |
| `createChangeRequest` | `order.edit` | none | `change_request.created` |
| `withdrawChangeRequest` | `order.edit` | none | `change_request.withdrawn` |
| `approveChangeRequest` | `change.approve` | none | `change_request.approved` |
| `rejectChangeRequest` | `change.approve` | none | `change_request.rejected` |
| `listPendingChangeRequests`, `getChangeRequestDetail` | `change.approve` | none | none (read) |
| `acknowledgeSpecRevision` | `production.operate` | `authorize` hook: `ctx.check("production.operate", { departmentId: effectiveDepartmentId })` | `change_request.acknowledged` |
| `cancelAfterProductionStarted` | `order.cancel` | none | `workitem.late_cancelled` (+ `change_request.closed_by_cancellation`) |
| `adminOverrideSpec` | `admin.override` | none | `spec.admin_override` (+ `change_request.approved` when `IN_PRODUCTION`) |
| (every new version) | n/a | n/a | `spec_version.created` (entityType `SpecVersion`) |

Command-level entries are returned from `run` (the engine writes them). `spec_version.created`
is written directly by `applySpecChangeInTx`/`createInitialSpecVersionInTx` via 001's
`audit.record`, because those building blocks also run inside 011's hand-written transactions.
Each audit event carries `actorId`, `entityType`, `entityId`, `before`/`after` (for spec changes
this is the changed-field snapshot subset) and `reason` where the input has one (FR-029).

## In-transaction building blocks (used by 011 and inside this module)

These are plain functions taking a `TxScope` (`{ tx, afterCommit }`), so a `CommandCtx` can be
passed straight in. They raise refusals with `fail(...)`, which throws `AspectDomainError`. Inside a
016 command the engine maps it. Inside 011's own `db.$transaction` it simply rejects and rolls back.

### `createInitialSpecVersionInTx(scope: TxScope, { workItemId, actorId }): Promise<SpecVersionView>`

Reads the just-created Work Item's columns, inserts v1 (`INITIAL`, `stateAtCreation =
workItem.state`), and sets `currentSpecVersionId`. It does not emit `SPEC_CHANGED` (FR-021: "after
v1"). It audits `spec_version.created`. 011's `quickCreateOrder`, `createOrder` (each Work Item),
and `addWorkItem` call it immediately after `tx.workItem.create`.

### `ensureCurrentSpecVersionInTx(scope: TxScope, workItemId): Promise<SpecVersionView>`

Returns the current version. If `currentSpecVersionId` is null, it inserts a `BACKFILL` v1 from the
current columns (`createdById: null`) and sets the pointer. Idempotent within a transaction.

### `applySpecChangeInTx(scope: TxScope, input): Promise<AppliedSpecChange | null>`

```ts
type ApplySpecChangeInput = {
  workItemId: string;
  actorId: string;
  origin: "DIRECT_EDIT" | "CHANGE_REQUEST" | "ADMIN_OVERRIDE";
  patch: SpecPatchInput; // validated inside via specPatchSchema
  expected: { version: number } | { specVersionId: string }; // editSpec/override | CR base
  reason: string | null;
  changeRequestId?: string | null; // associated ChangeRequest id when origin is CHANGE_REQUEST or an in-production override
  /** "fail" (016 commands): an empty diff → NO_CHANGES. "skip" (011 editWorkItem): return null, write nothing. */
  ifUnchanged: "fail" | "skip";
};
type AppliedSpecChange = {
  previous: SpecVersionView; current: SpecVersionView; changes: readonly SpecFieldChange[];
};
```

It is the **only** writer of the Work Item spec columns (FR-010). Before applying, `applySpecChangeInTx` validates the patch with `specPatchSchema.safeParse` and returns `VALIDATION` on schema violations. The steps, in order:


1. Take a row lock on the Work Item (`SELECT … FOR UPDATE`).
2. Run `ensureCurrentSpecVersionInTx`.
3. Compare against `expected`, refusing a mismatch with `STALE_SPEC_VERSION`.
4. Validate `productTypeId` existence.
5. Compute `diffSpecSnapshots(current, merged)`. An empty result refuses with `NO_CHANGES`, or
   returns `null` when `ifUnchanged: "skip"`.
6. Insert version `n + 1`. A P2002 on `(workItemId, version)` goes through the binding's
   `mapUniqueViolation` → `STALE_SPEC_VERSION`. The row lock in step 1 makes this a backstop only.
7. Update the mirror columns and pointer.
8. Audit `spec_version.created`.
9. `emitSpecChangedInTx` (contracts/events-and-ports.md).

It does **not** check the edit policy or permission. Callers do. 011's `editWorkItem` calls it
with `{ tx, afterCommit: (h) => void h() }` as scope (011 does not use the aspect layer; 016
registers no `afterCommit` hooks, so this is inert), `origin: "DIRECT_EDIT"`, `expected: { version:
current }`, and `ifUnchanged: "skip"`. 011's form has no version field, so its existing
last-write-wins contract is kept, but every write is still versioned. An unchanged save or a
due-date-only save stays a non-error. It retains its `PAST_EDIT_WINDOW` refusal and its
`workitem.edited` audit. A `fail()` raised inside (for example a missing product type) rejects
011's transaction as an `AspectDomainError`. 011's Server Action treats it like any other
unexpected error until 011 adopts the layer.

## Commands and queries

Every `Promise<X>` below is shorthand for `Promise<ChangeResult<X>>` (`void` → `ChangeResult<null>`).
Every "refuses with `CODE`" means `{ ok: false, error: { code: "CODE", … } }`.

### `getSpecHistory(actor, { workItemId }): Promise<{ versions: SpecVersionView[]; diffs: { from: number; to: number; changes: SpecFieldChange[] }[] }>`

- All versions ascending, in one query with `include: { createdBy }`. Consecutive diffs are
  computed in memory (no extra queries).
- If the pointer is null, it returns `versions: []` plus a `noHistoryBeforeNow: true` flag and the
  current columns. Reads never write.

### `getSpecVersionDiff(actor, { workItemId, fromVersion, toVersion }): Promise<SpecFieldChange[]>`

- One `findMany({ where: { workItemId, version: { in: [from, to] } } })`. If fewer than two rows
  come back, it refuses with `VERSION_MISMATCH` (US4-5: versions of another Work Item can't be
  named).

### `editSpec(actor, input): Promise<{ version: number; redesigned: boolean }>`

```ts
input = {
  workItemId: string;
  expectedVersion: number;
  patch: SpecPatch;
  reason?: string;
  designChoice?: "REDESIGN" | "KEEP_DESIGN";
  originDepartmentId?: string;
}
```

1. Evaluate `specEditPolicy(state)`: `CHANGE_REQUEST` → `CHANGE_REQUEST_REQUIRED`, `ADMIN_ONLY` →
   `ADMIN_OVERRIDE_REQUIRED`, `LOCKED` → `WORK_ITEM_LOCKED`. **No write of any kind happens before
   this check** (US2-3).
2. `redesignChoice`: when `REQUIRED`, `designChoice` must be present (`REDESIGN_CHOICE_REQUIRED`).
   When `FORBIDDEN`, `designChoice: "REDESIGN"` is refused with `REDESIGN_NOT_ALLOWED`.
3. `applySpecChangeInTx(origin DIRECT_EDIT)`.
4. If `REDESIGN`, call `sendBackForCustomerChangeInTx` (transition to `REWORK_REQUIRED` +
   `CUSTOMER_CHANGE` + Return + notify designer).
5. Otherwise, if `assigneeId`, notify the designer with `work_item.customer_modification`. When the
   state is `WAITING_REVIEW`, also notify `usersWithPermission("design.review")` (FR-008).

### `createChangeRequest(actor, input): Promise<{ changeRequestId: string }>`

```ts
input = { workItemId: string; patch: SpecPatch; reason: string }
```

1. Take a row lock on the Work Item. If the state is not `IN_PRODUCTION`, refuse with
   `NOT_IN_PRODUCTION`. If a CR is already `PENDING`, refuse with `CHANGE_REQUEST_PENDING`.
2. Run `ensureCurrentSpecVersionInTx`, and dry-run the diff of the patch against it. An empty diff
   refuses with `NO_CHANGES`.
3. Insert the `ChangeRequest` (`PENDING`, `baseSpecVersionId = current.id`).
4. If an open `ACTIVE` `PhaseTiming` segment exists (`tx.phaseTiming.findFirst({ where: {
   workItemId, kind: "ACTIVE", endedAt: null } })`), close it with 002's
   `closeOpenSegment(tx, { workItemId, kind: "ACTIVE" })` and set `pausedRunningTimerAt = now`.
   `closeOpenSegment` returns `void`, so the existence check comes first. This is the same end
   state as 014's `pauseProduction`.
5. Notify with `work_item.change_requested`, sent to the effective department plus
   `usersWithPermission("change.approve")`.

### `approveChangeRequest(actor, input): Promise<{ version: number; outcome: ChangeRequestOutcome }>`

```ts
input = { changeRequestId: string; outcome: "CONTINUE_PRODUCTION" | "REDESIGN"; note?: string }
```

1. Load the CR and its Work Item. A missing CR refuses with `NOT_FOUND { entity: "ChangeRequest" }`. If
   `status ≠ PENDING`, refuse with `CHANGE_REQUEST_ALREADY_DECIDED`. If the Work Item state is not
   `IN_PRODUCTION`, refuse with `WORK_ITEM_LEFT_PRODUCTION`. `REDESIGN` requires
   `requiresDesign ∧ assigneeId`, else `REDESIGN_NOT_ALLOWED`.
2. Run `applySpecChangeInTx({ origin: "CHANGE_REQUEST", expected: { specVersionId:
   baseSpecVersionId }, patch: parse(proposedPatch), reason: requestReason })`. A base that is no
   longer current refuses with `STALE_SPEC_VERSION` (US3-8).
3. Guarded update: `updateMany({ where: { id, status: "PENDING" }, data: { status: "APPROVED",
   outcome, decidedById, decidedAt, decisionNote, resultingSpecVersionId } })`. If
   `count ≠ 1`, refuse with `CHANGE_REQUEST_ALREADY_DECIDED`.
4. The outcome decides what follows:
   - `CONTINUE_PRODUCTION`: notify the department with `work_item.revised_instruction`. The hold
     is now `REVISION_UNACKNOWLEDGED`.
   - `REDESIGN`: call `sendBackForCustomerChangeInTx(tx, { meta: { changeControl:
     "CHANGE_REQUEST_APPROVAL", changeRequestId } })`, then set `returnId`. The Work Item leaves
     `IN_PRODUCTION`, so there is no hold.
5. Notify the requester.

### `rejectChangeRequest(actor, { changeRequestId, reason })` / `withdrawChangeRequest(actor, { changeRequestId, reason })`: `Promise<void>`

- Guarded update to `REJECTED`/`WITHDRAWN` with `decisionNote = reason`. `count ≠ 1` refuses with
  `CHANGE_REQUEST_ALREADY_DECIDED`.
- No version is written.
- Notify the requester and the department. The hold lifts immediately.

### `listPendingChangeRequests(actor, { cursor?: string; limit?: number }): Promise<{ rows: PendingChangeRequestRow[]; nextCursor: string | null }>`

- `limit` defaults to 50, maximum 100. Ordering is `order.priority desc`, `createdAt asc`, `id
  asc`. There is a single `findMany` with `include` (research §17).
- The `proposedPatch` is parsed per row in memory.

```ts
PendingChangeRequestRow = {
  changeRequestId;
  workItemId;
  orderNumber;
  customerName;
  productTypeName;
  priority;
  requestedByName;
  createdAt;
  changedFields: SpecField[];
}
```

### `getChangeRequestDetail(actor, { changeRequestId }): Promise<ChangeRequestDetail>`

Returns the CR, its base `SpecVersionView`, the current version number,
`diffSpecSnapshots(base, merge(base, patch))`, the Work Item state, and `requiresDesign`/
`assigneeId`, so the UI knows whether `REDESIGN` is offered.

### `getProductionHold(client, workItemId): Promise<ProductionHold | null>`

```ts
ProductionHold =
  | { kind: "CHANGE_PENDING"; changeRequestId: string }
  | { kind: "REVISION_UNACKNOWLEDGED"; changeRequestId: string }
```

It accepts `db` or a `tx`. It is used by the guards, 014's `resumeProduction`, and 014's
`getJobCard`.

### `acknowledgeSpecRevision(actor, { workItemId }): Promise<void>`

- A hold kind other than `REVISION_UNACKNOWLEDGED` refuses with `NOTHING_TO_ACKNOWLEDGE`. A
  `CHANGE_PENDING` hold cannot be acknowledged away.
- One `updateMany({ where: { workItemId, status: "APPROVED", outcome: "CONTINUE_PRODUCTION",
  productionAcknowledgedAt: null } })` sets `productionAcknowledgedAt/ById` on **every**
  unacknowledged approval of the Work Item. Two approvals can pile up: approve, then a new request
  is approved before the operator acknowledges. The operator acknowledges the current instruction,
  which supersedes both. One `change_request.acknowledged` audit is written per acknowledged row.
- It does not restart the timer. The operator then resumes with 014's `resumeProduction`.

### `getProductionStartSpecDiff(client, workItemId): Promise<{ startVersion: number | null; currentVersion: number | null; changes: SpecFieldChange[] }>`

Used by 014's `getJobCard` (FR-020). Two queries (research §17).

### `cancelAfterProductionStarted(actor, input): Promise<{ lateCancellationId: string }>`

```ts
input = {
  workItemId: string;
  reason: string;
  costIncurred: string;           // decimal string, >= 0, <= 2 dp
  producedQuantitySoFar?: number;
  costNote?: string;
}
```

1. If the state is not one of `IN_PRODUCTION`/`PRODUCTION_COMPLETED`/`READY_FOR_COLLECTION`,
   refuse with `LATE_CANCEL_NOT_APPLICABLE`.
2. Close any `PENDING` CR as `CLOSED_BY_CANCELLATION` and audit it.
3. Insert `LateCancellation`.
4. `ctx.transition({ to: "CANCELLED", reason, meta: { changeControl: "LATE_CANCELLATION",
   lateCancellationId } })`. `transitionWorkItem` already closes the open `ACTIVE` and `QUEUE`
   segments (transition.ts step 5), which stops the timer (FR-025).
5. `getDirectCostPort().recordLateCancellationCost(tx, …)`.
6. Notify the order's creator and the department.

### `adminOverrideSpec(actor, input): Promise<{ version: number; changeRequestId: string | null }>`

```ts
input = {
  workItemId: string;
  expectedVersion: number;
  patch: SpecPatch;
  reason: string;
  outcome?: "CONTINUE_PRODUCTION" | "REDESIGN";
  designChoice?: "REDESIGN" | "KEEP_DESIGN";
  originDepartmentId?: string;
}
```

1. `CANCELLED` refuses with `WORK_ITEM_LOCKED`. A `PENDING` CR refuses with
   `CHANGE_REQUEST_PENDING`. An unacknowledged approved revision refuses with
   `REVISION_UNACKNOWLEDGED`: the floor must confirm the instruction it has before the Admin
   changes it again, and a `REDESIGN` override would otherwise be blocked by the `CHANGE_HOLD`
   guard mid-transaction.
2. If the state is `IN_PRODUCTION`, `outcome` is required. Insert the CR directly as `APPROVED`
   (`isAdminOverride: true`, `requestReason = reason`, `decidedById = requestedById = actor`), then
   apply the version with `origin ADMIN_OVERRIDE`. The effects are the same as
   `approveChangeRequest` step 4 (FR-028).
3. If the state is before production, the same `designChoice` rule as `editSpec` applies.
4. If the state is after production, the version is written with no state change. PRD §46: the
   previous state is preserved as the prior version.

## 011 / 014 touch points (additive)

- `cancelOrder(actor, orderId, reason)` gains a return field: `{ cancelledWorkItemIds: string[];
  requiresLateCancellation: string[] }`. Work Items whose cancel failed with guard code
  `LATE_CANCELLATION_REQUIRED` are listed there instead of being silently skipped (FR-026).
- `DomainProductionErrorCode` gains `"CHANGE_HOLD"`. `resumeProduction` throws it while
  `getProductionHold` is non-null. Completion and send-back surface the guard failure as their
  existing `WorkItemTransitionError` with `guardCode: "CHANGE_HOLD"`. 014 does not adopt the aspect
  layer in 016. Only 016's own commands see the mapped `ChangeError { code: "CHANGE_HOLD" }`.
- `JobCard` gains `{ changeHold: ProductionHold | null; specVersion: number | null;
  productionStartDiff: SpecFieldChange[] }`.
