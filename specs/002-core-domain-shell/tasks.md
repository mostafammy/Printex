---
description: "Task list for Core Domain & Shell feature implementation"
---

# Tasks: Core Domain & Shell (002-core-domain-shell)

**Input**: Design documents from `/specs/002-core-domain-shell/` (`plan.md`, `spec.md`, `data-model.md`, `research.md`, `contracts/`, `quickstart.md`)

**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `research.md`, `contracts/workflow.md`, `contracts/orders.md`, `contracts/storage.md`, `contracts/notifications.md`, `contracts/errors.md`

**Tests**: Required by specification (FR-015, SC-001, SC-002, SC-003, SC-004). All tests are placed under their corresponding user story phase and must be written to fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`; omitted for Setup, Foundational, and Polish)
- Exact file paths from `plan.md` are specified in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tool configuration, environment validation, and CI harness

- [ ] T001 Configure Prisma multi-file schema split by enabling `prismaSchemaFolder` preview feature in `prisma/schema/schema.prisma` with datasource (`provider = "postgresql"`) and generator, move existing Better Auth models as-is to `prisma/schema/identity.prisma`, and remove the sample `Post` model per research.md §1
- [ ] T002 [P] Install and configure Vitest and test runner in `vitest.config.ts` and `package.json`, configuring `DATABASE_URL_TEST` environment variable and test setup script per research.md §9
- [ ] T003 [P] Initialize shadcn/ui and configure Tailwind CSS 4 with logical-property utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`) in `components.json` and `src/styles/globals.css` per research.md §10
- [ ] T004 [P] Extend environment variable schema validation in `src/env.js` to define and validate `STORAGE_ROOT` (local filesystem directory for storage stub) and `DATABASE_URL_TEST` (PostgreSQL test database connection string) per contracts/storage.md and research.md §6, §9
- [ ] T005 [P] Scaffold GitHub Actions continuous integration workflow in `.github/workflows/ci.yml` running `pnpm check` (lint + typecheck) and `pnpm test` (Vitest with PostgreSQL service container) on pull requests to `main` per research.md §11 and spec SC-006

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure, database entities, allowed-edges table, and typed error model that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Define core domain models and enums in `prisma/schema/core.prisma` verbatim from `data-model.md`:
  - Enums:
    - `WorkItemState`: `NEW`, `ASSIGNED`, `IN_DESIGN`, `DESIGN_COMPLETED`, `WAITING_REVIEW`, `REWORK_REQUIRED`, `APPROVED`, `WAITING_PRICING`, `READY_FOR_PRODUCTION`, `IN_PRODUCTION`, `PRODUCTION_COMPLETED`, `READY_FOR_COLLECTION`, `DELIVERED`, `COMPLETED`, `CANCELLED`
    - `OrderChannel`: `WALK_IN`, `WHATSAPP`, `PHONE`, `RETURNING`, `DIRECT_TO_DESIGNER`
    - `OrderPriority`: `NORMAL`, `URGENT`
    - `OrderMode`: `GROUPED`, `SEPARATE`
    - `PhaseTimingKind`: `QUEUE`, `ACTIVE`
    - `RejectionCategory`: `DESIGN_ISSUE`, `DIMENSION_ISSUE`, `CUSTOMER_CHANGE`, `PRICING_ISSUE`, `ACCOUNTING_ISSUE`, `PRODUCTION_ISSUE`, `MISSING_INFORMATION`, `OTHER`
  - Models:
    - `Department`: `id` String (cuid) PK; `name` String unique; `isActive` Boolean default true; `createdAt` DateTime
    - `Customer`: `id` String (cuid) PK; `name` String; `isCashCustomer` Boolean default false (exactly one row true); `createdAt` DateTime; `orders` Order[] relation
    - `Order`: `id` String (cuid) PK; `number` Int unique (DB sequence, ever-increasing, no reset, no prefix); `customerId` String FK -> Customer; `channel` OrderChannel; `priority` OrderPriority; `mode` OrderMode; `createdById` String FK -> User; `createdAt` DateTime; `workItems` WorkItem[] relation (status is NOT a column)
    - `WorkItem`: `id` String (cuid) PK; `orderId` String FK -> Order; `productTypeId` String? (FK reference only); `departmentId` String? (FK -> Department, nullable until routed); `state` WorkItemState; `requiresDesign` Boolean default true; `requiresReview` Boolean default true; `assigneeId` String? (FK -> User); `createdAt` DateTime; `updatedAt` DateTime; `transitions` WorkItemTransition[] relation; `phaseTimings` PhaseTiming[] relation
    - `WorkItemTransition`: `id` String (cuid) PK; `workItemId` String FK -> WorkItem; `from` WorkItemState; `to` WorkItemState; `actorId` String FK -> User; `at` DateTime default now(); `reason` String? (nullable in schema, required by caller for REWORK_REQUIRED and CANCELLED); `rejectionCategory` RejectionCategory? (set only on edges landing in REWORK_REQUIRED); `meta` Json?
    - `PhaseTiming`: `id` String (cuid) PK; `workItemId` String FK -> WorkItem; `phase` WorkItemState; `userId` String? (FK -> User, null for QUEUE segments); `kind` PhaseTimingKind; `startedAt` DateTime; `endedAt` DateTime? (null while open)
    - `NotificationEvent`: `id` String (cuid) PK; `type` String; `entityType` String; `entityId` String; `recipientUserIds` String[]; `recipientRoles` String[]; `recipientDepartmentIds` String[]; `payload` Json?; `createdAt` DateTime default now(); `deliveredAt` DateTime? (null); `deliveryStatus` String? (null)
