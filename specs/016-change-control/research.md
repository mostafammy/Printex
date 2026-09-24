# Phase 0 Research: Order Change Control

## §1. No spec-snapshot mechanism exists today. Add a new `SpecVersion` model and keep the Work Item columns as a mirror

**Finding (verified in code)**: `src/server/core/workflow/snapshot.ts` defines
`WorkItemSnapshot`. It is a read-only projection of the `WorkItem` row (id, orderId,
productTypeId, departmentId, state, requiresDesign, requiresReview, assigneeId, timestamps) that
`transitionWorkItem` hands to guards and returns after a transition. It carries **no
specification fields** (no quantity, dimensions, material) and persists nothing, so it is not a
spec-versioning mechanism and there is nothing to extend. `prisma/schema/core.prisma` has no
version or history table for specifications. The only trace of past specifications is
`AuditEvent` rows written by 011's `editWorkItem` (`action: "workitem.edited"`), and those hold
before/after values **for the patched keys only**.

**Decision**: Add a new immutable `SpecVersion` model (one row per version, `@@unique([workItemId,
version])`) and a `WorkItem.currentSpecVersionId` pointer. The existing `WorkItem` specification
columns (`productTypeId`, `description`, `quantity`, `widthValue`, `heightValue`,
`dimensionUnit`, `material`, `finishNotes`) **stay**. They become a denormalized mirror of the
current version and are written only by the single write path (§3), in the same transaction as
the pointer.

**Rationale**: Every existing reader already selects those columns: 011's `getOrderDetail`, 013's
`getReviewDetail`, and 014's `getJobCard` (`spec: { quantity, widthValue, … }`). Moving the
values behind the pointer would force edits to all of them and make the migration destructive.
Keeping the mirror makes the migration purely additive (constitution quality gate: no destructive
migration on operational tables). The version table becomes the history, and the columns stay
the fast "current" read.

**Alternatives considered**: (a) Extending `WorkItemSnapshot`. Rejected: it is an in-memory guard
projection, not storage, and adding spec fields would change 002's frozen guard contract. (b)
Removing the columns from `WorkItem` and always reading through the pointer. Rejected: destructive
migration that touches every existing reader. (c) Reconstructing history from `AuditEvent` on
demand. Rejected: incomplete (patched keys only) and not a queryable current version.

## §2. Typed columns in `SpecVersion`, a validated JSON patch in `ChangeRequest`

**Decision**: `SpecVersion` stores each specification field as a typed column mirroring
`WorkItem` exactly (`Int?`, `Decimal? @db.Decimal(10, 2)`, `WorkItemDimensionUnit?`, …).
`ChangeRequest.proposedPatch` is `Json`, validated on write **and** re-parsed on read by the same
Zod `specPatchSchema` (contracts/change-control.md), so application code only ever handles the
typed `SpecPatch`.

**Rationale**: A version is permanent, queryable history (e.g. "all versions with quantity > X"
for later analytics), and typed columns keep Decimal exactness and enum integrity at the database
level. A proposal is a short-lived, partial input where "field absent" must differ from "field
set to X". A JSON object carries that naturally, whereas typed columns would need a parallel
"which fields are proposed" array.

**Alternatives considered**: A JSON `SpecVersion.content`. Rejected: it loses DB-level typing for
the permanent record. Typed nullable columns plus a `proposedFields String[]` on `ChangeRequest`.
Rejected: two sources of truth for one patch.

## §3. One write path for specifications: `applySpecChangeInTx`

**Decision**: Every write of specification fields goes through
`applySpecChangeInTx(tx, input)` in `src/server/changes/versions.ts`. It:

1. Ensures a current version exists (`ensureCurrentSpecVersionInTx` creates a `BACKFILL` v1 if
   the pointer is null: factory-built items, a missed backfill, §14).
2. Checks `expectedVersion` against it.
3. Computes the diff (§16) and refuses `NO_CHANGES` if the diff is empty.
4. Inserts version `n + 1`.
5. Updates the `WorkItem` mirror columns and pointer.
6. Emits `SPEC_CHANGED` (§9).

