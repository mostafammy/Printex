---

description: "Task list template for feature implementation"
---

# Tasks: Designer Assignment & Timers

**Input**: Design documents from `/specs/012-designer-assignment-timers/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/designer-assignment.md](./contracts/designer-assignment.md), [quickstart.md](./quickstart.md)

**Tests**: Included — plan.md's Project Structure enumerates specific test files under `tests/unit`, `tests/contract`, `tests/integration`, so this list generates the matching test tasks alongside each story's implementation.

**Organization**: Tasks are grouped by user story (spec.md's 5 stories, priorities P1/P1/P1/P2/P2) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to spec.md's US1–US5
- Every task names its exact file path

## Path Conventions

Single Next.js project (plan.md Project Structure): `src/server/designers/**`, `src/app/(shell)/**`, `prisma/schema/core.prisma`, `tests/{unit,contract,integration}/designers/**`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the schema diff and module scaffolding every story builds on.

- [x] T001 Apply the schema diff in `prisma/schema/core.prisma` per data-model.md: add `model DesignVersion` (id, `workItemId String` + relation, `version Int`, `storageKey String`, `fileName String`, `mimeType String?`, `sizeBytes Int`, `sha256 String`, `note String?`, `uploadedById String` + relation to `User`, `createdAt DateTime @default(now())`, `@@unique([workItemId, version])`, `@@index([workItemId, createdAt])`); add `WorkItem.designVersions DesignVersion[]` back-relation; add `User.designVersionsUploaded DesignVersion[]` back-relation (named, matching `WorkItemAssignee`/`PhaseTimingUser` convention)
- [ ] T002 **ACTION REQUIRED — blocked, do not run unattended.** Run `pnpm exec prisma db push` then `pnpm exec prisma db seed` to apply T001's schema. **Blocker**: same shared-dev-DB drift noted in `specs/011-orders-reception/tasks.md`'s T002 — confirm with Fady before pushing. Whoever picks this up: (1) confirm with Fady, (2) run the two commands, (3) re-run `pnpm exec vitest run tests/unit/designers/suggestion.test.ts` and the integration suite below to confirm they pass against a live schema, (4) check off T043 (manual quickstart QA) once seeded data is available
- [x] T003 [P] Add a `no-restricted-imports` rule for `src/server/designers/**` to `eslint.config.js`, identical in shape to the existing `src/server/orders/**` rule: only `~/server/designers` (the barrel) is importable from outside; `tests/**` exempted
- [x] T004 [P] Create the barrel `src/server/designers/index.ts` with no exports yet (placeholder `export {}` — populated incrementally as each story's functions land)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reused primitives every user story's implementation calls into.

**⚠️ CRITICAL**: No user story implementation task may start until this phase is complete.

- [x] T005 [P] Add `openSegment`, `closeOpenSegment`, `calculatePhaseDurationMs` (from `src/server/core/workflow/timing.ts`) and the `PhaseTimingKind`, `PhaseTimingSegment` types to `src/server/core/index.ts`'s public barrel — research.md §2's found gap; a pure additive export, no logic change to `timing.ts` itself
- [x] T006 [P] Implement `DomainDesignerError` in `src/server/designers/errors.ts` — a local error class carrying `code: "NOT_ASSIGNABLE" | "REASON_REQUIRED" | "NOT_ASSIGNEE" | "NOT_TIMEABLE" | "NOT_IN_DESIGN" | "NO_DESIGN_VERSION" | "WORK_ITEM_NOT_FOUND"` and a human-readable message (contracts/designer-assignment.md's Authorization table section)
- [x] T007 [P] Implement `suggestDesigner()` in `src/server/designers/suggestion.ts` — pure function taking `ReadonlyArray<{ userId: string; name: string; activeWorkItemCount: number; lastAssignedAt: Date | null }>`, returns the `userId` of the candidate with the fewest `activeWorkItemCount`, ties broken by earliest `lastAssignedAt` (nulls last), then by `name` (FR-003, data-model.md's `EligibleDesigner.isSuggested`)
- [x] T008 [P] Unit tests for `suggestDesigner()` in `tests/unit/designers/suggestion.test.ts` — cover: single lowest-count candidate wins; tie on count broken by earlier `lastAssignedAt`; tie on count AND `lastAssignedAt` broken by name; empty array returns `null`

**Checkpoint**: Foundation ready — every user story phase below may now start.

---

## Phase 3: User Story 1 - Assign a designer to a new Work Item (Priority: P1) 🎯 MVP

**Goal**: Reception opens a `NEW` Work Item, sees eligible designers with workload/customer-history, picks one (a suggestion is shown but never auto-confirmed), and the item becomes `ASSIGNED` (FR-001–FR-004, FR-006).

**Independent Test**: Open a `NEW` Work Item's order page, open the assignment dialog, confirm every eligible designer is shown with workload/customer-history and exactly one is marked suggested, assign one, and confirm the Work Item is `ASSIGNED` to that designer with a notification and audit trail recorded.

### Tests for User Story 1

- [ ] T009 [P] [US1] Integration test in `tests/integration/designers/assign.test.ts`: `assignDesigner` on a `NEW` Work Item transitions it to `ASSIGNED` with the chosen `assigneeId`, calls `notify()` for the designer, and records a `WorkItemTransition` row (`from: "NEW", to: "ASSIGNED"`); `getEligibleDesigners` returns only active `design.work` holders with correct `activeWorkItemCount`/`pastJobsForCustomer` counts and exactly one `isSuggested: true`
- [ ] T010 [P] [US1] Contract test in `tests/contract/designers/designer-assignment.test.ts`: `getEligibleDesigners`/`assignDesigner` (initial-assignment branch) match contracts/designer-assignment.md's frozen shapes and Authorization table (`workitem.assign_designer` required; `FORBIDDEN` without it)

### Implementation for User Story 1

- [ ] T011 [US1] Implement `getEligibleDesigners(actor, workItemId)` in `src/server/designers/assignment.ts` per contracts/designer-assignment.md: `authorize(actor, "workitem.assign_designer")`; throws `DomainDesignerError("WORK_ITEM_NOT_FOUND")`/`("NOT_ASSIGNABLE")` per the state guard (`NEW`, `ASSIGNED`, `REWORK_REQUIRED`, `IN_DESIGN` only); queries active `design.work` holders; computes `activeWorkItemCount`, `queueSize`, `estimatedWaitMinutes`, `pastJobsForCustomer` per data-model.md's `EligibleDesigner`; calls `suggestDesigner()` (T007) to mark `isSuggested` (depends on T001, T007)
- [ ] T012 [US1] Implement `assignDesigner(actor, workItemId, designerId, reason?)`'s initial-assignment branch (no prior `assigneeId`) in `src/server/designers/assignment.ts` per contracts/designer-assignment.md: `authorize(actor, "workitem.assign_designer")`; `db.$transaction` calling `transitionWorkItem(tx, { workItemId, to: "ASSIGNED", actor })` then `tx.workItem.update({ data: { assigneeId: designerId } })` in the same `tx`; `audit.record(tx, { action: "workitem.assigned", ... })`; `notify(tx, { type: "workitem.assigned", recipients: { userIds: [designerId] } })` (FR-004, FR-006) (depends on T005, T006)
- [ ] T013 [US1] Export `getEligibleDesigners`, `assignDesigner` from `src/server/designers/index.ts` (depends on T011, T012)
- [ ] T014 [US1] Add the assignment dialog (eligible-designer list, workload/customer-history columns, suggested-designer highlight, confirm button, no reason field for initial assignment) plus its inline `"use server"` Server Action to `src/app/(shell)/orders/[orderId]/page.tsx`, mirroring 011's existing form patterns on that same page; calls `assignDesigner`, `revalidatePath` (depends on T013)

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Reassign a Work Item to a different designer (Priority: P1)

**Goal**: An already-assigned Work Item can be handed to a different designer with a mandatory reason; the previous designer's recorded time is preserved (FR-005, FR-005a, FR-007).

**Independent Test**: Reassign an `ASSIGNED`/`IN_DESIGN` Work Item to a different eligible designer with a reason, and confirm the new designer's queue shows it, the old designer's doesn't, previously recorded `PhaseTiming` segments are unchanged, and an audit event captures the reason.

### Tests for User Story 2

- [ ] T015 [P] [US2] Integration test in `tests/integration/designers/reassign.test.ts`: reassigning without a `reason` throws `DomainDesignerError("REASON_REQUIRED")`; reassigning with a reason updates `assigneeId` without calling `transitionWorkItem` (state unchanged) and records `audit.record` with `before`/`after` assignee ids and the reason; reassigning an `IN_DESIGN` Work Item with an open `ACTIVE` segment closes that segment (previous designer's recorded time preserved, confirmed via a `PhaseTiming` row assertion) — covers US2 Acceptance Scenarios 1–3
- [ ] T016 [US2] Extend `tests/contract/designers/designer-assignment.test.ts`: `assignDesigner`'s reassignment branch matches contracts/designer-assignment.md (same `workitem.assign_designer` permission gate — no separate reassignment permission per FR-005a)

### Implementation for User Story 2

- [ ] T017 [US2] Implement `assignDesigner`'s reassignment branch (existing `assigneeId` differs from `designerId`) in `src/server/designers/assignment.ts`: throws `DomainDesignerError("REASON_REQUIRED")` if `reason` is empty/whitespace-only; if an open `ACTIVE` `PhaseTiming` segment exists, `closeOpenSegment(tx, { workItemId, kind: "ACTIVE" })`; `tx.workItem.update({ data: { assigneeId: designerId } })` (no `transitionWorkItem` call — research.md §3); `audit.record(tx, { action: "workitem.reassigned", before: { assigneeId: previousAssigneeId }, after: { assigneeId: designerId }, reason })`; `notify(tx, ...)` (depends on T012)
- [ ] T018 [US2] Wire the reassignment path (conditional reason field, shown only when the Work Item already has an assignee) into the same assignment dialog built in T014, `src/app/(shell)/orders/[orderId]/page.tsx` (depends on T014, T017)

**Checkpoint**: User Story 2 is fully functional and testable independently.

---

## Phase 5: User Story 3 - Work a queue with a start/pause/resume/stop timer (Priority: P1)

**Goal**: A designer's personal "My queue" (urgent-first, then oldest), with a timer whose durations always re-derive correctly from persisted timestamps, including across a refresh/restart, and with only one active timer per designer (FR-008–FR-015).

**Independent Test**: Start a timer on an `ASSIGNED` Work Item, confirm it moves to `IN_DESIGN`, pause/resume it multiple times, refresh the browser and restart the server process, and confirm computed durations are identical before and after.

### Tests for User Story 3

- [ ] T019 [P] [US3] Integration test in `tests/integration/designers/timer.test.ts`: `startTimer` on an `ASSIGNED` Work Item transitions it to `IN_DESIGN` and opens an `ACTIVE` segment; `pauseTimer` closes the open `ACTIVE` segment without changing state; a second `startTimer` (resume) opens a new `ACTIVE` segment; `phaseDurations` computed before and after simulating a "restart" (re-querying fresh from the DB, no in-memory state carried over) returns identical `queueTimeMs`/`activeTimeMs` — covers US3 Acceptance Scenarios 1–4
- [ ] T020 [P] [US3] Integration test in `tests/integration/designers/concurrentTimer.test.ts`: starting a timer on Work Item Y while the same designer has an open `ACTIVE` segment on Work Item X auto-closes X's segment before opening Y's; only one open `ACTIVE` segment exists for that designer at any time (FR-012, US3 Acceptance Scenario 5); starting/pausing a timer as a user who is not the Work Item's `assigneeId` throws `DomainDesignerError("NOT_ASSIGNEE")` (FR-013)
- [ ] T021 [US3] Extend `tests/contract/designers/designer-assignment.test.ts`: `getMyQueue`, `startTimer`, `pauseTimer`, `phaseDurations` match contracts/designer-assignment.md's shapes and Authorization table

### Implementation for User Story 3

- [ ] T022 [US3] Implement `getMyQueue(actor)` in `src/server/designers/queue.ts` per contracts/designer-assignment.md: no `authorize()` beyond authenticated actor; queries `WorkItem` where `assigneeId = actor.userId` and `state IN (ASSIGNED, IN_DESIGN, REWORK_REQUIRED)`, joins `order.customer`/`productType`; computes `isRework`, `hasOpenTimer`; sorts urgent-first then `assignedAt` ascending (data-model.md's `MyQueueRow` — `assignedAt` derived from the most recent `WorkItemTransition` landing in `ASSIGNED`/`REWORK_REQUIRED`, no new column) (depends on T001)
- [ ] T023 [US3] Implement `startTimer(actor, workItemId)` in `src/server/designers/timer.ts` per contracts/designer-assignment.md: `authorize(actor, "design.work")`; throws `DomainDesignerError("NOT_ASSIGNEE")`/`("NOT_TIMEABLE")` per guards; if another Work Item has an open `ACTIVE` segment for `actor.userId`, `closeOpenSegment` it first (FR-012); if `state !== "IN_DESIGN"`, `transitionWorkItem(tx, { to: "IN_DESIGN" })` (its own step 5 already closes the outgoing `QUEUE` segment — do NOT also call `closeOpenSegment` for `QUEUE` manually, research.md §2 addendum); `openSegment(tx, { workItemId, phase: "IN_DESIGN", kind: "ACTIVE", userId: actor.userId })`; `audit.record` (depends on T005, T006)
- [ ] T024 [US3] Implement `pauseTimer(actor, workItemId)` in `src/server/designers/timer.ts`: `authorize(actor, "design.work")`; throws `DomainDesignerError("NOT_ASSIGNEE")`; `closeOpenSegment(tx, { workItemId, kind: "ACTIVE" })` (no-op if nothing open, no state change per FR-010); `audit.record` (depends on T005, T006)
- [ ] T025 [US3] Implement `phaseDurations(actor, workItemId)` in `src/server/designers/timer.ts`: no `authorize()` beyond authenticated actor; `queueTimeMs` = `calculatePhaseDurationMs()` over `QUEUE` segments with `phase IN (ASSIGNED, REWORK_REQUIRED)` only (excludes the incidental `QUEUE` segment auto-opened for every other phase — data-model.md's `PhaseDurations` note); `activeTimeMs` = `calculatePhaseDurationMs()` over all `ACTIVE` segments; `totalPhaseDurationMs` = `null` until a `WorkItemTransition` lands in `DESIGN_COMPLETED`, else that row's `at` minus the most recent `ASSIGNED`/`REWORK_REQUIRED` transition's `at` (depends on T005)
- [ ] T026 [US3] Export `getMyQueue`, `startTimer`, `pauseTimer`, `phaseDurations` from `src/server/designers/index.ts` (depends on T022, T023, T024, T025)
- [ ] T027 [US3] Replace the placeholder `src/app/(shell)/my-queue/page.tsx` (002) with the real designer queue: rows per `MyQueueRow` (customer, product, due date, rework badge), urgent-first/oldest ordering, live elapsed-time display computed from `phaseDurations` at render time, inline `"use server"` Server Actions for start/pause calling `startTimer`/`pauseTimer` + `revalidatePath("/my-queue")` (depends on T026)
- [ ] T028 [US3] Add the Arabic keys this page and the assignment dialog need to `src/messages/ar.json`'s `ui` object (queue title/columns, rework badge label, start/pause/resume button labels, assignment dialog labels/columns — reuse `src/messages/ar.json`'s existing key-naming convention from 011's reception/order-detail keys)

**Checkpoint**: User Story 3 is fully functional and testable independently — combined with US1+US2, this is the P1 MVP.

---

## Phase 6: User Story 4 - Upload a design version and mark design complete (Priority: P2)

**Goal**: A designer attaches a versioned design file with a note, then marks the item design-complete, routing it to `WAITING_REVIEW` or `APPROVED` depending on `requiresReview` (FR-016–FR-018).

**Independent Test**: Upload a design version with a note to an `IN_DESIGN` Work Item, then mark it design-complete, and confirm the state becomes `WAITING_REVIEW` when `requiresReview` is true or `APPROVED` when false, with the uploaded version visible either way.

### Tests for User Story 4

- [ ] T029 [P] [US4] Integration test in `tests/integration/designers/uploadAndComplete.test.ts`: `uploadDesignVersion` on an `IN_DESIGN` Work Item creates a `DesignVersion` row with `version: 1` (and `version: 2` on a second upload, per the `@@unique([workItemId, version])` constraint from data-model.md), doesn't change `state`; `markDesignComplete` without any uploaded version throws `DomainDesignerError("NO_DESIGN_VERSION")`; with one uploaded, it closes any open `ACTIVE` segment and produces two `WorkItemTransition` rows (`IN_DESIGN → DESIGN_COMPLETED`, then `DESIGN_COMPLETED → WAITING_REVIEW` or `→ APPROVED` matching `requiresReview`) — covers US4 Acceptance Scenarios 1–4
- [ ] T030 [US4] Extend `tests/contract/designers/designer-assignment.test.ts`: `uploadDesignVersion`/`markDesignComplete` match contracts/designer-assignment.md's shapes and Authorization table (`design.work` + assignee-only)

### Implementation for User Story 4

- [ ] T031 [US4] Implement `uploadDesignVersion(actor, workItemId, file, note?)` in `src/server/designers/designVersions.ts` per contracts/designer-assignment.md: `authorize(actor, "design.work")`; throws `DomainDesignerError("NOT_ASSIGNEE")`/`("NOT_IN_DESIGN")`; streams `file.stream` to `storageAdapter.put(storageKey, file.stream)` outside the transaction; inside `db.$transaction`, computes `version = 1 + count(existing rows)`, `tx.designVersion.create(...)`, `audit.record(tx, { action: "designversion.uploaded", ... })` (depends on T001, T006)
- [ ] T032 [US4] Implement `markDesignComplete(actor, workItemId)` in `src/server/designers/designVersions.ts`: `authorize(actor, "design.work")`; throws `DomainDesignerError("NOT_ASSIGNEE")`/`("NOT_IN_DESIGN")`/`("NO_DESIGN_VERSION")`; `closeOpenSegment(tx, { kind: "ACTIVE" })`; `transitionWorkItem(tx, { to: "DESIGN_COMPLETED" })` then `transitionWorkItem(tx, { to: workItem.requiresReview ? "WAITING_REVIEW" : "APPROVED" })`, both in the same `tx` (research.md §5) (depends on T005, T006, T031)
- [ ] T033 [US4] Export `uploadDesignVersion`, `markDesignComplete` from `src/server/designers/index.ts` (depends on T031, T032)
- [ ] T034 [US4] Create `src/app/(shell)/design/[workItemId]/page.tsx` — the design workspace nav.ts's existing `"design"` entry currently has no page behind it: timer controls (reusing T027's start/pause actions, scoped to one Work Item), design-version upload form + history list, "Mark design complete" button (disabled until ≥1 version exists), inline Server Actions calling `uploadDesignVersion`/`markDesignComplete` + `revalidatePath` (depends on T026, T033)
- [ ] T035 [US4] Add the Arabic keys this page needs to `src/messages/ar.json` (upload form labels, version history labels, mark-complete button/disabled-state message)

**Checkpoint**: User Story 4 is fully functional and testable independently.

---

## Phase 7: User Story 5 - Continue a Work Item after rework is requested (Priority: P2)

**Goal**: A `REWORK_REQUIRED` Work Item reappears in its designer's queue with rejection details visible, and resuming its timer accumulates on top of prior recorded time rather than resetting (FR-019, FR-020).

**Independent Test**: Place a Work Item directly into `REWORK_REQUIRED` (simulating 013, not yet built), confirm it reappears in the original designer's queue with a rework badge and rejection details, and that resuming work re-opens an `ACTIVE` segment continuing the existing `PhaseTiming` history.

### Tests for User Story 5

- [ ] T036 [P] [US5] Integration test in `tests/integration/designers/rework.test.ts`: a Work Item forced into `REWORK_REQUIRED` (via a `WorkItemTransition` row with `rejectionCategory`/`reason`, matching how 013 will eventually produce this state) appears in `getMyQueue` for its designer with `isRework: true` and `rejectionDetails` populated from that transition row; `startTimer` on it transitions to `IN_DESIGN` and opens a new `ACTIVE` segment whose duration adds to (not replaces) `phaseDurations`' pre-existing `activeTimeMs` — covers US5 Acceptance Scenarios 1–2

### Implementation for User Story 5

- [ ] T037 [US5] Verify/extend `getMyQueue` (`src/server/designers/queue.ts`, T022) to populate `rejectionDetails` from the most recent `WorkItemTransition` landing in `REWORK_REQUIRED` for each `REWORK_REQUIRED` row (data-model.md's `MyQueueRow.rejectionDetails`) — T022 already queries per-row transitions for `assignedAt`; this extends that same query rather than adding a new one (depends on T022)
- [ ] T038 [US5] Confirm `startTimer` (`src/server/designers/timer.ts`, T023)'s `NOT_TIMEABLE` guard and `ALLOWED_EDGES`-driven `transitionWorkItem` call already accept `REWORK_REQUIRED → IN_DESIGN` with no code change needed (`REWORK_REQUIRED` is already in T023's timeable-state guard) — this task is verification via T036's test, not new implementation, per FR-020's "continues accumulating" requirement being satisfied automatically by `PhaseTiming`'s additive segment model (research.md §2)

**Checkpoint**: User Story 5 is fully functional and testable independently. All 5 user stories complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Round out the feature's read-side consumer contract and verify nothing else broke.

- [ ] T039 [P] Implement `getDesignerWorkload(actor)` in `src/server/designers/workload.ts` per contracts/designer-assignment.md: no `authorize()` beyond authenticated actor; same underlying active-count query as `getEligibleDesigners` (T011), whole-shop scope (not per-Work-Item); export from `src/server/designers/index.ts` (depends on T011)
- [ ] T040 [P] Document the `HEAD_DESIGNER` reassignment opt-in (adding `"workitem.assign_designer"` to that role's `permissions` array in `prisma/seed.ts`'s `ROLE_SEED_DATA`) as a code comment at that array, cross-referencing data-model.md's Seed data addition section — no default behavior change (Clarifications, 2026-09-23)
- [x] T041 Run `pnpm check` (lint + typecheck) across the new `src/server/designers/**` module and every edited file; fix any violation
- [ ] T042 Run the full `pnpm test` suite; confirm every pre-existing 001/002/011 test still passes unmodified and every new `tests/{unit,contract,integration}/designers/**` test passes once T002 unblocks the DB-dependent ones (unit tests T008 pass regardless of T002)
- [ ] T043 Manual quickstart QA — DB-dependent, blocked on T002 like 011's T052: walk through quickstart.md's Scenarios 1–7 end-to-end against a running dev server

---

## Dependencies & Execution Order

- **Setup (Phase 1)** blocks Foundational.
- **Foundational (Phase 2)** blocks every user story phase — nothing in Phase 3+ may start first.
- **User Stories (Phases 3-7)**: US1, US2, US3 are all P1; US2 (T017) directly depends on US1's `assignDesigner` skeleton (T012 — same function, second branch) and US2's UI (T018) depends on US1's dialog (T014), so implement US1 → US2 in order despite both being P1. US3 is independent of US1/US2's files (`queue.ts`/`timer.ts` vs `assignment.ts`) and could be built in parallel by a second engineer once Foundational is done. US4 depends on US3's timer plumbing (`closeOpenSegment` usage pattern) conceptually but not on its files — buildable independently once Foundational is done. US5 depends on US3's `getMyQueue` (T022) and `startTimer` (T023) already existing — it is almost entirely a verification phase, not new code.
- **Polish (Phase 8)** runs after every user story phase is complete.

## Parallel Execution Examples

Within Foundational (Phase 2): T005, T006, T007 touch different files and can run in parallel; T008 depends on T007.

Within US1 (Phase 3): T009 and T010 (different test files) can run in parallel; T011 and T012 both edit `assignment.ts` so must run sequentially (or split into two commits touching non-overlapping functions carefully) — treat as sequential in practice.

Across stories once Foundational is done: US1+US2 (`assignment.ts` + `orders/[orderId]/page.tsx`) and US3 (`queue.ts`, `timer.ts`, `my-queue/page.tsx`) touch disjoint file sets and can be built by two engineers in parallel; US4/US5 should follow US3 since both read `getMyQueue`/`startTimer`'s established shape.

## Implementation Strategy

**MVP first**: Phases 1–5 (Setup, Foundational, US1, US2, US3) deliver the P1 scope — assignment,
reassignment, and a working timer — independently testable and shippable before US4/US5. US4
(upload + mark-complete) and US5 (rework re-entry, mostly verification) are P2 increments layered
on top without touching US1–US3's files.
</content>
