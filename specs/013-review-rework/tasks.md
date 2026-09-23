---

description: "Task list template for feature implementation"
---

# Tasks: Head Designer Review & Rework Loop

**Input**: Design documents from `/specs/013-review-rework/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/review-rework.md](./contracts/review-rework.md), [quickstart.md](./quickstart.md)

**Tests**: Included — plan.md's Project Structure enumerates specific test files under `tests/unit`, `tests/contract`, `tests/integration`, so this list generates the matching test tasks alongside each story's implementation.

**Organization**: Tasks are grouped by user story (spec.md's 6 stories, priorities P1/P1/P1/P2/P3/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to spec.md's US1–US6
- Every task names its exact file path

## Path Conventions

Single Next.js project (plan.md Project Structure): `src/server/review/**`, `src/app/(shell)/**`, `prisma/schema/core.prisma`, `tests/{unit,contract,integration}/review/**`.

**Hard prerequisite**: this feature reads and extends 012's `DesignVersion` model. Setup Phase 1's
T001 assumes 012 is merged to `main`; if it is not yet merged when this phase starts, base this
branch on `012-designer-assignment-timers-impl` instead and rebase once 012 lands (do not
reimplement `DesignVersion` here).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the schema diff and module scaffolding every story builds on.

- [x] T001 Apply the schema diff in `prisma/schema/core.prisma` per data-model.md: add `model Return` (id, `workItemId` + relation, `raisedById` + relation `User "ReturnRaisedBy"`, `originDepartmentId` + relation, `category RejectionCategory`, `assignedToId` + relation `User "ReturnAssignedTo"`, `explanation String`, `note String?`, `designVersionId String?` + relation, `createdAt DateTime @default(now())`, `@@index([workItemId, createdAt])`); add `model ReturnAttachment` (id, `returnId` + relation, `kind ReturnAttachmentKind`, `storageKey String`, `fileName String`, `mimeType String?`, `sizeBytes Int`, `createdAt DateTime @default(now())`, `@@index([returnId])`); add `enum ReturnAttachmentKind { VOICE_NOTE IMAGE FILE }`; add `DesignVersion.approvedAt DateTime?`, `DesignVersion.approvedById String?` + relation `User "DesignVersionApprovedBy"`, `DesignVersion.returns Return[]` back-relation; add `Department.returns Return[]` back-relation
- [ ] T002 **ACTION REQUIRED — blocked, do not run unattended.** Run `pnpm exec prisma db push` then `pnpm exec prisma db seed` to apply T001's schema. **Blocker**: same shared-dev-DB drift noted in `specs/011-orders-reception/tasks.md`'s T002 and `specs/012-designer-assignment-timers/tasks.md`'s T002 — confirm with Fady before pushing. Whoever picks this up: (1) confirm with Fady, (2) run the two commands, (3) re-run the integration suite below to confirm it passes against a live schema, (4) check off T041 (manual quickstart QA) once seeded data is available
- [x] T003 [P] Add a `no-restricted-imports` rule for `src/server/review/**` to `eslint.config.js`, identical in shape to the existing `src/server/orders/**`/`src/server/designers/**` rules: only `~/server/review` (the barrel) is importable from outside; `tests/**` exempted
- [x] T004 [P] Create the barrel `src/server/review/index.ts` with no exports yet (placeholder `export {}` — populated incrementally as each story's functions land)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reused primitives every user story's implementation calls into.

**⚠️ CRITICAL**: No user story implementation task may start until this phase is complete.

- [x] T005 [P] Implement `DomainReviewError` in `src/server/review/errors.ts` — a local error class carrying `code: "WORK_ITEM_NOT_FOUND" | "NOT_REVIEWABLE" | "NO_DESIGN_VERSION"` and a human-readable message (contracts/review-rework.md's Errors section)
- [x] T006 Register the no-self-review guard in `src/server/review/guards.ts` per contracts/review-rework.md: `registerGuard({ to: "APPROVED" }, guard)` where `guard` loads the target Work Item's current `DesignVersion` and returns `GUARD_FAILED` if `currentVersion.uploadedById === ctx.actor.userId` (research.md §4); import this module once at server boot (same pattern as any other `registerGuard` caller — locate the existing boot-time guard-registration entry point used by 002/012 and add this module's import there)
- [x] T007 [P] Unit tests for the no-self-review guard's pure comparison logic in `tests/unit/review-rework.test.ts` — cover: same uploader blocks (`GUARD_FAILED`), different uploader passes, no current version passes (nothing to compare against — defers to `NO_DESIGN_VERSION` handling elsewhere, not the guard's job)

**Checkpoint**: Foundation ready — every user story phase below may now start.

---

## Phase 3: User Story 1 - Head Designer reviews the queue (Priority: P1) 🎯 MVP

**Goal**: Head Designer opens `/review` and sees every `WAITING_REVIEW` Work Item, urgent-first then oldest-first, with rework count visible (FR-001, FR-002, FR-013).

**Independent Test**: Seed three `WAITING_REVIEW` Work Items (one urgent, two normal at different ages) plus one Work Item in another state; open the queue and confirm ordering and that the non-`WAITING_REVIEW` item is absent.

### Tests for User Story 1

- [x] T008 [P] [US1] Contract test in `tests/contract/review/review-rework.test.ts`: `getReviewQueue` requires `design.review` (FORBIDDEN without it), returns only `WAITING_REVIEW` rows, matches the frozen `ReviewQueueRow` shape (data-model.md/contracts/review-rework.md)
- [x] T009 [P] [US1] Integration test in `tests/integration/review/queue.test.ts`: seed 3 `WAITING_REVIEW` items (1 urgent, 2 normal at different `enteredQueueAt`) + 1 non-`WAITING_REVIEW` item; assert queue order is urgent, then oldest-to-newest normal, and the 4th item is absent

### Implementation for User Story 1

- [x] T010 [US1] Implement `getReviewQueue(actor)` in `src/server/review/queue.ts` per contracts/review-rework.md: `authorize(actor, "design.review")`; query `WorkItem WHERE state = "WAITING_REVIEW"`; derive `enteredQueueAt` from the most recent `WorkItemTransition` landing in `WAITING_REVIEW`; derive `reworkCount` via `count(Return WHERE workItemId = ...)` (research.md §1); sort urgent-first then oldest-`enteredQueueAt`-first (FR-001, research.md §6 — same rule as 012's `getMyQueue`)
- [x] T011 [US1] Export `getReviewQueue` and `ReviewQueueRow` from `src/server/review/index.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Head Designer reviews and approves a design (Priority: P1)

**Goal**: Head Designer opens a Work Item's review screen (current + prior versions, order spec, customer notes), approves it, advancing the Work Item and marking the version approved — blocked by the self-review guard when the reviewer is also the uploader (FR-003–FR-005, FR-012, FR-017).

**Independent Test**: Seed a `WAITING_REVIEW` Work Item with one `DesignVersion`; approve it as a Head Designer who did not upload that version; confirm `approvedAt`/`approvedById` are set, the Work Item reaches `APPROVED`, and an audit event is recorded. Separately, attempt approval as the version's own uploader and confirm it is blocked.

### Tests for User Story 2

- [x] T012 [P] [US2] Contract test in `tests/contract/review/review-rework.test.ts`: `getReviewDetail` requires `design.review` (FORBIDDEN without it), returns versions ordered with the latest as current, includes order spec + customer notes; `approveDesign` requires `design.review`, sets `approvedAt`/`approvedById` on the current version, transitions to `APPROVED`
- [x] T013 [P] [US2] Integration test in `tests/integration/review/approve.test.ts`: seed a `WAITING_REVIEW` Work Item with 2 `DesignVersion` rows; approve as a non-uploading Head Designer; assert the latest version's `approvedAt`/`approvedById` are set, the earlier version is untouched, `WorkItem.state === "APPROVED"`, and an `audit.record` row exists for `workitem.design_approved`
- [x] T014 [P] [US2] Integration test in `tests/integration/review/selfReviewGuard.test.ts`: seed a `WAITING_REVIEW` Work Item whose current `DesignVersion.uploadedById` equals the acting Head Designer's `userId`; call `approveDesign`; assert it throws/rejects as a guard failure and no state change occurred (spec Acceptance Scenario 4, User Story 2)

### Implementation for User Story 2

- [x] T015 [US2] Implement `getReviewDetail(actor, workItemId)` in `src/server/review/review.ts` per contracts/review-rework.md: `authorize(actor, "design.review")`; load `WorkItem` + `order` + `DesignVersion` rows ordered by `version`; throw `DomainReviewError("WORK_ITEM_NOT_FOUND")` if missing (depends on T005)
- [x] T016 [US2] Implement `approveDesign(actor, workItemId)` in `src/server/review/review.ts` per contracts/review-rework.md step-by-step: `authorize`, `db.$transaction`, load current `DesignVersion` (throw `DomainReviewError("NOT_REVIEWABLE")`/`"NO_DESIGN_VERSION"` as applicable), `transitionWorkItem(tx, { workItemId, to: "APPROVED", actor })` (the T006 guard runs here), `tx.designVersion.update({ approvedAt, approvedById })`, `audit.record(tx, { action: "workitem.design_approved", ... })` (depends on T005, T006, T015)
- [x] T017 [US2] Export `getReviewDetail`, `approveDesign`, `ReviewDetail`, `VersionSummary` from `src/server/review/index.ts`
- [x] T018 [US2] Build `/review/[workItemId]` review screen in `src/app/(shell)/review/[workItemId]/page.tsx`: current version preview, prior versions list, order dimensions/quantity/material, customer notes, Approve button (Server Action calling `approveDesign`); Arabic keys in `src/messages/ar.json`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Head Designer rejects a design with a categorized reason (Priority: P1)

**Goal**: Head Designer rejects a `WAITING_REVIEW` Work Item with a required category/origin department/explanation plus optional note/attachments, creating a `Return` record and notifying the assigned designer in the same transaction (FR-006–FR-010, FR-016).

**Independent Test**: Reject a `WAITING_REVIEW` Work Item supplying all required fields; confirm the Work Item reaches `REWORK_REQUIRED`, a `Return` row exists with all fields, and the assigned designer has a notification deep-linked to it. Separately, submit without a category or explanation and confirm a validation error with no state change.

### Tests for User Story 3

- [x] T019 [P] [US3] Contract test in `tests/contract/review/review-rework.test.ts`: `rejectDesign` requires `design.review` (FORBIDDEN without it); rejects a submission missing `category`/`originDepartmentId`/`explanation` with a validation error and no state change; on valid input returns `{ returnId }`, transitions to `REWORK_REQUIRED`, creates a `Return` row
- [x] T020 [P] [US3] Integration test in `tests/integration/review/reject.test.ts`: reject a `WAITING_REVIEW` Work Item with category/originDepartmentId/explanation; assert `WorkItem.state === "REWORK_REQUIRED"`, a `Return` row exists with `raisedById`, `originDepartmentId`, `category`, `assignedToId` (= the Work Item's assignee), `explanation`, `designVersionId` (= the current version at rejection time); assert a `NotificationEvent` recipient includes the assignee and was created in the same transaction (query both inside one `$transaction` read, or assert both exist immediately after the call with matching timestamps)
- [x] T021 [P] [US3] Integration test in `tests/integration/review/rejectAttachments.test.ts`: reject with a voice-note-kind and an image-kind attachment; assert two `ReturnAttachment` rows exist, each with correct `kind`/`storageKey`/`fileName`, both referencing the created `Return`
- [ ] T022 [US3] Unit test in `tests/unit/review-rework.test.ts`: the reject-input Zod schema rejects empty/whitespace-only `explanation`, missing `category`, missing `originDepartmentId`, and accepts a valid payload with optional `note`/`attachments` omitted

### Implementation for User Story 3

- [x] T023 [US3] Define the `rejectDesign` input Zod schema in `src/server/review/review.ts` (or a co-located `schemas.ts`) per data-model.md's Validation rules: `category` enum required, `originDepartmentId` string required, `explanation` string required non-empty-after-trim, `note` optional string, `attachments` optional array
- [x] T024 [US3] Implement `createReturn(actor, workItemId, input)` in `src/server/review/returns.ts` per contracts/review-rework.md: no `authorize()` beyond authenticated actor; writes attachment bytes via `StorageAdapter.put` before the metadata commit (012's `uploadDesignVersion` ordering), creates the `Return` row with nested `ReturnAttachment` creates inside the given transaction (depends on T001)
- [x] T025 [US3] Implement `rejectDesign(actor, workItemId, input)` in `src/server/review/review.ts` per contracts/review-rework.md: `authorize(actor, "design.review")`, validate input (T023), `db.$transaction`: load Work Item + current version (throw `DomainReviewError` as in `approveDesign`), `transitionWorkItem(tx, { to: "REWORK_REQUIRED", actor, reason: input.explanation, rejectionCategory: input.category })`, call `createReturn`'s transactional write path (T024) with `assignedToId: workItem.assigneeId`, `designVersionId: currentVersion.id`, then `notify(tx, { type: "workitem.rejected", ... })` in the same transaction; return `{ returnId }` (depends on T005, T023, T024)
- [x] T026 [US3] Export `rejectDesign`, `createReturn` from `src/server/review/index.ts`
- [x] T027 [US3] Add the Reject form to `/review/[workItemId]`'s page (`src/app/(shell)/review/[workItemId]/page.tsx`): category select, origin department select (from existing `Department` data), required explanation field, optional note/voice-note-recording/image/file inputs, client-side required-field hints (server remains authoritative per constitution V); Arabic keys in `src/messages/ar.json`

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently — the core review gate is complete.

---

## Phase 6: User Story 4 - Anyone views a Work Item's full version and decision timeline (Priority: P2)

**Goal**: Any authenticated user can see a Work Item's complete version history with each version's outcome, reviewer, and reason (FR-011, FR-012's read side).

**Independent Test**: Seed a Work Item with v1 (rejected), v2 (rejected), v3 (approved); view its timeline and confirm all three appear in order with correct outcome/reviewer/reason, and that approved versions are marked immutable (no replace-in-place path exists).

### Tests for User Story 4

- [x] T028 [P] [US4] Contract test in `tests/contract/review/review-rework.test.ts`: `getVersionTimeline` requires no permission beyond an authenticated actor, matches the frozen `TimelineEntry` shape for APPROVED/REJECTED/PENDING outcomes
- [x] T029 [P] [US4] Integration test in `tests/integration/review/timeline.test.ts`: seed v1 (rejected via a `Return`), v2 (rejected via a `Return`), v3 (approved); assert `getVersionTimeline` returns all 3 in version order with v1/v2 as `REJECTED` (correct `category`/`explanation`/`reviewedById`/`reviewedAt`) and v3 as `APPROVED` (correct `approvedById`/`approvedAt`)
- [x] T030 [US4] Integration test in `tests/integration/review/versionImmutability.test.ts`: attempt to create a second `DesignVersion` row reusing an already-approved version's `version` number for the same `workItemId`; assert the unique `(workItemId, version)` constraint (012, unchanged here) rejects it — confirms FR-012's "no replace in place" holds without any new enforcement code in this feature

### Implementation for User Story 4

- [x] T031 [US4] Implement `getVersionTimeline(actor, workItemId)` in `src/server/review/timeline.ts` per contracts/review-rework.md and data-model.md's Derived values: no `authorize()` beyond authenticated actor; join `DesignVersion` (ordered by `version` ascending) with any `Return` referencing each version, producing `APPROVED | REJECTED | PENDING` outcomes
- [x] T032 [US4] Export `getVersionTimeline`, `TimelineEntry` from `src/server/review/index.ts`
- [x] T033 [US4] Add a `<VersionTimeline>` component rendering `getVersionTimeline`'s output, mounted on `/review/[workItemId]`'s page below the approve/reject controls (contracts/review-rework.md notes 054/090 as future consumers of the underlying data, not this UI); Arabic keys in `src/messages/ar.json`

**Checkpoint**: All P1/P2 user stories should now be independently functional.

---

## Phase 7: User Story 5 - Rework counter and repeated-rejection visibility (Priority: P3)

**Goal**: Rework count (derived, research.md §1) is visible wherever a Work Item's summary appears, starting with the review queue already built in US1 (FR-013, SC-006).

**Independent Test**: Reject the same Work Item three times across separate cycles; confirm its rework counter reads 3.

### Tests for User Story 5

- [ ] T034 [P] [US5] Integration test in `tests/integration/review/reworkCounter.test.ts`: reject the same Work Item 3 times (upload → reject cycles); assert `getReviewQueue`'s row for that Work Item (while it's back in `WAITING_REVIEW` on its 4th cycle) reports `reworkCount: 3`, matching a direct `count(Return WHERE workItemId = ...)` query

### Implementation for User Story 5

- [ ] T035 [US5] Verify `getReviewQueue` (`src/server/review/queue.ts`, T010) already exposes `reworkCount`/`isRework` per data-model.md/contracts/review-rework.md — this task is verification via T034's test, not new implementation, since T010 already includes the derived count (research.md §1's design was applied at US1 build time, not deferred)
- [ ] T036 [US5] Surface `reworkCount`/`isRework` on the order detail page (`src/app/(shell)/orders/[orderId]/page.tsx`, 011/012) next to each Work Item row that has `reworkCount > 0`, reusing `getReviewQueue`'s derived-count query pattern (a small standalone read, not a `getReviewQueue` call, since order detail may show Work Items not currently in `WAITING_REVIEW`); Arabic keys in `src/messages/ar.json`

**Checkpoint**: All P1/P2/P3-visibility user stories functional.

---

## Phase 8: User Story 6 - Production and Pricing can also send work back via the same Return mechanism (Priority: P3)

**Goal**: Confirm `createReturn` (built in US3, T024) is generic enough for 014/051 to call directly later, with no Review-specific fields blocking a non-design-review caller (FR-014).

**Independent Test**: Inspect `createReturn`'s input/output shape and the `Return` model for any field that only a design-review rejection could populate; confirm none exists (`designVersionId` is optional).

### Tests for User Story 6

- [ ] T037 [US6] Unit test in `tests/unit/review-rework.test.ts`: type-level/runtime check that `createReturn` accepts a call with `designVersionId` omitted (simulating a non-design-review caller) and successfully creates a `Return` row with `designVersionId: null`

### Implementation for User Story 6

- [ ] T038 [US6] Confirm `createReturn` (`src/server/review/returns.ts`, T024) already has no `authorize()` call beyond the caller being an authenticated `Actor`, and that `designVersionId` is optional in both the Zod schema and the Prisma write — this task is verification via T037's test, not new implementation (User Story 6 depends on T024's shape being right, not on new code)

**Checkpoint**: All 6 user stories independently functional — feature complete pending Polish.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across the whole module.

- [ ] T039 [P] Add the `/review` queue page in `src/app/(shell)/review/page.tsx` rendering `getReviewQueue`'s rows (urgent-first, rework-count badge per US5); reserve/confirm the `review` nav entry exists for the `design.review` permission (mirrors 012's `my-queue` nav entry for `design.work`)
- [x] T040 Run `pnpm check` (lint + typecheck) across the new `src/server/review/**` module and every edited file; fix any violation
- [ ] T041 Run the full `pnpm test` suite; confirm every pre-existing 001/002/011/012 test still passes unmodified and every new `tests/{unit,contract,integration}/review/**` test passes once T002 unblocks the DB-dependent ones (unit tests T007/T022/T037 pass regardless of T002)
- [ ] T042 Manual quickstart QA — DB-dependent, blocked on T002 like 011's/012's own T052/T043: walk through quickstart.md's Scenarios 1–8 end-to-end against a running dev server

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately once 012 is merged (or this branch is based on 012's impl branch, per the Path Conventions note above)
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–8)**: All depend on Foundational phase completion
  - US1 (queue) has no dependency on US2/US3 beyond Foundational
  - US2 (approve) and US3 (reject) both depend on `getReviewDetail`'s shared load pattern but are otherwise independent of each other — implement in either order
  - US4 (timeline) reads data US2/US3 produce; independently testable once seeded directly (does not require calling `approveDesign`/`rejectDesign` — integration tests seed `Return`/`DesignVersion` rows directly)
  - US5 (rework counter) is pure verification of US1's already-derived value, plus one small UI surface
  - US6 (generic Return) is pure verification of US3's `createReturn` shape
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests written before implementation, expected to fail first
- Errors/schemas before services; services before endpoints/UI
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup [P] tasks (T003, T004) run in parallel once T001/T002 land
- All Foundational [P] tasks (T005, T007) run in parallel; T006 depends on T005
- Once Foundational completes, US1/US2/US3 can start in parallel; US4/US5/US6 should wait for US2/US3's writes to exist for realistic integration-test seeding, though their own implementation tasks have no code dependency on US2/US3's *implementation* (only on data shapes already frozen in data-model.md/contracts)
- All tests for a given story marked [P] run in parallel

---

## Parallel Example: User Story 3

```bash
# Launch all tests for User Story 3 together:
Task: "Contract test for rejectDesign in tests/contract/review/review-rework.test.ts"
Task: "Integration test for reject in tests/integration/review/reject.test.ts"
Task: "Integration test for reject attachments in tests/integration/review/rejectAttachments.test.ts"
Task: "Unit test for reject-input schema in tests/unit/review-rework.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (queue)
4. **STOP and VALIDATE**: Head Designer can see what's waiting, even before approve/reject exist
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (queue) → Test independently → Demo
3. US2 (approve) + US3 (reject) → Test independently → Demo — **the actual quality gate now exists**
4. US4 (timeline) → Test independently → Demo
5. US5 (rework counter) + US6 (generic Return) → Test independently → Demo
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- T002 (DB push) remains the standing blocker across every DB-dependent test in this file, same
  as 011/012 — do not run it unattended; confirm with Fady first