- [ ] T007 Apply database migrations and wire Prisma client singleton in `src/server/db.ts` to support the multi-file schema in `prisma/schema/`
- [ ] T008 [P] Implement the typed error model and action result helpers in `src/server/core/errors.ts` per contracts/errors.md defining `ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string; details?: unknown } }` where `ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_TRANSITION" | "GUARD_FAILED" | "VALIDATION"`
- [ ] T009 [P] Export all 15 `WorkItemState` values and union type in `src/server/core/workflow/states.ts` matching `prisma/schema/core.prisma`
- [ ] T010 [P] Implement the authoritative allowed-edges lookup table as code in `src/server/core/workflow/edges.ts` verbatim from `data-model.md`:
  - `NEW` -> `ASSIGNED` (default), `READY_FOR_PRODUCTION` (skip: `requiresDesign = false`), `CANCELLED`
  - `ASSIGNED` -> `IN_DESIGN`, `CANCELLED`
  - `IN_DESIGN` -> `DESIGN_COMPLETED`, `CANCELLED`
  - `DESIGN_COMPLETED` -> `WAITING_REVIEW` (default), `APPROVED` (skip: `requiresReview = false`), `CANCELLED`
  - `WAITING_REVIEW` -> `APPROVED`, `REWORK_REQUIRED` (requires `rejectionCategory`), `CANCELLED`
  - `REWORK_REQUIRED` -> `IN_DESIGN` (default landing), `ASSIGNED` (reassignment-driving category landing), `CANCELLED`
  - `APPROVED` -> `WAITING_PRICING`, `READY_FOR_PRODUCTION` (default open), `CANCELLED`
  - `WAITING_PRICING` -> `READY_FOR_PRODUCTION`, `CANCELLED`
  - `READY_FOR_PRODUCTION` -> `IN_PRODUCTION`, `CANCELLED`
  - `IN_PRODUCTION` -> `PRODUCTION_COMPLETED`, `CANCELLED`
  - `PRODUCTION_COMPLETED` -> `READY_FOR_COLLECTION`, `CANCELLED`
  - `READY_FOR_COLLECTION` -> `DELIVERED`, `CANCELLED`
  - `DELIVERED` -> `COMPLETED`
  - Terminal states: `COMPLETED`, `CANCELLED` (no outgoing edges)
  - Non-terminal: all states except `DELIVERED`, `COMPLETED`, `CANCELLED` can transition directly to `CANCELLED`
  - All other transitions forbidden and MUST evaluate to `INVALID_TRANSITION`
