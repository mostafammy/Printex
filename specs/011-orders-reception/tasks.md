---

description: "Task list template for feature implementation"
---

# Tasks: Orders & Reception

**Input**: Design documents from `/specs/011-orders-reception/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/order-entry.md](./contracts/order-entry.md), [contracts/product-types.md](./contracts/product-types.md)

**Tests**: Included — plan.md's Project Structure enumerates specific test files under `tests/unit`, `tests/contract`, `tests/integration`, so this list generates the matching test tasks alongside each story's implementation.

**Organization**: Tasks are grouped by user story (spec.md's 8 stories, priorities P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to spec.md's US1–US8
- Every task names its exact file path

## Path Conventions

Single Next.js project (plan.md Project Structure): `src/server/orders/**`, `src/app/(shell)/**`, `prisma/schema/core.prisma`, `prisma/seed.ts`, `tests/{unit,contract,integration}/orders/**`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the schema diff and module scaffolding every story builds on.

- [ ] T001 Apply the schema diff in `prisma/schema/core.prisma` per data-model.md: add `enum WorkItemDimensionUnit { MM CM M IN }`; add `model ProductType` (id, `name String @unique`, `defaultDepartmentId String?` + relation, `defaultRequiresDesign Boolean @default(true)`, `defaultRequiresReview Boolean @default(true)`, `pricingModeHint String?`, `isActive Boolean @default(true)`, `createdAt DateTime @default(now())`, `workItems WorkItem[]`); add `Department.productTypes ProductType[]` back-relation; change `Order.number` to `Int @unique @default(autoincrement())`; add `Order.dueDate DateTime?`; add `WorkItem` fields `description String?`, `quantity Int?`, `widthValue Decimal? @db.Decimal(10,2)`, `heightValue Decimal? @db.Decimal(10,2)`, `dimensionUnit WorkItemDimensionUnit?`, `material String?`, `finishNotes String?`, `dueDate DateTime?`, and turn `WorkItem.productTypeId`/`productType` into a real relation to `ProductType`
- [ ] T002 Run `pnpm exec prisma db push` then `pnpm exec prisma db seed` to apply T001's schema and re-seed, per research.md §1's migration note (existing seeded `Order.number` values are pre-production and get truncated by re-seeding, not hand-migrated)
- [ ] T003 [P] Add a `no-restricted-imports` rule for `src/server/orders/**` to `eslint.config.js`, identical in shape to the existing `src/server/core/**`/`src/server/auth/**` rules (research.md §6): only `~/server/orders` (the barrel) is importable from outside the module; `tests/**` exempted
- [ ] T004 [P] Create the barrel `src/server/orders/index.ts` with no exports yet (placeholder `export {}` — populated incrementally as each story's functions land)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure functions and error types every user story's implementation calls into.

**⚠️ CRITICAL**: No user story implementation task may start until this phase is complete.

- [ ] T005 [P] Implement `DomainOrderError` in `src/server/orders/errors.ts` — a local error class carrying `code: "ORDER_FINISHED" | "PAST_EDIT_WINDOW" | "TERMINAL_WORK_ITEM" | "DUPLICATE_NAME"` and a human-readable message (plan.md §5.3)
- [ ] T006 [P] Implement `isOrderComplete()` in `src/server/orders/completeness.ts` exactly per data-model.md: pure function taking `{ workItems: ReadonlyArray<{ productTypeId, quantity, widthValue, heightValue, departmentId }> }`, returns `true` only when every Work Item has all five fields non-null (vacuously `true` on an empty array)
- [ ] T007 [P] Implement `isOrderFinished()` in `src/server/orders/completeness.ts` exactly per data-model.md: pure function taking `ReadonlyArray<{ state: WorkItemState }>`, returns `true` only when every item's state is `"DELIVERED" | "COMPLETED" | "CANCELLED"`
- [ ] T008 [P] Add `PRE_DESIGN_EDITABLE_STATES: ReadonlySet<WorkItemState> = new Set(["NEW", "ASSIGNED"])` to `src/server/orders/completeness.ts` (data-model.md)
- [ ] T009 [P] Unit tests for `isOrderComplete`, `isOrderFinished`, and `PRE_DESIGN_EDITABLE_STATES` membership in `tests/unit/orders/completeness.test.ts` — cover: all-fields-set → complete; one field null → incomplete; empty array → complete (vacuous); all-terminal → finished; one non-terminal → not finished; `NEW`/`ASSIGNED` in the set, every other `WorkItemState` not
- [ ] T010 Add `seedProductTypes()` to `prisma/seed.ts`, called from the existing seed `main()` and upserted by `name` like `seedDepartments()` already is: Roll-up Banner, Business Cards, Flyer/Poster, Vinyl Sticker, Outdoor Sign, Laser-cut Sign, each mapped to one of the five existing seeded departments (Digital, Banner, Outdoor, Laser, External; Business Cards/Flyer default to Digital), `defaultRequiresDesign: true` / `defaultRequiresReview: true` for all except Business Cards which sets `defaultRequiresReview: false` (data-model.md Seed data addition)

**Checkpoint**: Foundation ready — every user story phase below may now start.

---

## Phase 3: User Story 1 - Quick Create a walk-in or phone request (Priority: P1) 🎯 MVP

**Goal**: A reception user logs a request as an Order + one Work Item in three or fewer inputs (FR-001, FR-001a), flagged incomplete (FR-002).

**Independent Test**: Open Quick Create, enter only a customer, a one-line description, and a priority, save, and confirm an Order + one Work Item exist, flagged incomplete, with an audit event recorded.

### Tests for User Story 1

- [ ] T011 [P] [US1] Integration test in `tests/integration/orders/quickCreate.test.ts`: calling `quickCreateOrder` creates one `Order` (with an autoincremented `number`) and one `WorkItem` in state `NEW`; asserts two `audit.record` calls (`order.created`, `workitem.created`); asserts `isOrderComplete()` on the result is `false` (description-only Work Item has every completeness field null)

### Implementation for User Story 1

- [ ] T012 [US1] Implement `quickCreateOrder(actor, input)` in `src/server/orders/create.ts` per contracts/order-entry.md: Zod-validate `input` (`description` non-empty after trim, `customerId` non-empty string, `priority`/`channel` valid enum members); `db.$transaction` creating the `Order` (`mode: "SEPARATE"`, `number` omitted) then the `WorkItem` (`state: "NEW"`, `requiresDesign: true`, `requiresReview: true`, the typed `description`); two `audit.record` calls as specified; returns `{ orderId, orderNumber, workItemId }` (depends on T001, T005)
- [ ] T013 [US1] Export `quickCreateOrder` from `src/server/orders/index.ts`
- [ ] T014 [US1] Build `src/app/(shell)/reception/quick-create/page.tsx` — Server Component + inline `"use server"` Server Action, mirroring `src/app/(shell)/admin/departments/page.tsx`'s pattern: customer picker (Cash Customer fallback per Acceptance Scenario 2), one-line description input, priority select (NORMAL/URGENT), channel select, `formStr()` reused for all `FormData` narrowing, calls `quickCreateOrder`, redirects to the new order on success; every control keyboard-reachable with no mouse-only interaction (FR-001a, SC-006) (depends on T012)

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Build a full multi-item order (Priority: P1)

**Goal**: Capture several distinct Work Items under one order, each independently routed (FR-003, FR-003a, FR-005).

**Independent Test**: Create one order with four Work Items, each set to a different target department, and confirm all four appear correctly routed and independently traceable on the order detail page.

### Tests for User Story 2

- [ ] T015 [P] [US2] Integration test in `tests/integration/orders/createOrder.test.ts`: `createOrder` with 4 Work Items across 4 different `departmentId`s creates one `Order` and 4 `WorkItem` rows, each with its own `audit.record("workitem.created")` call; asserts `mode`/`dueDate` land on the `Order` row and a per-item `dueDate` overrides the order-level default when set (FR-003a)

### Implementation for User Story 2

- [ ] T016 [US2] Implement `createOrder(actor, input)` in `src/server/orders/create.ts` per contracts/order-entry.md: Zod-validate `input.workItems` as `.min(1)`; per-item schema enforcing `quantity: number` (`Zod .int().positive()`), `widthValue`/`heightValue: number` (`Zod .positive()`), `dimensionUnit` a valid `WorkItemDimensionUnit`; `db.$transaction` creates the `Order` then each `WorkItem` in array order (`state: "NEW"`), with one `audit.record("order.created")` and one `audit.record("workitem.created")` per item (not batched); returns `{ orderId, orderNumber, workItemIds }` (depends on T001, T005, T012 — shares `create.ts`)
- [ ] T017 [US2] Export `createOrder` from `src/server/orders/index.ts`
- [ ] T018 [P] [US2] Implement `listActiveProductTypes(actor)` in `src/server/orders/productTypes.ts` — `tx.productType.findMany({ where: { isActive: true } })`, no `authorize` restriction beyond the caller already holding `order.create` (read-only helper for populating pickers; contracts/product-types.md's deactivation note: deactivated types never appear here)
- [ ] T019 [US2] Build `src/app/(shell)/reception/new/page.tsx` — Server Component + inline Server Action: customer picker, order-level due date input (FR-003a), grouped/separate mode toggle (FR-005), repeatable Work Item rows (product type picker sourced from `listActiveProductTypes`, selecting a product type pre-fills that row's department/requiresDesign/requiresReview from the `ProductType`'s current defaults per contracts/product-types.md's note, quantity, width, height, unit select, material, finish notes, requires-design/requires-review checkboxes, optional department override, optional per-item due date), a labeled placeholder slot reading "Files: available once 050 ships" per research.md §3 (no `<input type="file">` wired), calls `createOrder` on submit, redirects to the new order (depends on T016, T018)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Reception queue: see what needs attention (Priority: P1)

**Goal**: Reception sees new/unassigned/urgent/incomplete orders at a glance, correctly sorted (FR-007a, FR-008, FR-008a).

**Independent Test**: Create a mix of orders (urgent, normal, incomplete, various creation order) and confirm the queue sorts urgent-first then oldest-first and flags incomplete ones, with no manual refresh needed.

### Tests for User Story 3

- [ ] T020 [P] [US3] Integration test in `tests/integration/orders/queue.test.ts`: seed orders with mixed priorities/creation times/completeness; asserts `listReceptionQueue` returns urgent orders first, then the rest oldest-first (FR-007a, FR-008); asserts an order with any Work Item missing a completeness field per `isOrderComplete()` is flagged incomplete; asserts the queue still returns correctly when no delayed-Work-Item signal is supplied (FR-008a — 053 optional)

### Implementation for User Story 3

- [ ] T021 [US3] Implement `listReceptionQueue(actor)` in `src/server/orders/search.ts`: `authorize(actor, "order.create")`; query orders with their Work Items' completeness-relevant fields and states; sort `priority === "URGENT"` first, then `createdAt` ascending within each priority bucket (FR-008); map each row through `isOrderComplete()` for its incomplete flag and through `deriveOrderStatus` (from `~/server/core`) for its derived status; accept an optional `getDelayedWorkItems` (053) result to merge a per-row `delayed` flag when present, defaulting to `false`/absent when 053 hasn't shipped (FR-008a) (depends on T006)
- [ ] T022 [US3] Export `listReceptionQueue` from `src/server/orders/index.ts`
- [ ] T023 [US3] Build `src/app/(shell)/reception/page.tsx` — Server Component rendering `listReceptionQueue`'s results: urgent badge, incomplete badge with the list of missing fields, derived status badge, links to each order's detail page and to Quick Create / full order form (depends on T021)

**Checkpoint**: All three P1 stories (US1, US2, US3) are independently functional — this is the MVP.

---

## Phase 6: User Story 4 - Order detail page with full timeline (Priority: P2)

**Goal**: Anyone can answer "where is this order?" from one page (FR-009, FR-009a).

**Independent Test**: Create an order, drive one Work Item through several transitions and a cancellation, open the detail page, confirm every transition appears with actor, timestamp, and reason.

### Tests for User Story 4

- [ ] T024 [P] [US4] Integration test in `tests/integration/orders/orderDetail.test.ts`: after several `transitionWorkItem` calls including one `CANCELLED`, `getOrderDetail` returns a chronologically-ordered timeline with actor/timestamp/reason per entry, and nothing from history is omitted (FR-009, Acceptance Scenario 3)

### Implementation for User Story 4

- [ ] T025 [US4] Implement `getOrderDetail(actor, orderId)` in `src/server/orders/search.ts`: fetch the `Order` with its `Customer`, all `WorkItem`s (each with its `WorkItemTransition[]` from 002), flatten and sort every transition across every Work Item into one chronological timeline entry list `{ workItemId, from, to, actorId, at, reason? }`; compute the order's derived status via `deriveOrderStatus` (~/server/core); return `{ order, workItems, timeline, status, isComplete: isOrderComplete(...) }` (depends on T006)
- [ ] T026 [US4] Export `getOrderDetail` from `src/server/orders/index.ts`
- [ ] T027 [US4] Build `src/app/(shell)/orders/[orderId]/page.tsx` — Server Component rendering `getOrderDetail`'s result: header (customer, channel, priority, derived status), one card per Work Item with a state badge, the chronological timeline (actor, timestamp, reason where applicable), and clearly-labeled placeholder sections for designer assignment / pricing / payments / files / messages (FR-009a) rather than omitting or breaking (depends on T025)
- [ ] T028 [US4] On the same page, show Quick-Create provenance ("Created via Quick Create") and the list of fields still missing per `isOrderComplete()` when the order is incomplete (US1 Acceptance Scenario 4, FR-002) (depends on T027)

**Checkpoint**: US1–US4 all independently functional.

---

## Phase 7: User Story 5 - Find an order fast (Priority: P2)

**Goal**: Search by exact order number, or by customer phone/name partial match (FR-010).

**Independent Test**: Create a few orders with distinct numbers, customer names, and phone numbers; search by each and confirm the right order is found every time.

### Tests for User Story 5

- [ ] T029 [P] [US5] Integration test in `tests/integration/orders/search.test.ts`: exact `orderNumber` match returns exactly that order; partial `customerName` (case-insensitive) returns all matches; `phone` search is exercised only if `Customer.phone` exists in the test schema, otherwise asserts the query still succeeds without that clause (research.md §5's guard)

### Implementation for User Story 5

- [ ] T030 [US5] Implement `searchOrders(actor, query)` in `src/server/orders/search.ts` per contracts/order-entry.md: `authorize(actor, "order.create")`; single Prisma query with `OR` branches (exact `number`, `customer.name` `contains`/`insensitive`, `customer.phone` `contains` guarded to only apply when that field exists on `Customer`); includes `workItems: { select: { state: true } }` for `deriveOrderStatus` without N+1; maps to `OrderSearchResult[]` (depends on T001)
- [ ] T031 [US5] Export `searchOrders` from `src/server/orders/index.ts`
- [ ] T032 [US5] Build `src/app/(shell)/reception/search/page.tsx` — single search input dispatching to `searchOrders`, results list linking to each order's detail page (depends on T030)

**Checkpoint**: US1–US5 all independently functional.

---

## Phase 8: User Story 6 - Cancel an order or a Work Item (Priority: P2)

**Goal**: Cancel a Work Item or an entire order with a required reason, fully audited, never deleted (FR-011, FR-011a).

**Independent Test**: Cancel a Work Item with a reason; confirm its state becomes `CANCELLED`, the reason and actor are recorded, the order's derived status reflects it, and every other Work Item on the order is unaffected.

### Tests for User Story 6

- [ ] T033 [P] [US6] Integration test in `tests/integration/orders/cancelWorkItem.test.ts`: cancelling a non-terminal Work Item without a `reason` is rejected before any write; cancelling with a reason transitions it to `CANCELLED` via `transitionWorkItem` with exactly one audit entry (no duplicate); cancelling an already-`DELIVERED`/`COMPLETED`/`CANCELLED` item is refused (FR-011)
- [ ] T034 [P] [US6] Integration test in `tests/integration/orders/cancelOrder.test.ts`: cancelling an order with a mix of terminal and non-terminal Work Items transitions only the non-terminal ones to `CANCELLED`, each with its own audit entry, leaving already-terminal items untouched (FR-011a)

### Implementation for User Story 6

- [ ] T035 [US6] Implement `cancelWorkItem(actor, workItemId, reason)` in `src/server/orders/cancelOrder.ts` per contracts/order-entry.md: `authorize(actor, "order.cancel")`; Zod-validate `reason` non-empty after trim; call `transitionWorkItem` (from `~/server/core`) with `to: "CANCELLED"`; surface the returned `Result`'s error code on failure without wrapping it in `DomainOrderError`; does not call `audit.record` itself (depends on T001, T005)
- [ ] T036 [US6] Implement `cancelOrder(actor, orderId, reason)` in `src/server/orders/cancelOrder.ts` per contracts/order-entry.md: `authorize(actor, "order.cancel")`; fetch all Work Items, filter to non-terminal, call `transitionWorkItem` on each in order, collecting successful ids and skipping (not throwing on) any mid-loop `INVALID_TRANSITION`; returns `{ cancelledWorkItemIds }` (depends on T035)
- [ ] T037 [US6] Export `cancelWorkItem` and `cancelOrder` from `src/server/orders/index.ts`
- [ ] T038 [US6] Add "Cancel Work Item" (per card) and "Cancel Order" actions with a required-reason prompt to `src/app/(shell)/orders/[orderId]/page.tsx`, refreshing the page's data via `revalidatePath` after either action (depends on T027, T035, T036)

**Checkpoint**: US1–US6 all independently functional.

---

## Phase 9: User Story 7 - Add a Work Item to an order already in progress (Priority: P2)

**Goal**: Append a new Work Item to an existing order at any time before it's fully finished (FR-011b).

**Independent Test**: Take an order with one Work Item already past `NEW` (e.g. `IN_DESIGN`), add a second Work Item to that same order, confirm both appear on the same detail page with fully independent states and histories.

### Tests for User Story 7

- [ ] T039 [P] [US7] Integration test in `tests/integration/orders/addWorkItem.test.ts`: appending succeeds while the order has any non-`DELIVERED`/`COMPLETED`/`CANCELLED` Work Item, and the new item starts at `NEW` independent of siblings' states; appending is refused with `DomainOrderError("ORDER_FINISHED")` once every Work Item is terminal (FR-011b)

### Implementation for User Story 7

- [ ] T040 [US7] Implement `addWorkItem(actor, orderId, input)` in `src/server/orders/workItems.ts` per contracts/order-entry.md: `authorize(actor, "order.create")`; Zod-validate `input` (same per-item schema as `createOrder`'s `WorkItemCreateInput`); inside `db.$transaction`, fetch current Work Item states, throw `DomainOrderError("ORDER_FINISHED")` via `isOrderFinished()` **before** any write when finished, otherwise create the `WorkItem` at `state: "NEW"` and `audit.record("workitem.created", { ...input, orderId, addedToExistingOrder: true })` (depends on T001, T005, T007)
- [ ] T041 [US7] Export `addWorkItem` from `src/server/orders/index.ts`
- [ ] T042 [US7] Add an "Add Work Item" action + form to `src/app/(shell)/orders/[orderId]/page.tsx`, surfacing the `ORDER_FINISHED` refusal message and directing the user to create a new order instead (depends on T027, T040)

**Checkpoint**: US1–US7 all independently functional.

---

## Phase 10: User Story 8 - Edit an order before design starts (Priority: P3)

**Goal**: A lightweight, audited edit to a Work Item's descriptive fields before design begins (FR-012, FR-012a).

**Independent Test**: Edit a Work Item's quantity while still in `NEW`, save, confirm the change is reflected and recorded as an audited edit.

### Tests for User Story 8

- [ ] T043 [P] [US8] Integration test in `tests/integration/orders/editWorkItem.test.ts`: editing a `NEW`/`ASSIGNED` Work Item's quantity/dimensions/material/notes succeeds with a before/after audit entry; editing a Work Item in `IN_DESIGN` or later is refused with `DomainOrderError("PAST_EDIT_WINDOW")` (FR-012, FR-012a)

### Implementation for User Story 8

- [ ] T044 [US8] Implement `editWorkItem(actor, workItemId, patch)` in `src/server/orders/workItems.ts` per contracts/order-entry.md: `authorize(actor, "order.edit")`; Zod-validate `patch` (at least one key, each field passing the same rule as its `WorkItemCreateInput` counterpart); inside `db.$transaction`, fetch the existing item, throw `DomainOrderError("PAST_EDIT_WINDOW")` when `!PRE_DESIGN_EDITABLE_STATES.has(existing.state)`, otherwise update and `audit.record("workitem.edited", { before: pick(existing, patchKeys), after: patch })` (depends on T001, T005, T008)
- [ ] T045 [US8] Export `editWorkItem` from `src/server/orders/index.ts`
- [ ] T046 [US8] Add an inline "Edit" action + form per Work Item card on `src/app/(shell)/orders/[orderId]/page.tsx`, showing the `PAST_EDIT_WINDOW` refusal message and directing the user to the (out-of-scope) later change process when refused (depends on T027, T044)

**Checkpoint**: All 8 user stories independently functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Product Type admin catalog management (FR-004, supports US2's picker but isn't itself a numbered priority story) and final validation.

- [ ] T047 [P] Implement `createProductType`, `renameProductType`, `updateProductTypeDefaults`, `deactivateProductType` in `src/server/orders/productTypes.ts` per contracts/product-types.md: each calls `authorize(actor, "admin.config")`; `createProductType`/`renameProductType` catch Prisma's `P2002` unique violation on `name` and rethrow `DomainOrderError("DUPLICATE_NAME")`; `deactivateProductType` sets `isActive: false` only, never a hard delete; each mutation calls `audit.record` with the appropriate `action` (`producttype.created`/`renamed`/`defaults_updated`/`deactivated`) (depends on T005, T018)
- [ ] T048 Export the four Product Type admin functions from `src/server/orders/index.ts`
- [ ] T049 Build `src/app/(shell)/admin/product-types/page.tsx` — Server Component + inline Server Actions mirroring `src/app/(shell)/admin/departments/page.tsx`: list table (name, default department, default flags, active/inactive), create form, inline rename/deactivate actions per row, `formStr()` reused, `revalidatePath("/admin/product-types")` after every mutation (depends on T047)
- [ ] T050 [P] Contract tests in `tests/contract/orders/productTypes.test.ts`: creating a duplicate `name` yields `DUPLICATE_NAME`; deactivating never removes the row or breaks an existing `WorkItem.productTypeId` reference
- [ ] T051 [P] Unit tests for shared Zod validation schemas in `tests/unit/orders/validation.test.ts`: `quantity` rejects zero/negative/non-integer; `widthValue`/`heightValue` reject zero/negative; `ProductType.name` rejects empty-after-trim and >100 chars
- [ ] T052 Run every scenario in `quickstart.md` end-to-end against a freshly seeded database and record the result (manual QA pass, no code changes — confirms Scenarios 1–7 all behave as documented, including SC-006's keyboard-only check on Quick Create)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs T001's schema). Blocks every user story phase.
- **User Stories (Phase 3–10)**: All depend on Foundational completion. Stories are independent of each other except where a later story's UI reuses an earlier story's detail page (US6/US7/US8 all add actions to the page US4 builds in T027 — each depends on T027 specifically, not on US6/US7/US8 completing each other).
- **Polish (Phase 11)**: Product Type admin CRUD (T047–T049) only needs T018 (read helper) and T005 (error type) from Foundational/US2 — it can run any time after Phase 2, in parallel with US3–US8. Final validation (T052) depends on every prior phase.

### User Story Dependencies

- **US1 (P1)**: Foundational only.
- **US2 (P1)**: Foundational only; shares `create.ts` with US1 (T016 lands alongside T012, not blocking it).
- **US3 (P1)**: Foundational only.
- **US4 (P2)**: Foundational only.
- **US5 (P2)**: Foundational only.
- **US6 (P2)**: Foundational + US4's detail page (T027) for its UI task only; the service functions (T035, T036) have no story dependency.
- **US7 (P2)**: Foundational + US4's detail page (T027) for its UI task only.
- **US8 (P3)**: Foundational + US4's detail page (T027) for its UI task only.

### Parallel Opportunities

- T003, T004 (Setup) in parallel.
- T005–T009 (Foundational) in parallel; T010 depends on nothing else in the phase but touches the shared `prisma/seed.ts` file, so keep it sequential relative to T005–T009 if the same agent is editing seed.ts elsewhere.
- Every story's "Tests for User Story N" task(s) can run in parallel with each other across stories, once Foundational is done.
- US4, US5 have no cross-story code dependency and can be implemented in parallel.
- US6, US7, US8 can all be implemented in parallel once T027 (US4) exists, since they touch the same page file only at their final UI task — coordinate those three UI tasks (T038, T042, T046) to avoid merge conflicts on `src/app/(shell)/orders/[orderId]/page.tsx`, or land them as sequential small diffs.
- T047, T050, T051 (Phase 11) in parallel.

---

## Parallel Example: User Story 1

```bash
# After Foundational (Phase 2) completes:
Task: "Integration test for quickCreateOrder in tests/integration/orders/quickCreate.test.ts"
# (single implementation task chain: T012 -> T013 -> T014, not parallelizable within the story)
```

---

## Implementation Strategy

### MVP First (User Stories 1–3 only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational — critical, blocks everything.
3. Complete Phase 3 (US1), Phase 4 (US2), Phase 5 (US3) — all P1.
4. **STOP and VALIDATE**: run quickstart.md Scenarios 1–3 against a fresh seed.
5. This is the usable MVP: reception can log every request (Quick Create + full form) and see the queue.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 + US3 → MVP demo (reception intake + queue).
3. US4 → order detail/timeline (needed the first time someone asks "why is this late").
4. US5, US6, US7 → search, cancellation, append-to-existing-order (any order, P2 batch).
5. US8 → pre-design edit (P3, ships last).
6. Phase 11 → Product Type admin catalog + final quickstart validation.

### Delegation Note (for implementation phase)

Per plan.md's Technical Context, delegate each task to Antigravity, choosing the model by task
complexity: pure-function/schema tasks (T001, T005–T009, T047 validation logic) suit a fast model;
transaction/audit-pairing tasks (T012, T016, T035, T036, T040, T044) and anything touching
`transitionWorkItem`'s atomicity contract warrant the stronger reasoning model given the "never
throw before the write" invariant they must preserve. Review every agent diff against this file's
task description and the referenced contract section before merging.

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task.
- [Story] labels trace every implementation task back to spec.md's numbered story.
- `create.ts`, `workItems.ts`, `cancelOrder.ts`, and `search.ts` are each shared by more than one
  story (per plan.md's Project Structure) — tasks landing in the same file are ordered, not marked
  `[P]`, even when they belong to different stories.
- `orderNumber.ts`, listed as a possible file in plan.md's initial Project Structure sketch, is
  deliberately **not** created — research.md §1 resolved the real sequence via Prisma's native
  `@default(autoincrement())` (T001), which needs no application-level code.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