Creation paths call `createInitialSpecVersionInTx(tx, { workItemId, actorId })` right after
`tx.workItem.create` inside their existing transaction. That covers 011's `quickCreateOrder`,
`createOrder`, and `addWorkItem`. 011's `editWorkItem` keeps its exact public contract
(`order.edit`, `PAST_EDIT_WINDOW` outside `NEW`/`ASSIGNED`, so 011's existing tests stay valid).
Internally it routes its spec fields through `applySpecChangeInTx` (origin `DIRECT_EDIT`), and
`dueDate` stays its own audited update (spec FR-031).

**Rationale**: FR-010 requires "exactly one way a specification is written". A second write path
(011's raw `tx.workItem.update`) would let a future caller bypass versioning without noticing.

**Alternatives considered**: A Prisma client extension or `$use` middleware that versions every
`workItem.update` automatically. Rejected: it is implicit and cannot enforce the state policy or
the `expectedVersion` check, since it has no business context, and it would also fire on unrelated
updates such as 014's `pendingFileRevisionAt`.

## §4. Edit policy is a pure, exhaustive function of state

**Decision**: `specEditPolicy(state: WorkItemState): SpecEditPolicy`, where `SpecEditPolicy =
"DIRECT" | "CHANGE_REQUEST" | "ADMIN_ONLY" | "LOCKED"`, implemented as a `switch` ending in 002's
`assertNever` (compile-time exhaustiveness: adding a 16th state fails the build until it is
classified). Companion pure function: `redesignChoice(state, requiresDesign): "REQUIRED" |
"FORBIDDEN"`, which is `REQUIRED` only for `APPROVED | WAITING_PRICING | READY_FOR_PRODUCTION`
with `requiresDesign`. Every entry point (`editSpec`, `createChangeRequest`, `adminOverrideSpec`)
calls the policy first, after loading state in its transaction.

**Rationale**: The policy is the gate (US2). A pure function can be unit-tested over all 15
states with no database, and the state-machine table stays as data (constitution V spirit,
mirrors 002's `ALLOWED_EDGES`).

**Alternatives considered**: Encoding the policy as guards on pseudo-transitions. Rejected: a spec
edit is not a state transition (same reasoning as 014 research §4). Per-function `if` chains.
Rejected: they are not exhaustive and drift between functions.

## §5. The production freeze: derived from `ChangeRequest` rows, enforced by guards plus one plain check

**Decision**: There is no new `WorkItem` column. A Work Item is on hold if and only if it has a
`ChangeRequest` that is `PENDING`, or `APPROVED` with `outcome = CONTINUE_PRODUCTION` and
`productionAcknowledgedAt IS NULL`. `getProductionHold(client, workItemId): Promise<ProductionHold
| null>` returns that condition as a discriminated union (`{ kind: "CHANGE_PENDING" } | { kind:
"REVISION_UNACKNOWLEDGED" }`). Enforcement:

- **Completion** (`IN_PRODUCTION → PRODUCTION_COMPLETED`) and **send-back**
  (`IN_PRODUCTION → REWORK_REQUIRED`) are real state transitions. The changes module registers a
  `registerGuard({ from: "IN_PRODUCTION", to })` for each, which fails with `guardCode:
  "CHANGE_HOLD"` while a hold exists. These guards run inside 002's `transitionWorkItem`, so
  014's `completeProduction` and `sendBackToDesign` are protected with **no code change** there,
  and so is any future caller.
- **Resume** is not a transition (014 research §4), so 014's `resumeProduction` gains one plain
  check: `if (await getProductionHold(tx, id)) throw new DomainProductionError("CHANGE_HOLD")`.
  This is the one required edit inside `src/server/production/**` besides the job-card read
  additions.
- **Auto-pause**: in its own transaction, `createChangeRequest` looks up an open `ACTIVE`
  segment. If one exists, it closes it with 002's `closeOpenSegment(tx, { workItemId, kind:
  "ACTIVE" })`, which returns `void`, and records `pausedRunningTimerAt`. The end state is the same
  as 014's `pauseProduction`, so 014's existing resume logic reopens the segment once the hold
  lifts.
- **Self-exemption**: 016's own "send back to design" on approval is itself `IN_PRODUCTION →
  REWORK_REQUIRED` while the request is still `PENDING` in committed data. It passes `meta: {
  changeControl: "CHANGE_REQUEST_APPROVAL", changeRequestId }`, and the guard allows exactly the
  pending request named in `meta`.

**Invariant**: a hold exists only while the Work Item is `IN_PRODUCTION`. Every exit from
`IN_PRODUCTION` is refused while a hold exists, except 016's own approval transition and late
cancellation. Late cancellation closes pending requests in the same transaction, and an
unacknowledged approval is moot once the item is terminal. So a stale hold can never re-block a
Work Item that later re-enters production. (Contrast: 014's `pendingFileRevisionAt` is not
cleared by `sendBackToDesign` today, as confirmed in `src/server/production/sendBack.ts`. 016 does
not copy that shape.)

**Rationale**: Guards are the existing open/closed extension point built exactly for "inject
policy into `transitionWorkItem` without core knowing" (`guards.ts` header). Deriving the hold
from request rows means there is no second flag to keep in sync and no cleanup job.

**Alternatives considered**: Reusing 014's `pendingFileRevisionAt`. Rejected: it means "a newer
*design file* was approved", which is different semantics. The ack UI would say the wrong thing,
and it does not cover the pending (pre-decision) freeze. A `WorkItem.changeHoldAt` column.
Rejected: a second source of truth needing clearing on every exit path.

## §6. Late cancellation is enforced by a guard on `→ CANCELLED` from production states

**Decision**: Register `registerGuard({ from, to: "CANCELLED" })` for `from ∈ { IN_PRODUCTION,
PRODUCTION_COMPLETED, READY_FOR_COLLECTION }` (every production-started state that
`ALLOWED_EDGES` lets reach `CANCELLED`; `DELIVERED` has no such edge). The guard fails with
`guardCode: "LATE_CANCELLATION_REQUIRED"` unless `ctx.meta.changeControl ===
"LATE_CANCELLATION"`. Only `cancelAfterProductionStarted()` sets that marker, and it inserts the
`LateCancellation` row in the same transaction. The guard checks only the marker. It cannot see
the uncommitted row, because guards read outside the transaction (§18).

**Consequence (verified in code)**: 011's `cancelWorkItem` currently cancels an `IN_PRODUCTION`
item with only a reason (`src/server/orders/cancelOrder.ts`). After 016 it receives
`GUARD_FAILED` and surfaces it as its own `WorkItemTransitionError`, which is its existing contract.
011's `cancelOrder` is best-effort and **silently skips** items whose transition fails, so 016
extends its return value additively with `requiresLateCancellation: string[]` (FR-026), and the
UI shows them.

**Rationale**: A guard protects every path to `CANCELLED`, including future ones, with zero edits
to the paths themselves (constitution V: "no ad hoc" bypass).

**Alternatives considered**: Editing `cancelWorkItem`/`cancelOrder` to refuse by state. Rejected:
it only protects paths that exist today.

## §7. Three new edges into `REWORK_REQUIRED`

**Decision**: In `src/server/core/workflow/edges.ts`: `APPROVED: ["WAITING_PRICING",
"READY_FOR_PRODUCTION", "REWORK_REQUIRED", "CANCELLED"]`, `WAITING_PRICING:
["READY_FOR_PRODUCTION", "REWORK_REQUIRED", "CANCELLED"]`, `READY_FOR_PRODUCTION:
["IN_PRODUCTION", "REWORK_REQUIRED", "CANCELLED"]`.

**Rationale (verified)**: `ALLOWED_EDGES` reaches `REWORK_REQUIRED` only from `WAITING_REVIEW`
(013) and `IN_PRODUCTION` (014). FR-009's pre-production "send back to design" from a state with
an approved design has no edge, so `transitionWorkItem` would return `INVALID_TRANSITION`.
`DESIGN_COMPLETED` is transient (012's `markDesignComplete` chains straight through it) and gets
no edge. `tests/unit/workflow-edges.test.ts` is table-driven from `ALLOWED_EDGES`, so it covers
the new edges automatically.

**Alternatives considered**: Routing redesign to `ASSIGNED`. Rejected: it desynchronizes from
013/014's `REWORK_REQUIRED` history, the same reason as 014 research §2.

## §8. Send-back uses 013's `createReturnInTx` with `CUSTOMER_CHANGE`

**Decision**: A shared internal `sendBackForCustomerChangeInTx(tx, …)` (changes module) calls
`transitionWorkItem(tx, { to: "REWORK_REQUIRED", rejectionCategory: "CUSTOMER_CHANGE", reason,
meta })` and then `createReturnInTx(tx, actor, workItemId, { category: "CUSTOMER_CHANGE",
originDepartmentId, assignedToId: workItem.assigneeId, explanation })`, both imported from
`~/server/review` and `~/server/core` barrels. It then calls `notify(tx, { type:
"work_item.customer_change", recipients: { userIds: [assigneeId] } })`.

**Verified facts**: `CUSTOMER_CHANGE` exists in both the Prisma `RejectionCategory` enum and
`src/server/core/workflow/rejectionCategory.ts` (advisory landing state `IN_DESIGN`).
`createReturnInTx` requires non-null `originDepartmentId` and `assignedToId`
(`Return.originDepartmentId`/`assignedToId` are required columns). `transitionWorkItem` requires
`reason` and `rejectionCategory` for `REWORK_REQUIRED`. So:

- `originDepartmentId` is the Work Item's **effective department** (`departmentId ??
  productType.defaultDepartmentId`, 014 research §8, duplicated as a one-line local helper
  because `changes` must not import `production`, §11). If that is null (only possible
  pre-production), the caller must supply `originDepartmentId`, else
  `ORIGIN_DEPARTMENT_REQUIRED`.
- Redesign requires `requiresDesign && assigneeId !== null`, else `REDESIGN_NOT_ALLOWED`.

**Alternatives considered**: A Customer-change-specific return model. Rejected: 013 built `Return`
to be generic, and 014 reused it the same way.

## §9. `SPEC_CHANGED`: in-transaction listeners plus an outbox row

**Decision**: `src/server/changes/events.ts` exports the constant `SPEC_CHANGED =
"work_item.spec_changed"`, the `SpecChangedEvent` type, and `registerSpecChangeListener(name,
listener)`. `applySpecChangeInTx` calls `emitSpecChangedInTx(tx, event)`, which:

1. Runs every registered listener sequentially **with the caller's `tx`**. A throw propagates and
   rolls back the whole change (FR-022).
2. Writes one `NotificationEvent` via `notify(tx, { type: SPEC_CHANGED, … })` for 053/090.

With no listener registered (051 not built) step 1 is a no-op (FR-023). 051 registers its pricing
reset at module load, the same lifecycle as `registerGuard`.

**Rationale**: The pricing reset must commit atomically with the spec change. Otherwise a crash
between the two leaves a stale "priced" status, and delivery could pass the gate on the old
quantity's price (constitution II). The outbox is only a delivery log for 053 with no in-process
consumer loop, so it cannot drive an atomic reaction. A listener registry keeps the dependency
arrow pointing from 051 to 016, so 016 never imports pricing code (constitution: features talk via
frozen contracts).

**Alternatives considered**: Outbox-only, with 051 polling `NotificationEvent`. Rejected: not
atomic, and there is no polling infrastructure. 016 calling a 051 function directly. Rejected: 051
doesn't exist, and it would invert the dependency. A `registerGuard` on the delivery edge that
re-checks spec versions against price. That is still wanted as a belt-and-braces check on 051's
side, but it is 051's decision and listed as a contract suggestion only.

## §10. Late-cancellation cost goes through a `DirectCostPort`, and `LateCancellation` is the source record

**Decision**: `src/server/changes/ports.ts` defines `DirectCostPort { recordLateCancellationCost(tx,
cost: LateCancellationCost): Promise<void> }`, a default `noopDirectCostPort`, and
`setDirectCostPort(port)` (called once at boot by 052's module). `cancelAfterProductionStarted()`
always writes the `LateCancellation` row first (amount `Decimal(12,2)`, currency `"EGP"`), then
calls the port in the same transaction.

**Rationale**: 052 is not built. Without a local record, the cost would be lost until 052 ships.
With it, 052 can backfill from `LateCancellation` rows (`sourceType: "LATE_CANCELLATION", sourceId:
lateCancellation.id`), which keeps the PRD §30 "traceable to their source" rule. Calling the port
inside the transaction means 052's own row, once it exists, is atomic with the cancellation.

**Alternatives considered**: Writing an `Expense`-like row ourselves. Rejected: that is 052's model
to own. An event listener like §9. Rejected: exactly one consumer exists and it needs a typed,
synchronous call, so a single-adapter port is simpler.

## §11. Cross-cutting aspects: reuse the shared layer in [contracts/aspects.md](./contracts/aspects.md)

**Finding (verified)**: 011–014 contain no shared wrapper, tRPC middleware, or higher-order service
for authorization, transactions, audit, or error mapping. There is no tRPC in this codebase:
`src/app/**` uses inline Server Actions (`"use server"`). Each service function repeats the same
skeleton by hand: `authorize(...)` → `db.$transaction(...)` → `transitionWorkItem` → `if
(!result.ok) throw new WorkItemTransitionError(...)` → `audit.record(tx, …)`. The
`WorkItemTransitionError` class is copy-pasted in five files (`orders/cancelOrder.ts`,
`designers/assignment.ts`, `review/review.ts`, `production/timer.ts`, `production/sendBack.ts`).

**Decision**: Use the **one shared aspect layer**, defined jointly with 015. Its canonical contract
is `specs/015-collection-delivery/contracts/aspects.md`, and a verbatim, kept-in-sync copy is
[contracts/aspects.md](./contracts/aspects.md). 016 does not redefine any of it. The layer has
three parts:

- the generic engine `src/server/core/aspects/**` (`createAspects(deps).forModule<E>()` →
  `{ defineCommand, defineQuery }`, plus `transitionOrThrow`, `fail`, and `AspectResult<T, E>`),
  with auth, audit, and db injected
- the shared composition root `src/server/aspects.ts`
- 016's own binding `src/server/changes/aspect.ts`, which is the only 016-specific part:

  ```ts
  export const { defineCommand, defineQuery } = aspects.forModule<ChangeError>({
    module: "changes",
    mapGuardFailure: (g) =>
      g === "CHANGE_HOLD" ? { code: "CHANGE_HOLD" }
      : g === "LATE_CANCELLATION_REQUIRED" ? { code: "LATE_CANCELLATION_REQUIRED" }
      : undefined,
    mapUniqueViolation: (target) =>
      target.includes("version") ? { code: "STALE_SPEC_VERSION" }          // SpecVersion (workItemId, version)
      : target.includes("workItemId") ? { code: "CHANGE_REQUEST_PENDING" } // partial one-PENDING index
      : undefined,
  });
  export type ChangeResult<T> = AspectResult<T, ChangeError>;
  ```

  See the conflicts note below about `mapUniqueViolation` receiving only `target`.

Whichever of 015 and 016 is implemented first creates the shared files per the contract. The other
reuses them unchanged (tasks T016/T017).

**How 016 uses it**:

- All eight public commands use `defineCommand`: `editSpec`, `createChangeRequest`,
  `approveChangeRequest`, `rejectChangeRequest`, `withdrawChangeRequest`,
  `acknowledgeSpecRevision`, `cancelAfterProductionStarted`, and `adminOverrideSpec`. Each returns
  `ChangeResult<T>` and never throws a domain error.
- Reads (`getSpecHistory`, `getSpecVersionDiff`, `listPendingChangeRequests`,
  `getChangeRequestDetail`) use `defineQuery`.
- The history "anyone who can view the order" rule is an **any-of `PermissionSpec`** array. It
  gets an `authorize` hook that calls `check("production.operate", { departmentId })` when
  `production.operate` is the actor's only qualifying key.
- Entity-scoped checks (acknowledge: department scope) go in the `authorize` hook with `ctx.check`,
  in the same transaction as the write (no TOCTOU).
- Transitions use `ctx.transition` (`transitionOrThrow`). Guard failures come back mapped through
  `mapGuardFailure`.
- Module refusals are raised with `fail({ code: … })`.
- 016 never uses `allowNoChange`. A no-op is a refusal (`NO_CHANGES`, FR-007), and every command
  returns at least one audit entry.
- The in-transaction building blocks (`applySpecChangeInTx`, `createInitialSpecVersionInTx`,
  `sendBackForCustomerChangeInTx`) are plain functions that take a `TxScope`, so a `CommandCtx` can
  be passed straight in. They raise refusals with `fail(...)` (`AspectDomainError`). They are
  called from 016's commands and from 011's hand-written transactions (T028/T029). There,
  `AspectDomainError` simply rolls 011's transaction back. `applySpecChangeInTx` takes `ifUnchanged:
  "fail" | "skip"`, and 011's `editWorkItem` passes `"skip"`, so saving an unchanged form or a
  due-date-only change stays a non-error, as 011 behaves today.

**Alternatives considered**:

- A module-local `src/server/changes/aspects/command.ts`. This was the earlier draft. It was
  superseded so there is one engine for 015, 016, and later modules. Draft-to-shared name mapping:
  `auditAction` → `action`; `scope(tx, input)` → the `authorize` hook with `ctx.check`;
  `ctx.transition` is unchanged; `toChangeActionResult`/`ChangeActionResult` → `AspectResult`
  (already returned by the public call); `DomainChangeError` class → `ChangeError` object union
  raised by `fail()`; `authorizeAny` → the any-of `PermissionSpec`.
- Copy-pasting the skeleton again. Rejected as the anti-pattern above.
- tRPC middleware. Rejected: there is no tRPC here.

**Conflicts / open points with the shared contract** (raised with 015; none blocks 016):

1. `mapUniqueViolation(target)` receives only the column list, not the model or index name. For
   016, `["workItemId", "version"]` means `SpecVersion` and is unambiguous. `["workItemId"]` could
   be the `ChangeRequest` partial index or `LateCancellation.workItemId`. 016 maps it to
   `CHANGE_REQUEST_PENDING`, which is safe because a second `LateCancellation` is impossible (the
   Work Item is already `CANCELLED`, so the state check refuses first). For a raw-SQL partial
   index, Prisma may report the **index name** as `target`, and the mapping must tolerate both. A
   future contract revision should pass `modelName` too.
2. `SPEC_CHANGED` listener veto: a listener throwing an arbitrary error is an *unknown* error to
   the engine, so it is re-thrown (the transaction still rolls back, which FR-022 requires). A
   listener that wants a *typed* refusal must throw `fail({ code: "SPEC_CHANGE_VETOED", listener,
   reason })`. That code is part of `ChangeError`, so it surfaces as a normal
   `AspectResult` error, not a 500 (contracts/events-and-ports.md §1). A listener raising a
   foreign module's `AspectDomainError` would leak an out-of-union code, so the contract forbids
   it.
3. The freeze guard and the late-cancel guard run inside 002's `transitionWorkItem`. That covers
   callers that don't use the aspect layer (014's `completeProduction`/`sendBackToDesign`, 011's
   cancel paths), and they keep surfacing their own `WorkItemTransitionError`. Only 016's own
   commands see `CHANGE_HOLD`/`LATE_CANCELLATION_REQUIRED` as mapped `ChangeError`s. No conflict,
   but the error shape differs by caller until the later refactor adopts `transitionOrThrow`
   everywhere.
4. `afterCommit` is not used by 016. Notifications are outbox rows written in the transaction, and
   the pricing reset must be *in* the transaction (FR-022). So nothing in 016 depends on hook
   ordering.

## §12. New permission key `change.approve`

**Decision**: Add `"change.approve"` to the `Permission` union and `ALL_PERMISSIONS` in
`src/server/auth/permissions.ts` (22 → 23 keys). Seed it to `HEAD_DESIGNER` and `ADMIN_OWNER` in
`prisma/seed.ts`, and update `tests/contract/role-permission-matrix.test.ts`. Recording and
withdrawing use the existing `order.edit`. Late cancellation uses the existing `order.cancel`.
Admin override uses the existing `admin.override`. Acknowledgment uses the existing
`production.operate` with `{ departmentId }` scope.

**Rationale**: Clarification Q1. `permissions.ts` states that adding a key is a code change (new
code path), while *which role gets it* is DB data and configurable (constitution VI). **001 is
Fady's feature**, so this is a cross-team contract (plan.md).

**Alternatives considered**: Reusing `design.review`, rejected in the spec's Clarifications.

## §13. Concurrency

- **Two direct edits from the same version**: `editSpec` requires `expectedVersion`. Inside the
  transaction the current version is read and compared, which refuses the stale one with
  `STALE_SPEC_VERSION`. `@@unique([workItemId, version])` is the final backstop: a lost race
  surfaces as a Prisma `P2002`, which is mapped to `STALE_SPEC_VERSION`.
- **Two pending change requests**: `createChangeRequest` takes a row lock (`SELECT id FROM
  "WorkItem" WHERE id = $1 FOR UPDATE` via `tx.$queryRaw`) before checking for a pending request.
  That serializes creators per Work Item. Defense in depth: a partial unique index, `CREATE UNIQUE
  INDEX IF NOT EXISTS "ChangeRequest_one_pending_per_work_item" ON "ChangeRequest"("workItemId")
  WHERE status = 'PENDING'`, applied by manual SQL (§14), because Prisma schema cannot express a
  partial index.
- **Two approvers deciding at once**: the decision uses `updateMany({ where: { id, status:
  "PENDING" } })` with `count === 1`, else `CHANGE_REQUEST_ALREADY_DECIDED`. This is the same
  optimistic pattern as `transitionWorkItem`.
- **Change request vs completion race**: the completion guard reads committed data, so a
  completion whose guard ran just before the request committed can still land. This is a residual
  window of milliseconds that cannot be closed without changing `transitionWorkItem`'s
  optimistic `where`, which is out of scope. It is handled rather than hidden: approval refuses
  with `WORK_ITEM_LEFT_PRODUCTION`, the request is then rejected, and any change goes through an
  Admin override. Every step is audited (spec Edge Cases).

## §14. Schema delivery, backfill, and data preservation

**Finding (verified)**: The project applies schema with `prisma db push`, not `prisma migrate`.
`prisma/migrations/` stops at `20260923160000_orders_reception`, 012–014's `tasks.md` T002 all use
`db push`, and `prisma/manual-sql/audit-event-append-only.sql` says "since this project uses
prisma db push". Constitution says schema changes MUST ship as Prisma migrations. This is a
pre-existing, project-wide deviation, recorded in plan.md's Complexity Tracking rather than fixed
here.

**Decision**:

1. **DDL**: additive only. New file `prisma/schema/change-control.prisma` (3 enums, 3 models),
   plus additive back-relations in `core.prisma`/`identity.prisma`, plus one nullable column
   `WorkItem.currentSpecVersionId`. Apply with the team's standard, blocked-on-Fady `db push` step
   (tasks T002).
2. **Backfill**: `prisma/manual-sql/016-spec-version-backfill.sql`, applied with `pnpm exec prisma
   db execute --file … --schema prisma/schema`. It is idempotent (`WHERE NOT EXISTS`,
   deterministic id `'bf_' || "WorkItem".id`) and runs in a single transaction. It inserts one
   `BACKFILL` v1 per Work Item without a version, points `currentSpecVersionId` at each Work
   Item's highest version, and writes one system `AuditEvent` (`action:
   "spec_version.backfilled"`, `entityType: "Migration"`, `entityId: "016-change-control"`,
   `after: { count }`, `actorId: null`). It does not touch `WorkItem.updatedAt`.
3. **Constraints and append-only**: `prisma/manual-sql/016-change-control-constraints.sql` holds
   the partial unique index (§13) and `REVOKE UPDATE, DELETE ON "SpecVersion", "LateCancellation"
   FROM CURRENT_USER`, mirroring `audit-event-append-only.sql` (the same non-superuser
   prerequisite applies). Every statement is idempotent. It MUST be re-applied after any `db push`,
   in case Prisma drops the index it cannot model. The app-level row lock (§13) keeps correctness
   even if the index is missing.
4. **Verification** (must return 0 rows, run after backfill and in tasks' quickstart):
   `SELECT id FROM "WorkItem" WHERE "currentSpecVersionId" IS NULL`, and a column-by-column
   `IS DISTINCT FROM` comparison between every `WorkItem` and its current `SpecVersion`.
5. **Self-healing**: `ensureCurrentSpecVersionInTx` (§3) creates a `BACKFILL` v1 at first write
   for any Work Item the backfill missed, or one created between `db push` and the backfill. So
   the order of deployment steps is not load-bearing for correctness.
6. **Data preservation and rollback**: no existing column, row, or audit event is altered or
   dropped. The only `UPDATE` sets a previously-null pointer. Rolling back means redeploying the
   previous app build. The new tables stay in place, since they hold history, and the old code
   ignores them. If they must ever be dropped, `pg_dump -t '"SpecVersion"' -t '"ChangeRequest"' -t
   '"LateCancellation"'` first. Backups: all new tables live in the existing Postgres database, so
   they are already inside the backup scope (constitution: no new persistent store).

**Why `currentSpecVersionId` stays nullable in the database**: `WorkItem` and `SpecVersion`
reference each other, so one side must be insertable first (the Work Item, pointer null) within
the creating transaction. Nullable also lets the column exist before the backfill runs. The
invariant "non-null for every Work Item" is enforced by the single write path, the verification
query, and a contract test (tasks), not by a NOT NULL constraint.

**Alternatives considered**: Rebuilding history from audit events (rejected in the spec's
Clarifications). A NOT NULL pointer via a three-step migration. Rejected: the circular insert
still needs a deferrable FK, and `db push` cannot express `DEFERRABLE`.

## §15. Schema file placement

**Decision**: New models live in `prisma/schema/change-control.prisma`, not appended to
`core.prisma`. Only the unavoidable back-relation lines touch `core.prisma` (`WorkItem`,
`ProductType`, `Return`) and `identity.prisma` (`User`).

**Rationale**: Prisma's multi-file schema is already in use (`schema.prisma` holds only
generator/datasource; `customer.prisma` is 010's own file). Fady's 051/052 will add pricing and
finance models concurrently, so a separate file keeps merge conflicts to a few back-relation lines.

## §16. Diff: a pure typed function plus a presentational component

**Decision**: `diffSpecSnapshots(before: SpecSnapshot, after: SpecSnapshot):
readonly SpecFieldChange[]` in `src/server/changes/diff.ts`. It has no I/O and returns entries in
the fixed `SPEC_FIELDS` order. `SpecSnapshot` normalizes Decimals to canonical strings
(`new Prisma.Decimal(v).toString()` trims trailing zeros, so `1.50` and `1.5` compare equal,
FR-019). `SpecFieldChange` is a discriminated union keyed by `field` (a mapped type over
`SpecSnapshot`), so `change.field === "quantity"` narrows `before`/`after` to `number | null`. `<SpecDiff
changes={…} />` (`src/components/changes/spec-diff.tsx`) is a Server Component that only renders
(Arabic labels, logical properties, "—" for null). The same function computes `changedFields` for
`SPEC_CHANGED` and the `NO_CHANGES` check, so the event, the refusal, and the screen can never
disagree.

**Alternatives considered**: A generic deep-diff library. Rejected: a new dependency for eight
fields, and it is untyped. Text diff of JSON. Rejected: `1.50`/`1.5` would appear as changes.

## §17. Query shapes, indexes, and pagination (no N+1)

| Query | Shape | Index |
|---|---|---|
| Spec history of a Work Item | one `specVersion.findMany({ where: { workItemId }, orderBy: { version: "asc" }, include: { createdBy: { select: { name } } } })` | `@@unique([workItemId, version])` |
| Two versions for a diff | one `findMany({ where: { workItemId, version: { in: [a, b] } } })` | same |
| Production hold check | one `changeRequest.findFirst({ where: { workItemId, OR: [pending, approvedUnacked] }, select: { id, status } })` | `@@index([workItemId, status])` |
| Approver queue (FR-017) | one `changeRequest.findMany({ where: { status: "PENDING" }, orderBy: [{ workItem: { order: { priority: "desc" } } }, { createdAt: "asc" }, { id: "asc" }], take: limit + 1, cursor, include: { workItem: { select: { id, state, order: { select: { number, priority, customer: { select: { name } } } }, productType: { select: { name } } } }, baseSpecVersion: true, requestedBy: { select: { name } } } })`. Prisma resolves `include` with batched `IN` queries (constant number of round trips, not per row). `URGENT` sorts first because Postgres orders enums by declaration (`NORMAL`, `URGENT`) and the order is `desc`. | `@@index([status, createdAt])` |
| Job-card revision (FR-020) | two queries: latest `WorkItemTransition` to `IN_PRODUCTION` (`@@index([workItemId, at])`, existing), then `specVersion.findFirst({ where: { workItemId, createdAt: { lte: at } }, orderBy: { version: "desc" } })` | existing + unique |
| Approver notification recipients | one `user.findMany({ where: { isActive: true, OR: [{ roles: { some: { role: { permissions: { some: { permission } } } } } }, { extraPermissions: { some: { permission } } }] }, select: { id } })` | existing `role_permission` unique `(roleId, permission)` |

History is not paginated: a Work Item's version count is small, since each version is a deliberate
human action, and the page shows all of them. The approver queue is paginated (`limit` default
50, max 100, cursor = `ChangeRequest.id`).

## §18. Guards read outside the transaction (013 precedent), and what that implies

**Finding**: `GuardContext` has no `tx` (`guards.ts`), and 013's no-self-review guard reads via the
global `db`. 016's guards do the same. They see **committed** data only. That is why late
cancellation uses a `meta` marker rather than looking for its own uncommitted row (§6), why the
approval self-exemption uses `meta.changeRequestId` (§5), and why the completion race in §13
exists. Guards are process-global and registered as an import side effect of `~/server/changes`'s
barrel. `~/server/orders` and `~/server/production` both import that barrel, so they are always
registered before any cancel or completion path runs. A contract test asserts that importing
`~/server/production` alone registers the hold guards. Vitest isolates modules per test file by
default, so `tests/unit/workflow-edges.test.ts`, which imports only `~/server/core`, stays
unaffected.

**Boot-time registration (belt and braces)**: registration by import side effect only works on
routes whose module graph imports the barrel. A future path, such as a route that cancels without
importing `orders`, could run with the guards missing. 013's no-self-review guard has the same
latent exposure. The shared `src/instrumentation.ts` hook is the single registration point, agreed
with 015, and it is created by whichever feature lands first. Its `register()` has one block per module. 016's block does `await
import("~/server/changes")`, then calls `registerChangeGuards()`. `registerChangeGuards()` is
idempotent through a module-level `registered` flag, because 002's `registerGuard` appends on every
call. The barrel also calls it on import, so vitest, the seed, and scripts, which do not run
`instrumentation.ts`, are covered too.

**Residual risk**: the `meta.changeControl` markers are not a cryptographic boundary. Any server
code that calls `transitionWorkItem` could forge one. This is acceptable because only server code
can call it. The markers are constructed only in `src/server/changes/**`, and a Polish task in
tasks.md greps that no other `src/**` file contains the literal `changeControl`.

## §19. Notification recipients from configured data

**Decision**: Recipients are always resolved from data, never role names in code (constitution
VI):

- The assigned designer is `WorkItem.assigneeId`.
- The production department is `departmentIds: [effectiveDepartmentId]`.
- The requester is `ChangeRequest.requestedById`.
- Approvers and design reviewers come from `usersWithPermission(tx, "change.approve" |
  "design.review")` (§17), so reassigning a permission in Admin automatically changes who is
  notified.