- [ ] T011 [P] Create test data builders for Customer (including singleton Cash Customer), Order, and WorkItem in `tests/factories/index.ts` to generate minimal valid relational graphs for unit and integration testing
- [ ] T012 [P] Implement auth wrapper and actor type stubs (`Actor = { id: string; roles: string[]; departmentIds: string[] }`) in `src/server/auth/index.ts` defining `getActor()` call signature per contracts/workflow.md

**Checkpoint**: Foundation ready - all core models, edges, types, errors, and test factories in place. User story implementation can now begin.

---

## Phase 3: User Story 1 - Every job's status is always trustworthy (Priority: P1) 🎯 MVP

**Goal**: An Order's status is always trustworthy because it is computed on read from the states of its Work Items via a pure bucket calculation function (`deriveOrderStatus`), with no stored or manually editable status column on the `Order` entity.

**Independent Test**: Provide Orders with Work Items in varying state combinations (all completed, all delivered, all cancelled, all new/assigned, in-production, and mixed) to `deriveOrderStatus` and verify the returned bucket exactly matches the specification with zero database writes.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US1] Unit test for `deriveOrderStatus` covering all six buckets (`NOT_STARTED`, `IN_PRODUCTION`, `PARTIALLY_READY`, `DELIVERED`, `COMPLETED`, `CANCELLED`) and boundary edge cases (all cancelled, all completed, mixed delivered/in-production, all new/assigned) per SC-003 and data-model.md in `tests/unit/deriveOrderStatus.test.ts`

### Implementation for User Story 1

- [ ] T014 [US1] Implement pure bucket function `deriveOrderStatus(workItems: Pick<WorkItem, "state">[]): OrderStatusBucket` in `src/server/core/orders/deriveOrderStatus.ts` enforcing the exact evaluation hierarchy from data-model.md and contracts/orders.md
- [ ] T015 [US1] Expose Order status derivation and query helpers in `src/server/core/orders/index.ts` ensuring `Order` reads compute status dynamically and that no write path or database column exists for Order status (FR-008, constitution I)

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - A job's history can never be silently rewritten (Priority: P1)

**Goal**: A Work Item's history is tamper-proof and append-only: state mutations occur exclusively through `transitionWorkItem()`, which validates transitions against the allowed-edges table, executes registered guards, writes `WorkItemTransition`, creates an audit event, and logs a `NotificationEvent` outbox record inside one atomic transaction with complete rollback on any failure. Elapsed phase timings are tracked via timestamped segments.

**Independent Test**: Execute legal and illegal transitions against a PostgreSQL test database; verify 100% of illegal transitions fail (SC-001), 100% of legal transitions create atomic transition and audit records (SC-002), audit write failures roll back state change completely, and phase timing durations survive simulated server restarts (SC-004).

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T016 [P] [US2] Table-driven unit test verifying the 15×15 state matrix against `src/server/core/workflow/edges.ts` asserting that all allowed transitions succeed and all forbidden pairs raise `INVALID_TRANSITION` per spec FR-003, FR-003a, and SC-001 in `tests/unit/workflow-edges.test.ts`
- [ ] T017 [P] [US2] Integration test for `transitionWorkItem` verifying atomic commit of `WorkItem.state` update, `WorkItemTransition` record creation, audit event recording, and `NotificationEvent` outbox insertion in `tests/integration/transitionWorkItem.test.ts` (SC-002, FR-006, FR-018)
- [ ] T018 [P] [US2] Integration test for audit-rollback atomicity verifying that if audit recording or notification write fails, the entire transaction rolls back and `WorkItem.state` remains unchanged per spec SC-002 and US2 Acceptance Scenario 3 in `tests/integration/transition-rollback.test.ts`
- [ ] T019 [P] [US2] Unit test for `PhaseTiming` segment-duration calculation verifying active and queue segments summation and duration calculation across pauses and simulated server restart within 1 second per spec SC-004 and FR-009 in `tests/unit/phaseTiming.test.ts`

### Implementation for User Story 2

