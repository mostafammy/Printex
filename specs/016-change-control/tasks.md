---

description: "Task list for 016 Order Change Control"
---

# Tasks: Order Change Control

**Input**: Design documents from `/specs/016-change-control/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/change-control.md](./contracts/change-control.md), [contracts/events-and-ports.md](./contracts/events-and-ports.md), [contracts/spec-diff.md](./contracts/spec-diff.md), [contracts/aspects.md](./contracts/aspects.md) (shared, canonical copy), [quickstart.md](./quickstart.md)

**Tests**: Included, and **required**. The constitution requires server-path tests for every gate,
forbidden transition, and permission, and the brief requires every acceptance criterion to map to a
test. plan.md's Project Structure lists the test files. Every gate and permission test calls the
**server entry point** (service function), never UI logic.

**Organization**: Tasks are grouped by user story. spec.md has 7 stories, with priorities
P1/P1/P1/P1/P2/P2/P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to spec.md's US1–US7
- Every task names its exact file path

## Path Conventions

Single Next.js project (plan.md Project Structure):

- `src/server/changes/**`, `src/components/changes/**`, `src/app/(shell)/**`
- `prisma/schema/change-control.prisma`, `prisma/manual-sql/016-*.sql`
- `tests/{unit,contract,integration}/changes/**`

Vitest collects only `tests/**/*.test.ts`, so there are no `.tsx` test files.

**Brief acceptance criteria → test tasks** (verification loop):

| Acceptance criterion | Scenario | Test task(s) |
|---|---|---|
| Direct `editSpec` on `IN_PRODUCTION` is refused server-side | US2-3 | T034 |
| v1 and v2 both viewable with a diff | US1-2, US3-4, US4-1 | T022, T041, T055 |
| An approved change on a priced item resets pricing to PENDING | US5-1 | T060 (stand-in listener). 051 owns the real-listener test (contracts/events-and-ports.md §1) |
| Every step is in the audit log | FR-029, SC-007 | T071 (plus per-story audit assertions) |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the schema, SQL, edges, permission key, and module scaffolding that every story
builds on.

- [x] T001 Create `prisma/schema/change-control.prisma` exactly per data-model.md:
  - enums `SpecVersionOrigin`, `ChangeRequestStatus`, `ChangeRequestOutcome`
  - models `SpecVersion` (`@@unique([workItemId, version])`), `ChangeRequest`
    (`@@index([workItemId, status])`, `@@index([status, createdAt])`), and `LateCancellation`
    (`workItemId @unique`)

  Add `WorkItem.currentSpecVersionId String? @unique` plus the `currentSpecVersion`,
  `specVersions`, `changeRequests`, and `lateCancellation` relations in
  `prisma/schema/core.prisma`. Add the `ProductType.specVersions` and `Return.changeRequest`
  back-relations there too. Add the five `User` back-relations in `prisma/schema/identity.prisma`.
  Run `pnpm exec prisma validate --schema prisma/schema` and `pnpm exec prisma generate`.
- [ ] T002 **ACTION REQUIRED: blocked, do not run unattended.** Run `pnpm exec prisma db push
  --schema prisma/schema`, then `pnpm exec prisma db seed`, to apply T001 and T003.
  - **Blocker**: this is the same shared-dev-DB drift noted in every prior feature's T002
    (011–014). Confirm with Fady (schema owner, Track B) before pushing.
  - `db push` MUST report no data-loss warnings. The change is additive only (data-model.md
    "Step 1"). If it warns, stop and investigate.
  - Whoever picks this up: (1) confirm with Fady, (2) run the commands, (3) run T004 and T005,
    (4) re-run the DB-dependent suites below.
- [x] T003 [P] **Cross-team (001, Fady).** Add `"change.approve"` to the `Permission` union and
  `ALL_PERMISSIONS` in `src/server/auth/permissions.ts`, with a doc comment citing
  016 FR-013. Append it to the `HEAD_DESIGNER` and `ADMIN_OWNER` permission lists in
  `prisma/seed.ts`. Update `tests/contract/role-permission-matrix.test.ts` to assert that
  `HEAD_DESIGNER` and `ADMIN_OWNER` have it and that `RECEPTION`, `DESIGNER`,
  `PRODUCTION_OPERATOR`, `PRINT_RECEPTION_DELIVERY`, and `ACCOUNTING` do not.
- [x] T004 [P] Create `prisma/manual-sql/016-change-control-constraints.sql` (idempotent): the
  partial unique index `ChangeRequest_one_pending_per_work_item`, `REVOKE DELETE` plus the
  `spec_version_forbid_update` BEFORE UPDATE trigger on `"SpecVersion"` (an FK target, so REVOKE
  UPDATE would break FK locking), and `REVOKE UPDATE, DELETE` on `"LateCancellation"`
  (data-model.md "Step 2"). Use the header comment style
  of `audit-event-append-only.sql`, including the non-superuser prerequisite and "re-apply after
  every `db push`". Apply it with `pnpm exec prisma db execute --file … --schema prisma/schema`
  once T002 is unblocked.
- [x] T005 [P] Create `prisma/manual-sql/016-spec-version-backfill.sql` per data-model.md "Step 3":
  - a single transaction
  - `INSERT … WHERE NOT EXISTS` with the deterministic id `'bf_' || id`
  - point every Work Item at its max version
  - one `audit_event` row
  - Step 4's verification queries as trailing comments

  Re-check every table and column name against the current `prisma/schema/*.prisma`
  (`AuditEvent` is `@@map("audit_event")`, and `attachmentIds` is a non-null `text[]`). Apply after
  T004.
- [x] T006 [P] Add the three edges to `src/server/core/workflow/edges.ts` per data-model.md
  "Workflow edges": `APPROVED`, `WAITING_PRICING`, and `READY_FOR_PRODUCTION` each gain
  `"REWORK_REQUIRED"`. Update the file's header comment to cite 016 research §7.
- [x] T007 [P] Add a `no-restricted-imports` rule for `src/server/changes/**` to
  `eslint.config.js`, identical in shape to the `orders`/`designers`/`review`/`production` rules:
  only `~/server/changes` (the barrel) is importable from outside, and `tests/**` is exempted.
- [x] T008 [P] Create the barrel `src/server/changes/index.ts` as a placeholder (`export {}`),
  populated incrementally. Create `src/components/changes/index.ts` the same way.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure building blocks, and the **shared** aspect layer that every command uses
([contracts/aspects.md](./contracts/aspects.md), a canonical copy owned jointly with 015).

**⚠️ CRITICAL**: No user story implementation task may start until this phase is complete.

- [x] T009 [P] Implement `src/server/changes/errors.ts`: the `ChangeError` object union and
  `ChangeResult<T> = AspectResult<T, ChangeError>`, exactly as in contracts/change-control.md
  "Errors". Refusals are raised with core's `fail()`. There is no error class,
  `WorkItemTransitionError`, or `ChangeActionResult` (superseded by the shared layer, research
  §11).
- [x] T010 [P] Implement `src/server/changes/specFields.ts`: `SPEC_FIELDS`, `SpecField`,
  `SpecSnapshot`, `SpecPatch`, `specPatchSchema` (the Zod rules from data-model.md "Validation
  rules"), `toSpecSnapshot(row)`, and `mergeSpecPatch(base, patch)`. Decimals are normalized to
  canonical strings via `Prisma.Decimal`. No `any`.
- [x] T011 [P] Unit test `tests/unit/changes/specPatchSchema.test.ts`. The schema must refuse:
  - an empty patch
  - an unknown key
  - `quantity` 0, -1, or 1.5
  - a width with 3 decimal places, and width 0
  - a string over 2000 characters

  It must accept `"1.50"` and `1.5` and normalize both to `"1.5"`, and turn `""` into `null`.
- [x] T012 [P] Implement `src/server/changes/policy.ts`:
  - `specEditPolicy(state)`: an exhaustive `switch` with `assertNever` from `~/server/core`
  - `redesignChoice(state, requiresDesign)`
  - `canRedesignOnApproval({ requiresDesign, assigneeId })`

  Implement these per data-model.md "Derived values".
- [x] T013 [P] Unit test `tests/unit/changes/policy.test.ts`: table-driven over **all 15**
  `WORK_ITEM_STATES`, asserting the exact FR-006 mapping (9 DIRECT, 1 CHANGE_REQUEST, 4 ADMIN_ONLY,
  1 LOCKED). Assert that every state is classified, iterating `WORK_ITEM_STATES` so that a 16th
  state fails the test. Also assert the `redesignChoice` truth table.
- [x] T014 [P] Implement `src/server/changes/diff.ts` `diffSpecSnapshots` per
  contracts/spec-diff.md (pure, `SPEC_FIELDS` order, `ADDED`/`REMOVED`/`CHANGED` kinds).
- [x] T015 [P] Unit test `tests/unit/changes/diff.test.ts`: the table in contracts/spec-diff.md.
  This covers quantity only (US4-1), null → value (US4-2), 1.50 vs 1.5 (US4-3), value → null,
  multi-field order, identical, `productTypeId`, and `dimensionUnit`. Include a type-level assertion
  (`expectTypeOf`) that narrowing on `field === "quantity"` yields `number | null`.
- [x] T016 **Shared, with 015. If absent, create per contracts/aspects.md; otherwise reuse
  unchanged.** Check first whether 015 has already landed them. The files are:
  - `src/server/core/aspects/{types,engine,errors,transition}.ts`
  - the barrel additions in `src/server/core/index.ts` (§6)
  - the composition root `src/server/aspects.ts` (§4)
  - the `eslint.config.js` rule (c) `ignores` entry `"src/server/core/aspects/**"` with the
    contract's comment (§1)

  Do not change any of them. A needed change goes back to both contract copies first. **Then**
  (016-owned) create the binding `src/server/changes/aspect.ts`:
  `aspects.forModule<ChangeError>({ module: "changes", mapGuardFailure, mapUniqueViolation })`,
  mapping `CHANGE_HOLD`/`LATE_CANCELLATION_REQUIRED` and `(workItemId, version)` →
  `STALE_SPEC_VERSION`, `workItemId` or the partial index name → `CHANGE_REQUEST_PENDING`
  (research §11 conflicts note 1). It exports `defineCommand`, `defineQuery`, and `ChangeResult`.
- [x] T017 **Shared, with 015. If absent, create per contracts/aspects.md §7; otherwise reuse
  unchanged**: `tests/unit/core/aspects.test.ts`, the engine tests on in-memory fake deps. **Then**
  (016-owned) write the integration test `tests/integration/changes/aspect-binding.test.ts`, using
  a throwaway command built with the changes binding against the real DB:
  - a guard failure with `guardCode: "CHANGE_HOLD"` → `{ ok: false, error: { code: "CHANGE_HOLD"
    } }`
  - a real `(workItemId, version)` unique violation → `STALE_SPEC_VERSION`
  - a violation of the partial one-PENDING index → `CHANGE_REQUEST_PENDING`, whatever `target`
    Prisma reports for a raw-SQL index
  - a listener `fail({ code: "SPEC_CHANGE_VETOED" })` → a typed refusal, while a plain `throw` is
    re-thrown and both roll back
  - an in-transaction building block called via `.inTx`/`CommandCtx` rolls back the outer
    transaction
- [x] T018 [P] Implement `src/server/changes/events.ts`: `SPEC_CHANGED`, `SpecChangedEvent`,
  `SpecChangeListener`, `registerSpecChangeListener` (replace-by-name),
  `emitSpecChangedInTx` (sequential listeners with the caller's `tx`, then one `notify` outbox
  row), and the test-only `__resetSpecChangeListenersForTests`. Follow
  contracts/events-and-ports.md §1.
- [x] T019 [P] Implement `src/server/changes/ports.ts`: `LateCancellationCost`, `DirectCostPort`,
  `noopDirectCostPort`, `setDirectCostPort`, `getDirectCostPort`, and the test-only
  `__resetDirectCostPortForTests`. Follow contracts/events-and-ports.md §2.
- [x] T020 [P] Implement `src/server/changes/recipients.ts` `usersWithPermission(tx, permission)`.
  It is a single query covering role permissions and extra permissions, active users only
  (research §17).
- [x] T021 [P] Unit test `tests/unit/changes/edges.test.ts`: `ALLOWED_EDGES.APPROVED`,
  `.WAITING_PRICING`, and `.READY_FOR_PRODUCTION` include `"REWORK_REQUIRED"`, and
  `.DESIGN_COMPLETED` does not (T006). The existing `tests/unit/workflow-edges.test.ts` matrix
  must still pass unmodified.

**Checkpoint**: Foundation ready. User story phases may now start.

---

## Phase 3: User Story 1 - The original specification is never lost (Priority: P1) 🎯 MVP

**Goal**: Every Work Item has v1 from creation or backfill. Every write appends a version, and the
mirror columns always equal the current version (FR-001–005).

**Independent Test**: Create an order with quantity 500, edit it to 800 in `NEW`, and confirm v1
(500) and v2 (800) are both readable. Run the backfill on factory-made Work Items and confirm
exactly one v1 each, idempotently.

### Tests for User Story 1

- [x] T022 [P] [US1] Integration test `tests/integration/changes/versioning.test.ts`:
  - `quickCreateOrder`, `createOrder` (2 items), and `addWorkItem` each create v1 `INITIAL` with
    the entered values, `stateAtCreation`, `createdById`, and the pointer set, plus a
    `spec_version.created` audit (US1-1, FR-001).
  - `addWorkItem` on an order whose other item is `IN_PRODUCTION` succeeds with v1 and creates no
    change request (FR-030).
  - A factory-made Work Item (no version) passed to `applySpecChangeInTx` gets a `BACKFILL` v1
    followed by v2 in one transaction (FR-005 self-heal).
  - After v2, `getSpecHistory` returns v1 (500) and v2 (800) (US1-2).
  - For every command in this file, assert the invariant "WorkItem mirror columns ==
    `toSpecSnapshot(currentSpecVersion)`" (FR-003).
- [x] T023 [P] [US1] Contract test `tests/contract/changes/append-only.test.ts`, mirroring
  `tests/contract/audit-append-only.test.ts`: raw `UPDATE` and `DELETE` on `"SpecVersion"` and
  `"LateCancellation"` fail with a permission error once T004 is applied (US1-4, FR-004).
  - Also assert that `src/server/changes/**` contains no `specVersion.update`,
    `specVersion.delete`, or `lateCancellation.update`/`delete` calls (source grep in the test,
    same technique as 002's `externalGuard.test.ts`).
- [x] T024 [P] [US1] Integration test `tests/integration/changes/backfill.test.ts`:
  - Create 3 factory Work Items without versions (one with Decimal dimensions, one with nulls).
  - Execute `prisma/manual-sql/016-spec-version-backfill.sql` through `db.$executeRawUnsafe`,
    reading the file and splitting on the documented statement separator.
  - Assert exactly one `BACKFILL` v1 each, with values equal to the columns, the pointer set,
    `createdById` null, and `WorkItem.updatedAt` unchanged.
  - Assert the Step 4 verification queries return zero rows.
  - A second run inserts zero versions (idempotent, US1-3).
  - Pre-existing `workitem.edited` audit rows are untouched.
- [x] T025 [P] [US1] Integration test `tests/integration/changes/editWorkItemDelegation.test.ts`:
  - 011's `editWorkItem` in `NEW` now creates a `DIRECT_EDIT` version and still writes
    `workitem.edited`.
  - A dueDate-only patch creates **no** version and emits no `SPEC_CHANGED`, but is still
    audited (FR-031).
  - `PAST_EDIT_WINDOW` is still thrown outside `NEW`/`ASSIGNED`. This is 011's contract,
    unchanged. `tests/integration/orders/**` must still pass unmodified.

### Implementation for User Story 1

- [x] T026 [US1] Implement `createInitialSpecVersionInTx` and `ensureCurrentSpecVersionInTx` in
  `src/server/changes/versions.ts` per contracts/change-control.md.
- [x] T027 [US1] Implement `applySpecChangeInTx` in `src/server/changes/versions.ts`. The steps are
  a row lock via `tx.$queryRaw` `SELECT … FOR UPDATE`, then ensure, expected-version check,
  `productTypeId` existence, diff/`NO_CHANGES`, insert `n + 1`, update the mirror and pointer,
  audit `spec_version.created`, and `emitSpecChangedInTx`. This is the only writer of the spec
  columns (FR-010).
- [x] T028 [US1] In `src/server/orders/create.ts` (`quickCreateOrder`, `createOrder`) and
  `src/server/orders/workItems.ts` (`addWorkItem`), call `createInitialSpecVersionInTx(tx, {
  workItemId, actorId })` right after each `tx.workItem.create`, imported from the
  `~/server/changes` barrel.
- [x] T029 [US1] In `src/server/orders/workItems.ts` `editWorkItem`:
  - Split the patch into spec fields and `dueDate`.
  - Route the spec fields through `applySpecChangeInTx({ tx, afterCommit }, { origin:
    "DIRECT_EDIT", expected: { version: current }, ifUnchanged: "skip" })`, so an unchanged or
    due-date-only save stays a non-error (contracts/change-control.md).
  - Keep `dueDate` as a plain audited update.
  - Keep the `PAST_EDIT_WINDOW` refusal and the `workitem.edited` audit exactly as they are.
- [x] T030 [US1] Implement `getSpecHistory` in `src/server/changes/versions.ts` with `defineQuery`
  (any-of `PermissionSpec` plus a department-scope `authorize` hook, contracts/change-control.md): one query with
  `include: { createdBy }`, consecutive diffs computed in memory, the `noHistoryBeforeNow` flag,
  and the permission rule from data-model.md "Permission model". Export it from the barrel.
- [x] T031 [US1] Add `src/components/changes/spec-history.tsx`, a Server Component listing the
  versions (number, origin label, author or "—", time, reason). Render it per Work Item on
  `src/app/(shell)/orders/[orderId]/page.tsx`. Add `changes.history.*` and
  `changes.origin.*` keys to `src/messages/ar.json`.

**Checkpoint**: Versioning works end to end. Nothing can be silently overwritten via 011.

---

## Phase 4: User Story 2 - Edits allowed or refused by state (Priority: P1)

**Goal**: `editSpec` enforces the state policy server-side, with a redesign/keep choice where an
approved design exists (FR-006–010).

**Independent Test**: For each of the 15 states, call `editSpec`. It succeeds exactly for the 9
DIRECT states and refuses with the distinct code otherwise.

### Tests for User Story 2

- [ ] T032 [P] [US2] Integration test `tests/integration/changes/editSpec.test.ts`, "policy by
  state": table-driven over all 15 states using factory Work Items, as RECEPTION.
  - The 9 DIRECT states create a version plus a `spec.edited` audit with before and after
    (US2-1). The before/after contains only the changed fields.
  - `PRODUCTION_COMPLETED`, `READY_FOR_COLLECTION`, `DELIVERED`, and `COMPLETED` →
    `ADMIN_OVERRIDE_REQUIRED` (US2-4).
  - `CANCELLED` → `WORK_ITEM_LOCKED`.
- [ ] T033 [P] [US2] Integration test `tests/integration/changes/editSpec.test.ts`, "permission and
  concurrency":
  - `HEAD_DESIGNER`, `DESIGNER`, `PRODUCTION_OPERATOR`, and `ACCOUNTING` actors are refused as
    forbidden in a DIRECT state and in `IN_PRODUCTION` (US2-5).
  - A stale `expectedVersion` → `STALE_SPEC_VERSION`.
  - A no-op patch → `NO_CHANGES`.
  - Two `editSpec` calls from the same version run with `Promise.all` → exactly one succeeds and
    the other gets `STALE_SPEC_VERSION`, with no lost update (US2-6).
- [ ] T034 [P] [US2] **Acceptance criterion 1.** Integration test
  `tests/integration/changes/editSpec.test.ts`, "IN_PRODUCTION refused server-side". Call
  `editSpec` directly, not via UI, on an `IN_PRODUCTION` item. It returns `CHANGE_REQUEST_REQUIRED`,
  and the following are all unchanged by count/value: `SpecVersion` count, `AuditEvent` count for
  the entity, the WorkItem spec columns, `NotificationEvent` count, and the `SPEC_CHANGED` listener
  call count. Assert the public call returns `{ ok: false, error: { code:
  "CHANGE_REQUEST_REQUIRED" } }` (the `AspectResult` the Server Action receives) and never throws (US2-3, FR-010, SC-003). Also assert 011's `editWorkItem` refuses the same item
  (`PAST_EDIT_WINDOW`).
- [ ] T035 [P] [US2] Integration test `tests/integration/changes/editSpec.test.ts`, "redesign":
  - `APPROVED`/`WAITING_PRICING`/`READY_FOR_PRODUCTION` with `requiresDesign` and no
    `designChoice` → `REDESIGN_CHOICE_REQUIRED`.
  - `REDESIGN` → the state is `REWORK_REQUIRED`, the `WorkItemTransition` has `rejectionCategory:
    CUSTOMER_CHANGE`, a `Return` with category `CUSTOMER_CHANGE` has the effective department as
    origin, and the designer is notified (US2-2, FR-009).
  - `KEEP_DESIGN` → a version with no state change.
  - `requiresDesign = false` plus `REDESIGN` → `REDESIGN_NOT_ALLOWED`.
  - Null effective department without `originDepartmentId` → `ORIGIN_DEPARTMENT_REQUIRED`.
  - `WAITING_REVIEW` edit → notifications to the assignee **and** every `design.review` holder
    (FR-008).

### Implementation for User Story 2

- [ ] T036 [US2] Implement `sendBackForCustomerChangeInTx` in `src/server/changes/effects.ts`,
  including the local effective-department helper, per research §8:
  1. `ctx.transition` to `REWORK_REQUIRED` with `CUSTOMER_CHANGE`
  2. `createReturnInTx` from `~/server/review`
  3. `notify` with `work_item.customer_change_returned`
  4. return `{ returnId }`
- [ ] T037 [US2] Implement `editSpec` in `src/server/changes/editSpec.ts` with `defineCommand` (from
  `./aspect`; the queries in this module use `defineQuery`),
  per contracts/change-control.md. The policy check comes before any write. Then the redesign
  choice, `applySpecChangeInTx`, the redesign effect or `customer_modification` notify, and the
  WAITING_REVIEW reviewer notify. Export it from the barrel.
- [ ] T038 [US2] Add a Server Action and an edit-spec form on
  `src/app/(shell)/orders/[orderId]/page.tsx`:
  - The form is driven by `specEditPolicy`: an edit form for DIRECT (with the redesign/keep radio
    when `REQUIRED`), a "request change" button for CHANGE_REQUEST, and read-only otherwise.
  - It submits `expectedVersion`.
  - It maps `ChangeResult` error codes (016's own plus the engine base codes) to Arabic messages.
  - Add `changes.edit.*` and `changes.errors.*` keys to `src/messages/ar.json`.

**Checkpoint**: The edit policy gate is live. Direct edits in production are impossible.

---

## Phase 5: User Story 3 - Customer changes their mind during production (Priority: P1)

**Goal**: Change request → freeze → approve (continue/redesign), reject, or withdraw →
acknowledge (FR-011–018).

**Independent Test**: quickstart.md Scenario 3 and Scenario 4, run through the service functions.

### Tests for User Story 3

- [ ] T039 [P] [US3] Integration test `tests/integration/changes/changeRequest.test.ts`, "record":
  - As RECEPTION on an `IN_PRODUCTION` item with an open `ACTIVE` segment, the request is stored
    `PENDING` with `baseSpecVersionId = current`, the `ACTIVE` segment is closed, and
    `pausedRunningTimerAt` is set.
  - `work_item.change_requested` goes to the department and all `change.approve` holders, and
    `change_request.created` is audited (US3-1, FR-011/012).
  - A second request → `CHANGE_REQUEST_PENDING` (US3-3).
  - Two concurrent creates via `Promise.all` → exactly one row, confirming the row lock plus the
    partial index.
  - A no-op → `NO_CHANGES`.
  - Every non-`IN_PRODUCTION` state (table-driven) → `NOT_IN_PRODUCTION`.
- [ ] T040 [P] [US3] Integration test `tests/integration/changes/productionHold.test.ts`:
  - While `PENDING`, all three are refused (US3-2, FR-012, SC-004):
    - 014's `resumeProduction` → `DomainProductionError("CHANGE_HOLD")`
    - `completeProduction` → `WorkItemTransitionError` with `guardCode: "CHANGE_HOLD"`
    - `sendBackToDesign` → `guardCode: "CHANGE_HOLD"`
  - After a `CONTINUE_PRODUCTION` approval, all three are still refused until
    `acknowledgeSpecRevision` (US3-4, FR-014).
  - Acknowledging as an operator of **another** department → forbidden.
  - Acknowledging with no revision → `NOTHING_TO_ACKNOWLEDGE`. Acknowledging while
    `CHANGE_PENDING` → `NOTHING_TO_ACKNOWLEDGE`, and the hold stays.
  - Two `CONTINUE_PRODUCTION` approvals in a row without an acknowledgment → one
    `acknowledgeSpecRevision` clears the hold (both rows acknowledged, two audits).
  - After acknowledging, resume and complete succeed.
  - After reject or withdraw, resume succeeds with no acknowledgment (US3-6).
  - A direct `transitionWorkItem(IN_PRODUCTION → REWORK_REQUIRED)` with
    `meta.changeRequestId` set to a *different* id → `GUARD_FAILED`.
- [ ] T041 [P] [US3] Integration test `tests/integration/changes/changeRequest.test.ts`,
  "approve":
  - **Acceptance criterion 2.** `CONTINUE_PRODUCTION` makes v2 (800) current, sets
    `resultingSpecVersionId`, and leaves v1 (500) readable. `getSpecVersionDiff(1, 2)` equals
    `[{ field: "quantity", before: 500, after: 800 }]`. The state stays `IN_PRODUCTION`,
    `work_item.revised_instruction` is notified, and `change_request.approved` plus
    `spec_version.created` are audited (US3-4).
  - `REDESIGN` makes the state `REWORK_REQUIRED` with `CUSTOMER_CHANGE`, sets `returnId`, gives the
    Return the production department as origin, closes the `ACTIVE` segment, and notifies the
    designer (US3-5, FR-015).
  - `REDESIGN` on `requiresDesign = false` or with no assignee → `REDESIGN_NOT_ALLOWED`.
- [ ] T042 [P] [US3] Integration test `tests/integration/changes/changeRequest.test.ts`,
  "permissions, decisions, races":
  - RECEPTION approve/reject → forbidden (US3-7).
  - `PRODUCTION_OPERATOR` create/approve/reject/withdraw → forbidden (FR-018).
  - `HEAD_DESIGNER` create → forbidden (no `order.edit`).
  - Reject or withdraw without a reason → invalid.
  - Reject or withdraw with a reason → no version, and the requester and department are notified
    (US3-6, FR-016).
  - Concurrent double approve → one succeeds and the other gets `CHANGE_REQUEST_ALREADY_DECIDED`.
  - Approving a decided request → `CHANGE_REQUEST_ALREADY_DECIDED`.
  - Approving after the Work Item left `IN_PRODUCTION` (moved by the factory) →
    `WORK_ITEM_LEFT_PRODUCTION`.
  - Approving when the base is no longer current (seed v3 via `applySpecChangeInTx` in the test)
    → `STALE_SPEC_VERSION`, and nothing is written (US3-8).
- [ ] T043 [P] [US3] Contract test `tests/contract/changes/guards.test.ts`:
  - Importing only `~/server/production` registers the two hold guards.
  - Importing only `~/server/orders` registers the three late-cancel guards. Check with
    `runGuards` on a constructed `WorkItemSnapshot` plus a seeded pending CR.
  - Malformed or unknown `meta` is ignored, which means refusal.
- [ ] T044 [P] [US3] Integration test `tests/integration/changes/approverQueue.test.ts`:
  - `listPendingChangeRequests` requires `change.approve`.
  - It orders `URGENT` before `NORMAL`, then oldest first.
  - The cursor paginates 5 rows with `limit: 2` into 2 + 2 + 1, with `nextCursor` null at the end.
  - Decided requests are excluded.
  - **No N+1**: count queries via a Prisma `$on("query")` listener, or `$extends` query counting,
    for 3 versus 30 pending rows, and assert an equal query count (FR-017, research §17).
  - Assert the `@@index([status, createdAt])` exists via `pg_indexes`.

### Implementation for User Story 3

- [ ] T045 [US3] Implement `getProductionHold` and `acknowledgeSpecRevision` (`defineCommand` from
  `./aspect`, with `permission: "production.operate"` and an `authorize` hook calling
  `ctx.check("production.operate", { departmentId })` for the effective department, and an `updateMany` over every
  unacknowledged `CONTINUE_PRODUCTION` approval of the Work Item) in
  `src/server/changes/productionHold.ts`.
- [ ] T046 [US3] Implement `src/server/changes/guards.ts` per contracts/events-and-ports.md §3. Use
  a Zod `metaSchema` discriminated union, and read via `db`. Export an **idempotent** `registerChangeGuards()`
  (module-level `registered` flag, because 002's `registerGuard` appends on every call). The barrel
  `src/server/changes/index.ts` exports it **and** calls it on import, which covers vitest, the
  seed, and scripts. **Shared `src/instrumentation.ts` (with 015): if absent, create it per
  contracts/aspects.md and 015's plan; otherwise reuse it unchanged.** Then add only the `changes`
  block inside `register()` (`NEXT_RUNTIME === "nodejs"`): `const { registerChangeGuards } = await
  import("~/server/changes"); registerChangeGuards();` (research §18). Extend T043 so that calling
  `registerChangeGuards()` twice registers each guard only once.
- [ ] T047 [US3] Implement `createChangeRequest` in `src/server/changes/changeRequests.ts`: row
  lock, state and pending checks, dry-run diff, insert, pause (existence check then
  `closeOpenSegment`), notify, audit.
- [ ] T048 [US3] Implement `approveChangeRequest`, `rejectChangeRequest`, and
  `withdrawChangeRequest` in `src/server/changes/changeRequests.ts` per contracts. Use the guarded
  `updateMany` for every decision. The redesign outcome goes through
  `sendBackForCustomerChangeInTx` with `meta: { changeControl: "CHANGE_REQUEST_APPROVAL",
  changeRequestId }`.
- [ ] T049 [US3] Implement `listPendingChangeRequests` (cursor, `include`, in-memory
  `changedFields`) and `getChangeRequestDetail`, both with `defineQuery` and `permission:
  "change.approve"`, in `src/server/changes/changeRequests.ts`. Export
  all US3 functions from the barrel.
- [ ] T050 [US3] 014 touch points:
  - add `"CHANGE_HOLD"` to `DomainProductionErrorCode` in `src/server/production/errors.ts`
  - in `src/server/production/timer.ts` `resumeProduction`, refuse while `getProductionHold(tx,
    id)` is non-null, next to the existing `pendingFileRevisionAt` check
  - in `src/server/production/jobCard.ts`, add `changeHold` and `specVersion` to `JobCard`

  The `~/server/changes` import also guarantees guard registration (research §18). Existing
  `tests/integration/production/**` must pass unmodified.
- [ ] T051 [US3] UI:
  - `src/app/(shell)/changes/page.tsx` (approver queue, paginated) and
    `src/app/(shell)/changes/[changeRequestId]/page.tsx` (detail with approve-continue,
    approve-redesign shown only when allowed, and reject with reason), both with Server Actions
  - a "request change" form (proposed fields plus reason) and a "withdraw" action on
    `src/app/(shell)/orders/[orderId]/page.tsx`
  - a hold banner plus an "acknowledge revised instruction" button on
    `src/app/(shell)/production/[workItemId]/page.tsx`, with resume/complete/send-back disabled
    while held (the server refuses anyway)
  - `changes.request.*`, `changes.queue.*`, and `changes.hold.*` keys in `src/messages/ar.json`
- [ ] T052 [US3] Add a `changes` nav entry in `src/app/(shell)/nav.ts`, gated to `HEAD_DESIGNER`
  and `ADMIN_OWNER`, which mirrors the existing role-list gating. The page itself authorizes by the
  `change.approve` permission, so the nav gating is cosmetic only. Update
  `tests/unit/shell-nav.test.ts`.

**Checkpoint**: PRD §47's flow works end to end. The job freezes and nothing is silently rewritten.

---

## Phase 6: User Story 4 - See exactly what changed (Priority: P1)

**Goal**: The pure diff is surfaced by `<SpecDiff>` in history, on the change request detail, and
on the job card (FR-019–020).

**Independent Test**: v1 (500, Vinyl) and v2 (800, Vinyl) show exactly one row, "Quantity
500 → 800".

### Tests for User Story 4

- [ ] T053 [P] [US4] Unit test `tests/unit/changes/spec-diff-render.test.ts` (a `.ts` file):
  `renderToStaticMarkup(SpecDiff({ changes }))` renders one `data-field` row per change, "—" for
  null, the empty label for `[]`, and product type names from `productTypeNames`.
- [ ] T054 [P] [US4] Integration test `tests/integration/changes/diff.test.ts`:
  - `getSpecVersionDiff` gives v1 vs v2 exactly as in US4-1, and v2 vs v2 → `[]`.
  - Versions of another Work Item → `VERSION_MISMATCH` (US4-5).
  - `getChangeRequestDetail` returns the base-vs-proposed diff (US4-4).
  - `getProductionStartSpecDiff` after a mid-production approval → start v1, current v2, quantity
    changed.
  - An actor with no qualifying permission (a user with no roles) calling `getSpecHistory` or
    `getSpecVersionDiff` → forbidden. A `PRODUCTION_OPERATOR` of another department → forbidden.
    `RECEPTION` and `ACCOUNTING` → allowed.
- [ ] T055 [P] [US4] **Acceptance criterion 2 (UI path).** Integration test
  `tests/integration/changes/diff.test.ts`: after `editSpec` in `NEW` from 500 to 800,
  `getSpecHistory` returns both versions and `diffs[0].changes` equals the quantity change, which
  is the data `<SpecDiff>` renders.

### Implementation for User Story 4

- [ ] T056 [US4] Implement `src/components/changes/spec-diff.tsx` per contracts/spec-diff.md
  (Server Component, logical CSS, `data-field`/`data-kind`, `ar-EG` number formatting). Export it
  from `src/components/changes/index.ts`. Add `changes.fields.*`, `changes.dimensionUnit.*`, and
  `changes.diff.*` keys to `src/messages/ar.json`.
- [ ] T057 [US4] Implement `getSpecVersionDiff` (`defineQuery`, same permission as T030) and the
  plain in-transaction helper `getProductionStartSpecDiff` in
  `src/server/changes/versions.ts` (two queries, research §17). Export them from the barrel.
- [ ] T058 [US4] Wire `<SpecDiff>` into `spec-history.tsx` (consecutive pairs plus a two-version
  picker), the change request detail page, and the job card. On the job card, add
  `productionStartDiff` to `JobCard` in `src/server/production/jobCard.ts`.

**Checkpoint**: The question "what did the customer change?" is answered on every relevant screen.

---

## Phase 7: User Story 5 - Approved change resets pricing (Priority: P2)

**Goal**: `SPEC_CHANGED` fires exactly once per new version, atomically, to listeners (051) and
the outbox (FR-021–023).

**Independent Test**: A stand-in listener marks "pricing pending" in the same transaction. A
throwing listener rolls everything back.

### Tests for User Story 5

- [ ] T059 [P] [US5] Contract test `tests/contract/changes/events.test.ts`:
  - Exactly one event (listener spy plus one `NotificationEvent` of type
    `work_item.spec_changed`) per `editSpec`, approval, and override.
  - **Zero** events for v1 `INITIAL`, runtime `BACKFILL`, any refused command, reject/withdraw,
    and a dueDate-only `editWorkItem`.
  - The payload matches `SpecChangedEvent` exactly (`fromVersion`, `toVersion`, `specVersionId`,
    `origin`, `changeRequestId`, `changedFields` in `SPEC_FIELDS` order, `workItemState`,
    `actorId`) (US5-2).
  - Registering the same name twice replaces the first listener.
- [ ] T060 [P] [US5] **Acceptance criterion 3.** Integration test
  `tests/integration/changes/pricingReset.test.ts`. Register a stand-in 051 listener,
  `"pricing.reset"`, that writes a marker through the **provided `tx`**: an `audit_event` with
  `action: "test.pricing_pending"` for the Work Item, only when a test-controlled "priced" set
  contains it. This stands in for "pricing status → PENDING", because 051's model doesn't exist
  yet (see checklists/requirements.md).
  - Approving a CR on a "priced" item leaves the marker and v2 committed together, with the same
    `tx` identity asserted (US5-1).
  - A throwing listener, both a typed `fail({ code: "SPEC_CHANGE_VETOED" })` (the caller gets that
    refusal) and a plain `throw` (re-thrown), leaves v2 absent, the CR still `PENDING`, the state unchanged, and no new
    audit rows or `NotificationEvent`. The caller receives the error (US5-3, FR-022).
  - With the registry reset (no listener), approval succeeds (US5-4, FR-023).

### Implementation for User Story 5

- [ ] T061 [US5] Finalize the `emitSpecChangedInTx` wiring in
  `src/server/changes/versions.ts`/`events.ts`: outbox recipients are the assignee plus the
  effective department, and `workItemState` is captured before any redesign transition. Export
  `SPEC_CHANGED`, `SpecChangedEvent`, `SpecChangeListener`, and `registerSpecChangeListener` from
  the barrel, with a doc comment linking contracts/events-and-ports.md §1 (the 051 obligations).

**Checkpoint**: The pricing gate is protected as soon as 051 registers its listener.

---

## Phase 8: User Story 6 - Late cancellation records why and what it cost (Priority: P2)

**Goal**: Cancelling after production started goes only through `cancelAfterProductionStarted`,
which requires a reason and a cost and hands off to 052 (FR-024–026).

**Independent Test**: quickstart.md Scenario 6.

### Tests for User Story 6

- [ ] T062 [P] [US6] Integration test `tests/integration/changes/lateCancellation.test.ts`:
  - For each of `IN_PRODUCTION`, `PRODUCTION_COMPLETED`, and `READY_FOR_COLLECTION` (with a spy
    port via `setDirectCostPort`): the state becomes `CANCELLED` and a `LateCancellation` row
    holds `350.00`/`EGP`/the reason/`stateAtCancellation`. The port is called once with a payload
    matching `LateCancellationCost`, including the `lateCancellationId`. The open `ACTIVE` segment
    is closed, and `workitem.late_cancelled` is audited (US6-1).
  - A missing reason, missing cost, `-5`, or `1.234` → invalid, with the Work Item unchanged
    (US6-2).
  - `NEW`, `READY_FOR_PRODUCTION`, `DELIVERED`, and `CANCELLED` → `LATE_CANCEL_NOT_APPLICABLE`
    (US6-5).
  - A pending CR → `CLOSED_BY_CANCELLATION` plus `change_request.closed_by_cancellation` audit
    (US6-4).
  - A throwing port → full rollback.
  - `PRODUCTION_OPERATOR` and `HEAD_DESIGNER` (no `order.cancel`) → forbidden.
- [ ] T063 [P] [US6] Integration test `tests/integration/changes/cancelPaths.test.ts`:
  - 011's `cancelWorkItem` on each of the three production states →
    `WorkItemTransitionError` with `guardCode: "LATE_CANCELLATION_REQUIRED"`, and the state is
    unchanged (US6-3, FR-026).
  - `cancelOrder` on a mixed order (`NEW` + `IN_PRODUCTION`) → `cancelledWorkItemIds` holds the
    `NEW` item and `requiresLateCancellation` holds the in-production item.
  - A raw `transitionWorkItem(→ CANCELLED)` from `IN_PRODUCTION` without the marker →
    `GUARD_FAILED`.
  - Regression: `cancelWorkItem` on `NEW`/`IN_DESIGN`/`READY_FOR_PRODUCTION` still succeeds.
- [ ] T064 [P] [US6] Contract test `tests/contract/changes/directCostPort.test.ts`: the default is
  the no-op, `setDirectCostPort` replaces it, and the port receives the provided `tx` (it can write
  in it and the write commits with the cancellation).

### Implementation for User Story 6

- [ ] T065 [US6] Implement `cancelAfterProductionStarted` in
  `src/server/changes/lateCancellation.ts` (`defineCommand`, `order.cancel`) per contracts: state
  check, close pending CRs, insert `LateCancellation`, `ctx.transition` with the
  `LATE_CANCELLATION` marker, port call, notify. Export it from the barrel.
- [ ] T066 [US6] In `src/server/orders/cancelOrder.ts`, extend `cancelOrder`'s return with
  `requiresLateCancellation: string[]`, populated from failures whose `guardCode` is
  `LATE_CANCELLATION_REQUIRED`. This is additive, and existing callers and tests keep working.
  Import `~/server/changes` in `src/server/orders/index.ts` (or `cancelOrder.ts`) so the guards are
  registered. Existing `tests/integration/orders/**` must still pass, except any test that asserts
  cancelling an `IN_PRODUCTION` item succeeds. If one exists, update it to the new rule and note it
  in the PR.
- [ ] T067 [US6] UI on `src/app/(shell)/orders/[orderId]/page.tsx`:
  - a late-cancellation form (reason, cost with a required, explicit decimal field, produced so
    far, note), shown for the three states
  - an ordinary cancel that shows "late cancellation required"
  - the order-cancel result listing items that need late cancellation
  - `changes.lateCancel.*` keys in `src/messages/ar.json`

**Checkpoint**: Late-cancellation losses are always recorded and traceable.

---

## Phase 9: User Story 7 - Admin override with a reason (Priority: P3)

**Goal**: Admin can change the spec in any non-cancelled state, with a reason. In production this
has the same effects as an approved CR (FR-027–028).

**Independent Test**: quickstart.md Scenario 7.

### Tests for User Story 7

- [ ] T068 [P] [US7] Integration test `tests/integration/changes/adminOverride.test.ts`:
  - `PRODUCTION_COMPLETED`, `DELIVERED`, and `COMPLETED` → an `ADMIN_OVERRIDE` version, the prior
    version byte-identical, a `spec.admin_override` audit with the reason, and no state change
    (US7-1).
  - No reason → invalid (US7-2).
  - RECEPTION and HEAD_DESIGNER → forbidden (US7-3).
  - `IN_PRODUCTION` plus `CONTINUE_PRODUCTION` → a CR `APPROVED` with `isAdminOverride`, and the
    hold becomes `REVISION_UNACKNOWLEDGED` (resume refused until acknowledged) (US7-4).
  - `IN_PRODUCTION` plus `REDESIGN` → `REWORK_REQUIRED`/`CUSTOMER_CHANGE`/Return.
  - `IN_PRODUCTION` without an `outcome` → invalid.
  - A pending CR → `CHANGE_REQUEST_PENDING` (US7-5).
  - An unacknowledged `CONTINUE_PRODUCTION` approval → `REVISION_UNACKNOWLEDGED`.
  - `CANCELLED` → `WORK_ITEM_LOCKED` (US7-6).
  - A stale `expectedVersion` → `STALE_SPEC_VERSION`.
  - An `APPROVED` state follows the same `designChoice` rule as `editSpec`.

### Implementation for User Story 7

- [ ] T069 [US7] Implement `adminOverrideSpec` in `src/server/changes/adminOverride.ts`
  (`defineCommand`, `admin.override`) per contracts, reusing the approval effects from T048 via a
  shared internal helper rather than duplicating them. Export it from the barrel.
- [ ] T070 [US7] Add an override form (fields plus a mandatory reason, and an outcome selector when
  `IN_PRODUCTION`) on `src/app/(shell)/orders/[orderId]/page.tsx`, rendered only when the actor
  holds `admin.override`. Add `changes.override.*` keys to `src/messages/ar.json`.

**Checkpoint**: Every state has exactly one legitimate change path.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T071 **Acceptance criterion 4.** Integration test `tests/integration/changes/audit.test.ts`:
  table-driven over every FR-029 step. Run each through its server entry point and assert exactly
  the expected `AuditEvent`(s): `action`, `entityType`, `entityId`, `actorId`, before/after where
  applicable, and `reason` where applicable. The steps are:
  - version created
  - direct edit
  - change request recorded
  - approved (continue and redesign)
  - rejected
  - withdrawn
  - closed by cancellation
  - acknowledged
  - late cancellation
  - Admin override

  Also assert that a refused or rolled-back command leaves **no** audit event (SC-007).
- [ ] T072 Add a source-grep test in `tests/contract/changes/guards.test.ts`: the literal
  `changeControl` appears in no `src/**` file outside `src/server/changes/**` (research §18
  residual risk).
- [ ] T073 Run `pnpm check` (lint + typecheck) across `src/server/changes/**`,
  `src/components/changes/**`, and every edited 001/002/011/014 file. Fix any violation, including
  no `any` and exhaustive switches.
- [ ] T074 Run the full `pnpm test` suite. Every pre-existing 001/002/010–014 test must still pass,
  and any test changed under T066 must be listed in the PR. All new `tests/**/changes/**` tests
  must pass once T002, T004, and T005 unblock the DB-dependent ones. The unit tests (T011, T013,
  T015, T021, T053) pass regardless.
- [ ] T075 **Cross-team sign-off (Fady, Track B)** before merge. Record the agreement in Linear:
  - contracts/events-and-ports.md §1 (the 051 listener obligations)
  - §2 (the 052 port obligations)
  - §5 (054)
  - the `change.approve` key (T003)
  - the new schema file (T001/T002)
- [ ] T076 Manual quickstart QA, blocked on T002 like every prior feature's final task. Walk through
  quickstart.md Scenarios 0–7 against a running dev server with the six seeded roles.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first. T002 is blocked on Fady (DB-dependent tests wait for it). T003–T008
  run in parallel after T001. T004 and T005 are applied after T002.
- **Foundational (Phase 2)**: depends on T001 (Prisma types). It BLOCKS all user stories. T016
  depends on T009. T016/T017 are **shared with 015**: check whether 015 has already landed the
  shared layer before starting. If it has, only the `changes` binding and its test remain.
- **User Stories**:
  - **US1** depends on Foundational. T027 depends on T014/T018. T028/T029 depend on T026/T027.
  - **US2** depends on US1's `applySpecChangeInTx` (T027) and T036.
  - **US3** depends on US1 (T027) and US2's T036, since the redesign outcome reuses it.
  - **US4** depends on US1 (versions exist). Its UI parts (T058) depend on US3's pages (T051).
  - **US5** depends on T027 (the emission point). The test also exercises US3's approval (T048).
  - **US6** depends on Foundational plus T046 (guards). It is otherwise independent of US2–US5.
  - **US7** depends on US3 (T048 effects) and US2 (T037's designChoice rule).
- **Polish (Phase 10)**: depends on all desired stories.

### Within Each User Story

- Tests are written before implementation and are expected to fail first.
- Errors and schemas come before services, and services before UI.
- Finish a story before moving to the next priority.

### Parallel Opportunities

- Setup: T003–T008 run in parallel once T001 lands.
- Foundational: T009–T015 and T018–T021 run in parallel. T016/T017 come after T009.
- After US1: US2 and US6 can proceed in parallel, since they touch different files and US6 needs
  only the guards. US4's pure and component parts (T053, T056) can start any time after T014.
- All [P] test tasks within a story run in parallel. Several tests share
  `tests/integration/changes/editSpec.test.ts` and `changeRequest.test.ts` as separate
  `describe` blocks, so write them together or coordinate edits.

---

## Parallel Example: User Story 3

```bash
Task: "Integration test record/freeze in tests/integration/changes/changeRequest.test.ts"
Task: "Integration test hold enforcement in tests/integration/changes/productionHold.test.ts"
Task: "Contract test guard registration in tests/contract/changes/guards.test.ts"
Task: "Integration test approver queue in tests/integration/changes/approverQueue.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 and Phase 2.
2. US1: versioning, backfill, and 011 delegation.
3. **STOP and VALIDATE**: every Work Item has v1, every edit appends a version, and history is
   readable.

### Incremental Delivery

1. US1 → US2 (the gate, which closes the silent-rewrite hole) → US3 (the PRD §47 flow) → US4 (the
   diff everywhere). Together these are the four P1 stories.
2. US5 (event, ready for 051) and US6 (late cancel, ready for 052).
3. US7 (Admin override).

---

## Notes

- T002 (db push) is the standing blocker for DB-dependent tests, as in every prior feature. Do not
  run it unattended. Confirm with Fady first.
- Shared with 015 (create if absent, otherwise reuse unchanged, and never fork): `src/server/core/aspects/**`,
  the core barrel additions, `src/server/aspects.ts`, the ESLint rule (c) exemption,
  `tests/unit/core/aspects.test.ts` (T016/T017), and `src/instrumentation.ts` (T046, where 016 adds
  only its block). Canonical contract: contracts/aspects.md, kept in sync with 015's copy.
- Cross-feature implementation touch points, to coordinate with each owner before landing:
  - T003 (001 permissions/seed, Fady)
  - T006 (002 edges)
  - T028/T029/T066 (011 orders)
  - T050/T058 (014 production)
- **Latent 014 issue found while planning (not fixed here)**: `src/server/production/sendBack.ts`
  never clears `WorkItem.pendingFileRevisionAt`. A Work Item sent back to design while a file
  revision is unacknowledged would carry the stale flag into its next production run, and
  `resumeProduction` would refuse until acknowledged. Report it to 014's owner. 016's hold is
  derived from `ChangeRequest` rows, so it does not have this problem (research §5).
