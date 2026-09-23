---

description: "Task list template for feature implementation"
---

# Tasks: Production Workflow

**Input**: Design documents from `/specs/014-production/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/production.md](./contracts/production.md), [quickstart.md](./quickstart.md)

**Tests**: Included — plan.md's Project Structure enumerates specific test files under
`tests/unit`, `tests/contract`, `tests/integration`, so this list generates the matching test
tasks alongside each story's implementation.

**Organization**: Tasks are grouped by user story (spec.md's 7 stories, priorities
P1/P1/P1/P1/P2/P3/P2) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to spec.md's US1–US7
- Every task names its exact file path

## Path Conventions

Single Next.js project (plan.md Project Structure): `src/server/production/**`,
`src/app/(shell)/**`, `prisma/schema/core.prisma`, `src/server/core/workflow/edges.ts`,
`tests/{unit,contract,integration}/production/**`.

**Hard prerequisite**: this feature reads 012's `DesignVersion` and 013's
`approvedAt`/`approvedById`/`createReturn`. Setup Phase 1's T001 assumes 012 and 013 are merged to
`main`; if either is not yet merged when this phase starts, base this branch on
`013-review-rework-impl` instead (which is itself already based on
`012-designer-assignment-timers-impl`) and rebase onto `main` once both land (do not reimplement
`DesignVersion`/`createReturn` here).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the schema diff, the one new workflow edge, and module scaffolding every story
builds on.

- [x] T001 Apply the schema diff in `prisma/schema/core.prisma` per data-model.md: add
  `WorkItem.producedQuantity Int?`, `WorkItem.productionNotes String?`,
  `WorkItem.pendingFileRevisionAt DateTime?`; add `Department.isExternalProduction Boolean
  @default(false)`; add `model VendorProductionRecord` (id, `workItemId` + relation, `vendorName
  String`, `sentAt DateTime @default(now())`, `receivedAt DateTime?`, `createdById` + relation
  `User "VendorProductionRecordCreatedBy"`, `@@index([workItemId])`); add
  `WorkItem.vendorProductionRecords VendorProductionRecord[]` back-relation; add
  `User.vendorProductionRecordsCreated VendorProductionRecord[]` back-relation (identity.prisma)
- [ ] T002 **ACTION REQUIRED — blocked, do not run unattended.** Run `pnpm exec prisma db push`
  then `pnpm exec prisma db seed` to apply T001's schema. **Blocker**: same shared-dev-DB drift
  noted in `specs/011-orders-reception/tasks.md`'s T002 and every subsequent feature's own T002 —
  confirm with Fady before pushing. Whoever picks this up: (1) confirm with Fady, (2) run the two
  commands, (3) re-run the integration suite below to confirm it passes against a live schema, (4)
  check off the manual quickstart QA task once seeded data is available
- [x] T003 [P] Add the new allowed edge to `src/server/core/workflow/edges.ts` per
  data-model.md/research.md §2: `IN_PRODUCTION: ["PRODUCTION_COMPLETED", "REWORK_REQUIRED",
  "CANCELLED"]` (replacing the current `["PRODUCTION_COMPLETED", "CANCELLED"]` entry)
- [x] T004 [P] Add a `no-restricted-imports` rule for `src/server/production/**` to
  `eslint.config.js`, identical in shape to the existing `src/server/orders/**`/
  `src/server/designers/**`/`src/server/review/**` rules: only `~/server/production` (the barrel)
  is importable from outside; `tests/**` exempted
- [x] T005 [P] Create the barrel `src/server/production/index.ts` with no exports yet
  (placeholder `export {}` — populated incrementally as each story's functions land)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reused primitives every user story's implementation calls into.

**⚠️ CRITICAL**: No user story implementation task may start until this phase is complete.

- [x] T006 [P] Implement `DomainProductionError` in `src/server/production/errors.ts` — a local
  error class carrying `code: "WORK_ITEM_NOT_FOUND" | "NOT_READY_FOR_PRODUCTION" |
  "PENDING_FILE_REVISION" | "MISSING_PRODUCED_QUANTITY" | "VENDOR_RECEIPT_REQUIRED" |
  "NOT_EXTERNAL_DEPARTMENT" | "ALREADY_RECEIVED" | "PRODUCTION_ALREADY_STARTED"` and a
  human-readable message (contracts/production.md's Errors section)
- [x] T007 [P] Unit test in `tests/unit/production.test.ts` for the edges.ts change: assert
  `ALLOWED_EDGES.IN_PRODUCTION` includes `"REWORK_REQUIRED"` alongside the pre-existing
  `"PRODUCTION_COMPLETED"`/`"CANCELLED"` targets (T003)

**Checkpoint**: Foundation ready — every user story phase below may now start.

---

## Phase 3: User Story 1 - Operator sees only their department's queue (Priority: P1) 🎯 MVP

**Goal**: An operator opens `/production` and sees every `READY_FOR_PRODUCTION` Work Item routed
to a department they belong to, urgent-first then oldest-first, with a revised-file badge where
applicable (FR-001, FR-003).

**Independent Test**: Seed Work Items routed to two different departments (one urgent, two normal
at different ages) plus one Work Item still in review; open the queue as an operator belonging to
only one department and confirm only that department's ready items appear, correctly ordered.

**Note**: FR-001's department routing (`routeToDepartment`, research.md §8) is included in this
phase — the queue has nothing to show until Work Items have an effective department, so T010
directly depends on T013's effective-department helper.

### Tests for User Story 1

- [x] T008 [P] [US1] Contract test in `tests/contract/production/production.test.ts`:
  `getOperatorQueue` requires `production.operate` (FORBIDDEN without it), returns only
  `READY_FOR_PRODUCTION` rows scoped to the actor's effective departments, matches the frozen
  `ProductionQueueRow` shape; `routeToDepartment` requires the Head-Designer/Reception routing
  permission, refuses once the Work Item is `IN_PRODUCTION` or later
  (`DomainProductionError("PRODUCTION_ALREADY_STARTED")`)
- [x] T009 [P] [US1] Integration test in `tests/integration/production/queue.test.ts`: seed 3
  ready items across 2 departments (1 urgent, 2 normal at different `enteredQueueAt`) + 1
  non-ready item; assert an operator scoped to only one department sees just that department's
  items, urgent-first then oldest-first, and a direct job-card request for the other
  department's item is refused
- [x] T009a [P] [US1] Integration test in `tests/integration/production/queue.test.ts`: seed a
  Work Item whose `departmentId` is null but whose order's Product Type has a
  `defaultDepartmentId`; assert it appears in that department's queue via the effective-department
  fallback (research.md §8); call `routeToDepartment` to override it to a different department;
  assert it now appears in the new department's queue and no longer the old one; start production
  on it, then attempt `routeToDepartment` again and assert it's refused

### Implementation for User Story 1

- [x] T013 [US1] Implement the effective-department helper in `src/server/production/queue.ts`
  (or a shared internal function both `queue.ts` and `jobCard.ts` import): resolves
  `workItem.departmentId ?? productType.defaultDepartmentId` (research.md §8, data-model.md's
  Effective department derived value)
- [x] T014a [US1] Implement `routeToDepartment(actor, workItemId, departmentId)` in
  `src/server/production/queue.ts` per contracts/production.md: authorize with the Head-Designer/
  Reception routing permission (confirm exact key against 001's role table — no new key expected);
  refuse with `DomainProductionError("PRODUCTION_ALREADY_STARTED")` once the Work Item is
  `IN_PRODUCTION` or later; `db.workItem.update({ departmentId })`, no state transition (depends
  on T006)
- [x] T010 [US1] Implement `getOperatorQueue(actor)` in `src/server/production/queue.ts` per
  contracts/production.md: `authorize(actor, "production.operate")`; query `WorkItem WHERE state =
  "READY_FOR_PRODUCTION"`, filter to rows whose effective department (T013) is in
  `actor.departmentIds`; derive `enteredQueueAt` from the most recent `WorkItemTransition` landing
  in `READY_FOR_PRODUCTION`; sort urgent-first then oldest (research.md §6/§7, same rule as
  012/013's queues)
- [x] T011 [US1] Export `getOperatorQueue`, `routeToDepartment`, and `ProductionQueueRow` from
  `src/server/production/index.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable
independently.

---

## Phase 4: User Story 2 - Operator works a job from its card (Priority: P1)

**Goal**: An operator opens a Work Item's job card, sees its read-only specification, and can
download only the Approved (or later Production-stage) file version, never a draft (FR-004,
FR-011).

**Independent Test**: Open the job card for a Work Item with both an approved version and a
newer, unapproved draft version; confirm the specification renders read-only and only the
approved version's file is offered for download.

### Tests for User Story 2

- [x] T012 [P] [US2] Contract test in `tests/contract/production/production.test.ts`:
  `getJobCard` requires `production.operate` scoped to the Work Item's department (FORBIDDEN
  for an operator outside it), returns spec fields and only the approved file pointer
- [x] T013 [P] [US2] Integration test in `tests/integration/production/jobCard.test.ts`: seed a
  Work Item with an approved `DesignVersion` and a newer unapproved draft; assert the job card's
  `approvedFile` points at the approved version only, never the draft, and spec fields match the
  Work Item's stored values

### Implementation for User Story 2

- [x] T014 [US2] Implement `getJobCard(actor, workItemId)` in `src/server/production/jobCard.ts`
  per contracts/production.md: load the Work Item + order + the current approved `DesignVersion`
  only (filter on `approvedAt IS NOT NULL`, take the latest); throw
  `DomainProductionError("WORK_ITEM_NOT_FOUND")` if missing; resolve the effective department
  (T013) and `authorize(actor, "production.operate", { departmentId: effectiveDepartmentId })`
  (depends on T006, T013)
- [ ] T015 [US2] Export `getJobCard`, `JobCard` from `src/server/production/index.ts`; build the
  job card's read-only spec + download section in `src/app/(shell)/production/[workItemId]/page.tsx`;
  Arabic keys in `src/messages/ar.json`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Operator times a production run (Priority: P1)

**Goal**: Start/pause/resume a Work Item's production timer, reusing 002's `PhaseTiming` with
`phase = "IN_PRODUCTION"`, with every duration re-derivable from persisted timestamps (FR-005).

**Independent Test**: Start a timer, pause it after some elapsed time, resume it, then read back
its recorded active duration; confirm the duration matches the sum of the active intervals
regardless of how long the pause lasted.

### Tests for User Story 3

- [ ] T016 [P] [US3] Contract test in `tests/contract/production/production.test.ts`:
  `startProduction` requires `production.operate` scoped to the department, transitions to
  `IN_PRODUCTION`, refuses if the Work Item is not `READY_FOR_PRODUCTION`; `pauseProduction`/
  `resumeProduction` require the same scope
- [ ] T017 [P] [US3] Integration test in `tests/integration/production/timer.test.ts`: start a
  timer, pause after a recorded interval, resume, pause again; assert the summed active duration
  across both `ACTIVE` `PhaseTiming` segments matches the elapsed intervals exactly, independent
  of wall-clock time spent paused

### Implementation for User Story 3

- [ ] T018 [US3] Implement `startProduction(actor, workItemId)` in `src/server/production/timer.ts`
  per contracts/production.md: `authorize`, `db.$transaction`:
  `transitionWorkItem(tx, { workItemId, to: "IN_PRODUCTION", actor })`, open a `PhaseTiming` row
  (`phase: "IN_PRODUCTION", kind: "ACTIVE", startedAt: now`)
- [ ] T019 [US3] Implement `pauseProduction(actor, workItemId)` in the same file: closes the open
  `ACTIVE` `PhaseTiming` row (`endedAt: now`); no state transition
- [ ] T020 [US3] Implement `resumeProduction(actor, workItemId)` in the same file: refuses with
  `DomainProductionError("PENDING_FILE_REVISION")` while `WorkItem.pendingFileRevisionAt` is
  non-null (research.md §4 — depends on T037 landing the field-setting side, but the check itself
  can land now against a field that is simply always null until US7 exists); otherwise opens a new
  `ACTIVE` `PhaseTiming` row
- [ ] T021 [US3] Export `startProduction`, `pauseProduction`, `resumeProduction` from
  `src/server/production/index.ts`; wire timer controls into the job card page

**Checkpoint**: User Stories 1, 2, AND 3 should all work independently.

---

## Phase 6: User Story 4 - Operator completes production with a produced quantity (Priority: P1)

**Goal**: Complete a Work Item's production with a required produced quantity and optional notes,
moving it to `PRODUCTION_COMPLETED`, stopping its timer, and recording completion time + operator
(FR-006, FR-007, FR-008).

**Independent Test**: Complete an in-production Work Item with a produced quantity and a note;
confirm it reaches `PRODUCTION_COMPLETED` with completion timestamp + operator recorded, its
timer stops, and it becomes visible to a collection-queue-scoped query.

### Tests for User Story 4

- [ ] T022 [P] [US4] Contract test in `tests/contract/production/production.test.ts`:
  `completeProduction` requires `production.operate` scoped to the department; rejects a
  submission missing `producedQuantity` with a validation error and no state change; on valid
  input transitions to `PRODUCTION_COMPLETED`
- [ ] T023 [P] [US4] Integration test in `tests/integration/production/completion.test.ts`:
  complete a Work Item with a produced quantity + note; assert `WorkItem.state ===
  "PRODUCTION_COMPLETED"`, `producedQuantity`/`productionNotes` are set, the open `PhaseTiming`
  row is closed, and an `audit.record` row exists for `workitem.production_completed`
- [ ] T024 [US4] Unit test in `tests/unit/production.test.ts`: the completion input schema rejects
  a missing/zero/negative `producedQuantity` and accepts a valid positive integer with optional
  `notes` omitted

### Implementation for User Story 4

- [ ] T025 [US4] Implement `completeProduction(actor, workItemId, input)` in
  `src/server/production/completion.ts` per contracts/production.md and data-model.md's
  Validation rules: validate `producedQuantity` (positive integer) before opening a transaction;
  if `Department.isExternalProduction`, refuse unless a `VendorProductionRecord` with non-null
  `receivedAt` exists (`DomainProductionError("VENDOR_RECEIPT_REQUIRED")`); `db.$transaction`:
  close any open `ACTIVE` `PhaseTiming` row, `transitionWorkItem(tx, { to:
  "PRODUCTION_COMPLETED", actor })`, `tx.workItem.update({ producedQuantity, productionNotes })`,
  `audit.record(tx, { action: "workitem.production_completed", ... })` (depends on T006, T018)
- [ ] T026 [US4] Export `completeProduction` from `src/server/production/index.ts`; add the
  completion form (produced quantity, notes) to the job card page; Arabic keys in
  `src/messages/ar.json`

**Checkpoint**: All P1 user stories functional — the core production flow is complete.

---

## Phase 7: User Story 5 - Operator sends a Work Item back to design (Priority: P2)

**Goal**: Send an in-production Work Item back to design with a required reason, reusing 013's
`createReturn` with origin `PRODUCTION_ISSUE` (FR-009, FR-010).

**Independent Test**: Send a Work Item in production back to design with a reason; confirm a
`Return` record exists with origin Production, the Work Item leaves the production queue, and the
assigned designer is notified.

### Tests for User Story 5

- [ ] T027 [P] [US5] Contract test in `tests/contract/production/production.test.ts`:
  `sendBackToDesign` requires `production.operate` scoped to the department; rejects a submission
  missing `reason` with a validation error and no state change; on valid input transitions to
  `REWORK_REQUIRED` and returns `{ returnId }`
- [ ] T028 [P] [US5] Integration test in `tests/integration/production/sendBack.test.ts`: send an
  in-production Work Item back to design with a reason; assert `WorkItem.state ===
  "REWORK_REQUIRED"`, a `Return` row exists with `category: "PRODUCTION_ISSUE"`,
  `originDepartmentId` = the Work Item's department, the open `PhaseTiming` row is closed, and the
  assigned designer has a `NotificationEvent` created in the same transaction

### Implementation for User Story 5

- [ ] T029 [US5] Define the `sendBackToDesign` input Zod schema in
  `src/server/production/sendBack.ts`: `reason` string required non-empty-after-trim
- [ ] T030 [US5] Implement `sendBackToDesign(actor, workItemId, input)` in the same file per
  contracts/production.md: `authorize`, validate input, `db.$transaction`: close any open
  `ACTIVE` `PhaseTiming` row, `transitionWorkItem(tx, { to: "REWORK_REQUIRED", actor, reason,
  rejectionCategory: "PRODUCTION_ISSUE" })` (T003's new edge), call 013's `createReturnInTx(tx,
  actor, workItemId, { category: "PRODUCTION_ISSUE", originDepartmentId: workItem.departmentId,
  assignedToId: workItem.assigneeId, explanation: input.reason })`, `notify(tx, { type:
  "workitem.rejected", ... })` (depends on T003, T006, T018, 013's exported `createReturnInTx`)
- [ ] T031 [US5] Export `sendBackToDesign` from `src/server/production/index.ts`; add the
  send-back form to the job card page; Arabic keys in `src/messages/ar.json`

**Checkpoint**: All P1/P2 (partial) user stories functional.

---

## Phase 8: User Story 6 - Work Item routed to an external vendor department (Priority: P3)

**Goal**: For `isExternalProduction` departments, record a "sent to vendor" step and a "received
from vendor" step, gating completion on receipt (FR-012).

**Independent Test**: Route a Work Item to an external department; record sent-to-vendor, attempt
completion (refused), record received-from-vendor, retry completion (succeeds).

### Tests for User Story 6

- [x] T032 [P] [US6] Contract test in `tests/contract/production/production.test.ts`:
  `recordSentToVendor` refuses for a non-external department
  (`DomainProductionError("NOT_EXTERNAL_DEPARTMENT")`); `recordReceivedFromVendor` refuses a
  second receipt on an already-received record (`"ALREADY_RECEIVED"`)
- [x] T033 [P] [US6] Integration test in `tests/integration/production/vendor.test.ts`: route a
  Work Item to an external department; attempt `completeProduction` before any vendor record
  exists (refused, `"VENDOR_RECEIPT_REQUIRED"`); record sent-to-vendor, attempt completion again
  (still refused); record received-from-vendor; retry completion (succeeds)

### Implementation for User Story 6

- [x] T034 [US6] Implement `recordSentToVendor(actor, workItemId, input)` in
  `src/server/production/vendor.ts` per contracts/production.md: `authorize`, validate
  `vendorName` non-empty, refuse if the Work Item's department is not `isExternalProduction`;
  create a `VendorProductionRecord` row (`sentAt: now`, `receivedAt: null`)
- [x] T035 [US6] Implement `recordReceivedFromVendor(actor, workItemId, recordId)` in the same
  file: refuse if no such record exists or it already has a non-null `receivedAt`; set
  `receivedAt = now`
- [ ] T036 [US6] Export `recordSentToVendor`, `recordReceivedFromVendor` from
  `src/server/production/index.ts`; add the vendor sent/received controls to the job card page
  (rendered only when the department is `isExternalProduction`); Arabic keys in
  `src/messages/ar.json`

**Checkpoint**: All P1/P2/P3 (partial) user stories functional.

---

## Phase 9: User Story 7 - Operator is alerted to a revised approved file mid-production (Priority: P2)

**Goal**: When a newer design version is approved while a Work Item is `IN_PRODUCTION`, set
`pendingFileRevisionAt` and block timer resume until the operator acknowledges it (FR-013).

**Independent Test**: Start production, approve a new design version for the same Work Item,
confirm the job card shows an alert and the timer cannot resume until acknowledged.

### Tests for User Story 7

- [x] T037 [P] [US7] Integration test in `tests/integration/production/revisedFileAck.test.ts`:
  start production on a Work Item, approve a newer `DesignVersion` for it (013's `approveDesign`);
  assert `WorkItem.pendingFileRevisionAt` is non-null; attempt `resumeProduction` and assert it is
  refused with `DomainProductionError("PENDING_FILE_REVISION")`; call
  `acknowledgeFileRevision`; assert `pendingFileRevisionAt` is now null and `resumeProduction`
  succeeds

### Implementation for User Story 7

- [x] T038 [US7] Extend 013's `approveDesign` (`src/server/review/review.ts`) — or add a small
  hook it calls — to set `WorkItem.pendingFileRevisionAt = now()` in the same transaction when the
  Work Item being approved is currently `IN_PRODUCTION` (a design revision approved for a Work
  Item not in production has nothing to alert; the field stays null). This is the one place this
  feature reaches into 013's module — coordinate the exact touch point with 013's own barrel
  before landing, since `src/server/review/**` is barrel-only from outside (eslint
  `no-restricted-imports`) and this write must happen inside 013's own transaction, not as a
  separate post-hoc update
- [x] T039 [US7] Implement `acknowledgeFileRevision(actor, workItemId)` in
  `src/server/production/timer.ts`: `authorize(actor, "production.operate", { departmentId })`;
  set `pendingFileRevisionAt = null` (does not itself resume the timer — the operator still calls
  `resumeProduction()` after)
- [ ] T040 [US7] Wire T020's existing `resumeProduction` refusal (already checks
  `pendingFileRevisionAt`) to this story's UI: show a revised-file alert badge on the queue (US1's
  `hasPendingFileRevision`) and job card, with an acknowledge control that calls
  `acknowledgeFileRevision`
- [ ] T041 [US7] Export `acknowledgeFileRevision` from `src/server/production/index.ts`; Arabic
  keys in `src/messages/ar.json`

**Checkpoint**: All 7 user stories independently functional — feature complete pending Polish.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across the whole module, plus 090's workload query.

- [x] T042 [P] Implement `getDepartmentWorkload(actor)` in `src/server/production/workload.ts` per
  contracts/production.md: per department, `readyCount`
  (`count(WorkItem WHERE departmentId = ... AND state = "READY_FOR_PRODUCTION")`) and
  `inProductionCount` (same with `state = "IN_PRODUCTION"`); export from
  `src/server/production/index.ts`
- [ ] T043 [P] Add the `/production` queue page in `src/app/(shell)/production/page.tsx` rendering
  `getOperatorQueue`'s rows (urgent-first, revised-file badge per US7); add a `production` nav
  entry gated to `PRODUCTION_OPERATOR`/`ADMIN_OWNER` (mirrors 013's `review` nav entry)
- [ ] T044 Run `pnpm check` (lint + typecheck) across the new `src/server/production/**` module,
  the `edges.ts` change, and every edited file; fix any violation
- [ ] T045 Run the full `pnpm test` suite; confirm every pre-existing 001/002/011/012/013 test
  still passes unmodified and every new `tests/{unit,contract,integration}/production/**` test
  passes once T002 unblocks the DB-dependent ones (unit tests T007/T024 pass regardless of T002)
- [ ] T046 Manual quickstart QA — DB-dependent, blocked on T002 like every prior feature's own
  final task: walk through quickstart.md's Scenarios 1–8 end-to-end against a running dev server

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately once 012/013 are merged (or this
  branch is based on 013-review-rework-impl, per the Path Conventions note above)
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–9)**: All depend on Foundational phase completion
  - US1 (queue) has no dependency on other stories beyond Foundational
  - US2 (job card) is independent of US1 beyond Foundational, though the UI naturally links from
    the queue (US1) to the card (US2)
  - US3 (timer) is independent of US1/US2's implementation, though its UI lives on US2's job card
    page
  - US4 (completion) depends on US3's `PhaseTiming` row existing to close, but its own contract
    tests can seed a `PhaseTiming` row directly without calling `startProduction`
  - US5 (send-back) depends on T003's new edge and T018's timer-closing pattern; otherwise
    independent
  - US6 (vendor) is independent of US1–US5 beyond Foundational; only US4's completion gate reads
    US6's data
  - US7 (revised-file alert) depends on T020 (US3's `resumeProduction` already containing the
    check) and reaches into 013's `approveDesign` (T038) — this is the one cross-feature
    implementation touch point in this whole feature
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests written before implementation, expected to fail first
- Errors/schemas before services; services before endpoints/UI
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup [P] tasks (T003, T004, T005) run in parallel once T001/T002 land
- All Foundational [P] tasks (T006, T007) run in parallel
- Once Foundational completes, US1/US2/US3/US6 can start in parallel; US4 should wait for US3's
  `PhaseTiming`-closing pattern to exist for realistic integration-test seeding; US5 should wait
  for T003's edge; US7 is the last story to land since it touches 013's module
- All tests for a given story marked [P] run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for getOperatorQueue in tests/contract/production/production.test.ts"
Task: "Integration test for queue scoping/ordering in tests/integration/production/queue.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (queue)
4. **STOP and VALIDATE**: An operator can see what's ready for their department, even before the
   job card/timer/completion exist
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (queue) → Test independently → Demo
3. US2 (job card) + US3 (timer) → Test independently → Demo
4. US4 (completion) → Test independently → Demo — **the core production flow now exists end to
   end**
5. US5 (send-back) + US6 (vendor) → Test independently → Demo
6. US7 (revised-file alert) → Test independently → Demo
7. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- T002 (DB push) remains the standing blocker across every DB-dependent test in this file, same
  as every prior feature — do not run it unattended; confirm with Fady first
- T038 is the one place this feature's implementation touches another feature's module
  (013's `src/server/review/review.ts`) — coordinate before landing rather than editing it
  unilaterally, since 013's own barrel/module-boundary rule governs that file