- [ ] T020 [P] [US2] Implement the in-memory guard registry `registerGuard(match, guard)` in `src/server/core/workflow/guards.ts` supporting `{ from?, to }` filtering, registration-order execution, and structured `{ ok: true } | { ok: false, code, message }` rejection handling per contracts/workflow.md (FR-007)
- [ ] T021 [P] [US2] Implement transactional notification outbox recorder `notify(tx, event)` in `src/server/core/notifications/notify.ts` inserting rows into `NotificationEvent` table using the caller's Prisma transaction client per contracts/notifications.md (FR-011)
- [ ] T022 [US2] Implement centralized state mutator `transitionWorkItem(tx, input)` in `src/server/core/workflow/transition.ts` as the sole write path for `WorkItem.state`, enforcing allowed edges, executing matching registered guards, validating caller reason on `REWORK_REQUIRED` and `CANCELLED`, validating `rejectionCategory` on `REWORK_REQUIRED`, inserting `WorkItemTransition`, invoking `audit.record`, and calling `notify()` within `tx` (contracts/workflow.md, FR-003b, FR-005, FR-006, FR-018)
- [ ] T023 [US2] Implement phase timing tracking functions in `src/server/core/workflow/timing.ts` to manage `PhaseTiming` segments (closing open segment on pause/state change, starting new segment on resume/entry) and computing total phase duration via `sum(endedAt - startedAt) + (open ? now - startedAt : 0)` (FR-009, SC-004)

**Checkpoint**: At this point, User Stories 1 AND 2 are both fully functional and independently testable.

---

## Phase 5: User Story 3 - Staff can navigate the system in Arabic from day one (Priority: P2)

**Goal**: Staff can navigate the system in an Arabic-first, right-to-left layout from day one, with navigation menus filtered to their assigned roles/permissions, zero physical directional spacing classes, and a placeholder "My queue" landing page.

**Independent Test**: Load the application shell as users with varying role scopes; verify document rendered with `dir="rtl" lang="ar"`, IBM Plex Sans Arabic font is active, sidebar links match user permissions, and zero `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` classes exist in the rendered shell.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T024 [P] [US3] Component and layout test in `tests/unit/shell-nav.test.ts` verifying `dir="rtl" lang="ar"` document configuration, permission-filtered sidebar navigation rendering for different actor roles, and presence of Arabic strings (US3 Acceptance Scenarios 1 & 2)

### Implementation for User Story 3

- [ ] T025 [P] [US3] Create Arabic dictionary file in `messages/ar.json` containing Arabic translations for sidebar navigation labels, role displays, status badges, and placeholder strings per research.md §10
- [ ] T026 [US3] Configure root HTML layout in `src/app/layout.tsx` setting `<html dir="rtl" lang="ar">`, loading Google font IBM Plex Sans Arabic, applying Arabic typography styles, and wrapping children in shadcn/ui provider (FR-013, research.md §10)
- [ ] T027 [US3] Implement application shell layout with responsive sidebar in `src/app/(shell)/layout.tsx` filtering navigation entries based on `getActor()` roles/permissions and utilizing Tailwind logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) exclusively (FR-013, SC-007)
- [ ] T028 [US3] Implement placeholder landing page "My queue" ("طابور أعمالي") in `src/app/(shell)/my-queue/page.tsx` reachable from the shell sidebar navigation (FR-014)

**Checkpoint**: At this point, User Stories 1, 2, and 3 are functional and verifiable.

---

## Phase 6: User Story 4 - Two teams can build in parallel without breaking each other (Priority: P2)

**Goal**: Provide frozen, documented, and test-verified contracts for `transitionWorkItem`, `registerGuard`, `deriveOrderStatus`, `StorageAdapter`, `notify`, and typed `ActionResult<T>` errors so Track A and Track B engineers can develop in parallel without reading or modifying core module internals.

**Independent Test**: Implement an external guard (e.g., pricing delivery gate mock) and an alternative storage adapter against the published contracts and verify they integrate cleanly with zero edits to `src/server/core/` files (SC-005).

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T029 [P] [US4] Contract integration test in `tests/contract/storageAdapter.test.ts` verifying `StorageAdapter` interface compliance (`put`, `get`, `exists`, and refusal to overwrite existing keys) against `LocalDiskStorageAdapter` under a temporary `STORAGE_ROOT` (contracts/storage.md, SC-005)
- [ ] T030 [P] [US4] Contract extension test in `tests/contract/externalGuard.test.ts` verifying that an external mock guard (e.g. 051 delivery pricing gate) registers via `registerGuard` and blocks `transitionWorkItem` with `GUARD_FAILED` without modifying core domain code (contracts/workflow.md, SC-005)

### Implementation for User Story 4

- [ ] T031 [P] [US4] Define `StorageAdapter` interface (`put(key, body): Promise<{ size, sha256 }>`, `get(key): Promise<Readable>`, `exists(key): Promise<boolean>`) in `src/server/core/storage/adapter.ts` with opaque string keys and refusal to overwrite in place per contracts/storage.md (FR-010, constitution IV)
- [ ] T032 [US4] Implement dev-only `LocalDiskStorageAdapter` in `src/server/core/storage/local-disk.ts` rooted at `env.STORAGE_ROOT`, ensuring file reads/writes are stream-based and throwing an explicit error if a key already exists (contracts/storage.md, research.md §6)
- [ ] T033 [US4] Export unified public API surface in `src/server/core/index.ts` re-exporting workflow transition functions, guard registry, order status derivation, storage adapter types, notification outbox recorder, and typed error models for downstream consumers (FR-017, contracts/*.md)

**Checkpoint**: All 4 user stories are fully implemented and verified against their contracts.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting quality gates, development seed script, lint rule enforcement, and end-to-end quickstart validation

- [ ] T034 Implement development database seed script in `prisma/seed.ts` populating an admin user, default production departments (`Digital`, `Banner`, `Outdoor`, `Laser`, `External`), the singleton Cash Customer (`isCashCustomer = true`), and initial sample Orders and WorkItems for local development (FR-016, quickstart.md §1)
- [ ] T035 [P] Add and configure ESLint rule in `.eslintrc.cjs` or `eslint.config.mjs` to disallow hard-coded physical spacing classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`) and enforce Tailwind logical properties across all UI components (SC-007, research.md §10)
- [ ] T036 Execute full quickstart validation procedure per `quickstart.md` (database seed, `pnpm check`, `pnpm test`, transition smoke test in transaction, order status derivation check, Arabic RTL shell inspection, and CI workflow run)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - executes immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Phase 2 completion.
  - **User Story 1 (P1)**: Starts immediately after Foundational. Delivers MVP!
  - **User Story 2 (P1)**: Starts after Foundational. Integrates state transitions with models and audit/outbox.
  - **User Story 3 (P2)**: Starts after Foundational. Implements Arabic RTL app shell and navigation.
  - **User Story 4 (P2)**: Starts after Foundational. Finalizes storage adapter, guard contract tests, and frozen module export.
- **Polish (Phase 7)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Operates strictly on `workItems: Pick<WorkItem, "state">[]`. No dependency on other user stories.
- **User Story 2 (P1)**: Operates on `WorkItem`, `WorkItemTransition`, `NotificationEvent`, and `PhaseTiming`. Uses `edges.ts` and `errors.ts` from Phase 2. Can be worked on in parallel with US1.
- **User Story 3 (P2)**: Depends on `src/server/auth/` actor stubs from Phase 2 for permission filtering. Independent of workflow execution logic.
- **User Story 4 (P2)**: Validates external contract stability for `transitionWorkItem`, `registerGuard`, `StorageAdapter`, and `notify`. Best verified after US2 implementations exist.

### Within Each User Story

- Test tasks (`tests/`) MUST be written and fail before implementation files are created.
- Types and interfaces before concrete implementations.
- Concrete services before module index exports.

### Parallel Opportunities

- In Phase 1: `T002`, `T003`, `T004`, and `T005` can run in parallel after `T001`.
- In Phase 2: `T008`, `T009`, `T010`, `T011`, and `T012` can run in parallel once `T006` and `T007` complete.
- In User Story 1: `T013` (tests) can run in parallel with foundational tasks.
- In User Story 2: `T016`, `T017`, `T018`, `T019` (tests) can all run in parallel; `T020` and `T021` can run in parallel.
- In User Story 3: `T024` (tests) and `T025` can run in parallel.
- In User Story 4: `T029`, `T030` (tests), and `T031` can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Launch test task first (ensure failure):
Task: T013 [P] [US1] Unit test for deriveOrderStatus in tests/unit/deriveOrderStatus.test.ts

# Launch implementation once test fails:
Task: T014 [US1] Implement deriveOrderStatus in src/server/core/orders/deriveOrderStatus.ts
Task: T015 [US1] Expose Order status helpers in src/server/core/orders/index.ts
```

---

## Parallel Example: User Story 2

```bash
# Launch all test tasks for User Story 2 concurrently:
Task: T016 [P] [US2] Table-driven unit test in tests/unit/workflow-edges.test.ts
Task: T017 [P] [US2] Integration test in tests/integration/transitionWorkItem.test.ts
Task: T018 [P] [US2] Rollback integration test in tests/integration/transition-rollback.test.ts
Task: T019 [P] [US2] Phase timing unit test in tests/unit/phaseTiming.test.ts

# Concurrently implement independent supporting services:
Task: T020 [P] [US2] Implement guard registry in src/server/core/workflow/guards.ts
Task: T021 [P] [US2] Implement notify in src/server/core/notifications/notify.ts
```

---

## Parallel Example: User Story 3

```bash
# Launch test task and Arabic translation dictionary in parallel:
Task: T024 [P] [US3] Shell nav unit test in tests/unit/shell-nav.test.ts
Task: T025 [P] [US3] Arabic translations dictionary in messages/ar.json

# Implement layout and pages:
Task: T026 [US3] Root RTL layout in src/app/layout.tsx
Task: T027 [US3] Shell layout in src/app/(shell)/layout.tsx
Task: T028 [US3] My queue page in src/app/(shell)/my-queue/page.tsx
```

---

## Parallel Example: User Story 4

```bash
# Launch contract tests and interface definition in parallel:
Task: T029 [P] [US4] Storage adapter contract test in tests/contract/storageAdapter.test.ts
Task: T030 [P] [US4] External guard test in tests/contract/externalGuard.test.ts
Task: T031 [P] [US4] Storage adapter interface in src/server/core/storage/adapter.ts

# Implement local adapter and contract index:
Task: T032 [US4] Local disk adapter in src/server/core/storage/local-disk.ts
Task: T033 [US4] Frozen contract index in src/server/core/index.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`T001` - `T005`)
2. Complete Phase 2: Foundational (`T006` - `T012`) — **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (`T013` - `T015`)
4. **STOP and VALIDATE**: Run `pnpm test tests/unit/deriveOrderStatus.test.ts` to verify the 6-bucket Order status derivation rule works independently with zero database write paths. Demo MVP!

### Incremental Delivery

1. **Setup + Foundational**: Core models, allowed edges, and error structure ready.
2. **User Story 1 (P1)**: Delivers pure, trustworthy derived Order status (MVP).
3. **User Story 2 (P1)**: Delivers single-mutator `transitionWorkItem`, guard registry, audit rollback guarantee, and phase timing segments.
4. **User Story 3 (P2)**: Delivers Arabic RTL layout, IBM Plex Sans Arabic typography, and role-filtered navigation shell.
5. **User Story 4 (P2)**: Freezes contracts, publishes `StorageAdapter` and `notify`, enabling Track A and Track B parallel tracks.
6. **Polish (Phase 7)**: Seeds database, enforces RTL lint rules, and confirms CI pipeline green on `main`.

---

## Notes

- `[P]` tasks = different files with no dependencies on incomplete tasks.
- `[Story]` label (`[US1]`, `[US2]`, `[US3]`, `[US4]`) maps every user-story task to its acceptance scenarios in `spec.md`.
- All tests must be executed with a dedicated PostgreSQL test database (`DATABASE_URL_TEST`).
- No task may alter `WorkItem.state` directly; all state changes must pass through `transitionWorkItem()`.
- Commit after each task or logical group to maintain a clean, bisectable git history.
