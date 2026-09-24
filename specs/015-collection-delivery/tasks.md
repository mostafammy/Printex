---

description: "Task list for 015 Collection, Discrepancies & Delivery"
---

# Tasks: Collection, Discrepancies & Delivery

**Input**: Design documents from `/specs/015-collection-delivery/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/collection.md](./contracts/collection.md), [contracts/ports.md](./contracts/ports.md), [quickstart.md](./quickstart.md)

**Tests**: Included — plan.md's Project Structure enumerates test files under `tests/unit`,
`tests/contract`, `tests/integration`, and the constitution requires server-path tests for every
gate, forbidden transition and permission. Test tasks precede the implementation they cover and
are expected to fail first.

**Organization**: Tasks are grouped by user story (spec.md's 8 stories, priorities
P1/P1/P1/P2/P2/P2/P3/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to spec.md's US1–US8
- Every task names its exact file path

## Path Conventions

Single Next.js project (plan.md Project Structure):

- Module paths: `src/server/collection/**`, `src/app/(shell)/delivery/**`,
  `src/app/(shell)/admin/collection/page.tsx`, `prisma/schema/{core,identity}.prisma`,
  `prisma/manual-sql/collection-integrity.sql`, `tests/{unit,contract,integration}/collection/**`.
- One cross-module edit: `src/server/production/jobCard.ts` (014, T051).

**Shared files, created by whichever of 015 and 016 is implemented first and otherwise reused**:

| Shared file | Task |
|---|---|
| `src/server/core/aspects/**` and its lines in `src/server/core/index.ts` | T012, T013, T015 |
| `src/server/aspects.ts` | T015 |
| rule (c) exemption in `eslint.config.js` | T004 |
| `tests/unit/core/aspects.test.ts` | T007 |
| `src/instrumentation.ts` | T022 |

Each of those tasks begins with "**If absent, create; otherwise reuse**". Reusing means: verify the existing
files match [contracts/aspects.md](./contracts/aspects.md), and change nothing unless the contract itself is
changed.

**Brief acceptance criteria → tests**:

| Acceptance criterion | Test tasks |
|---|---|
| Delivering an order with any PENDING price → `PRICING_UNRESOLVED` from a direct server call | T032, T033, T034 |
| accepted + damaged + missing + waste = expected, validated server-side | T008, T026, T027 |
| A reprint creates a linked Work Item and keeps both histories | T045, T046 |
| Every discrepancy + resolution is in the audit log | T027, T040, T044, T067, T068 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the schema, DB integrity constraints, module scaffolding and seed data.

- [ ] T001 Apply the schema diff in `prisma/schema/core.prisma` and `prisma/schema/identity.prisma`
  exactly per data-model.md: enums `DiscrepancyType`, `CompensationKind`; models
  `ProductionReceipt` (`@@unique([workItemId, revision])`), `DiscrepancyCause` (`name @unique`),
  `Discrepancy` (`@@index([workItemId])`, `@@index([recordedAt, id])`,
  `@@index([responsibleDepartmentId, recordedAt])`), `Compensation` (`amount Decimal? @db.Decimal(12,
  2)`, `reprintWorkItemId @unique`, `@@index([discrepancyId])`, `@@index([kind, resolvedAt])`),
  `Delivery` (`@@index([orderId, deliveredAt])`), `DeliveryLine` (`workItemId @unique`),
  `CollectionPolicy` (`id @default("default")`); `WorkItem.reprintOfWorkItemId` +
  `"WorkItemReprint"` self-relation, `@@index([state])`, `@@index([reprintOfWorkItemId])`; all
  back-relations on `WorkItem`, `Order`, `Department`, `User`. Run `pnpm exec prisma generate` and
  `pnpm typecheck`
- [ ] T002 **ACTION REQUIRED — blocked, do not run unattended.** Create the migration with
  `pnpm exec prisma migrate dev --create-only --name collection_delivery`, append the `CHECK`
  constraints from data-model.md to its `migration.sql`, then apply it and run `pnpm exec prisma db
  seed`. **Blocker**: same shared-dev-DB drift as 011–014's T002 (012–014 used `db push`;
  `prisma/migrations/` stops at `20260923160000_orders_reception`) — confirm with Fady which path
  (migrate vs push) before touching the shared DB. Whoever picks this up: (1) confirm with Fady,
  (2) apply, (3) run `prisma/manual-sql/collection-integrity.sql` (T003), (4) re-run the
  integration suite
- [ ] T003 [P] Create `prisma/manual-sql/collection-integrity.sql` with the `CHECK` constraints and
  `REVOKE UPDATE, DELETE ON "ProductionReceipt", "Discrepancy", "Compensation", "Delivery",
  "DeliveryLine" FROM CURRENT_USER`, with the same header (apply command, non-superuser
  prerequisite, verification query) as `prisma/manual-sql/audit-event-append-only.sql`
- [ ] T004 [P] In `eslint.config.js`:
  - (1) Add a `no-restricted-imports` rule for `src/server/collection/**`, identical in shape to the
    `src/server/production/**` rule. Only `~/server/collection` (the barrel) may be imported from outside, and
    `tests/**` is exempt.
  - (2) **If absent, add; otherwise reuse**: add `"src/server/core/aspects/**"` to rule (c)'s `ignores`, with the
    justification comment from contracts/aspects.md §1. Rule (a) is not changed.
- [ ] T005 [P] Create the barrel `src/server/collection/index.ts` with `export {}` (populated per
  story)
- [ ] T006 [P] Extend `prisma/seed.ts`: upsert `CollectionPolicy { id: "default" }` and the eight
  default `DiscrepancyCause` names from data-model.md (upsert by `name`); no role/permission change

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The aspect layer, ports, pure domain logic and boot wiring every story calls into.

**⚠️ CRITICAL**: No user story implementation task may start until this phase is complete.

### Tests for Foundational

- [ ] T007 [P] Aspect tests, in two parts:
  - (1) **If absent, create; otherwise reuse and run** `tests/unit/core/aspects.test.ts`, which holds every case in
    contracts/aspects.md §7. With in-memory fake `deps` it checks that:
    - validation runs before the static `permission` check, which runs before `prepare`, which runs before the
      transaction (a FORBIDDEN actor never reaches `prepare`, the transaction or `run`);
    - a function-form or any-of `permission` works;
    - the `authorize` hook shares the `tx` with `run`;
    - audit rows are written in the same `tx` with `actorId = actor.userId`;
    - a missing audit raises `AspectMisuseError`, and `noChange` is refused unless `allowNoChange`;
    - `afterCommit` runs only after commit, a hook failure still returns `ok`, and nested `.inTx` hooks run once;
    - `.inTx` throws `AspectDomainError`;
    - every row of the §3.2 mapping table is covered (`ForbiddenError`→`FORBIDDEN`, `ZodError`→`VALIDATION`,
      `INVALID_TRANSITION` with `expectedFrom`→`CONFLICT` and without→`INVALID_STATE`, Prisma `P2002`→`CONFLICT`),
      and unknown errors are re-thrown.
  - (2) Create `tests/unit/collection/aspect.test.ts` for the collection binding.
    `TransitionFailure(GUARD_FAILED, guardCode "PRICING_UNRESOLVED")` must map to `PRICING_UNRESOLVED` and
    `"CLOSURE_CONDITIONS_UNMET"` to `CLOSURE_NOT_READY`. An unknown guard code maps to the base `GUARD_FAILED`.
- [ ] T008 [P] Unit test `tests/unit/collection/quantities.test.ts`: bucket mapping is total over
  all six `DiscrepancyType`s; `validateReceiptCounts` accepts sum = expected and returns
  `QUANTITY_MISMATCH { expected, sum }` otherwise; returns `UNCLASSIFIED_QUANTITY` when a bucket's
  line total ≠ its count; rejects `CUSTOMER_REJECTION` at receipt; `nextRevisionCounts` moves `q`
  from accepted to the right bucket and returns `EXCEEDS_AVAILABLE` for `q > accepted`; `isMajor`
  at 9.99% / 10% / 10.01% of expected with the default policy; expected falls back to produced
- [ ] T009 [P] Unit test `tests/unit/collection/readiness.test.ts`: separate vs grouped predicate;
  cancelled items ignored; all-`DELIVERED` grouped Order is not "ready" (nothing left to collect);
  `readinessFlipped(before, after)` true only on false→true
- [ ] T010 [P] Unit test `tests/unit/collection/closure.test.ts`: `closureConditions` returns each
  of `NOT_ALL_DELIVERED`, `PRICING_UNRESOLVED`, `OPEN_DISCREPANCIES`, `UNPAID_BALANCE`,
  `FINANCE_UNAVAILABLE` in isolation; `remaining > 0 && creditApproved` is not unmet; `remaining < 0`
  is settled; cancelled Work Items ignored; empty list when all hold
- [ ] T011 [P] Contract test `tests/contract/collection/ports.test.ts`: unbound
  `PricingGatePort` returns `PENDING` with the "not connected" label for every id; unbound
  `FinanceSummaryPort` returns `UNAVAILABLE`; unbound `DiscrepancyAttachmentPort.available ===
  false`; binding any port twice throws `PORT_ALREADY_BOUND`; `__setCollectionPortsForTest` resets

### Implementation for Foundational

- [ ] T012 [P] **If absent, create; otherwise reuse**: `src/server/core/aspects/types.ts` and
  `src/server/core/aspects/errors.ts`, exactly as in contracts/aspects.md §2 and §3.2:
  - the `AspectBaseError`, `AspectResult<T,E>`, `PermissionSpec`, `AuditEntry`, `RunOutcome`, `TxScope`,
    `CommandCtx` and `AspectDeps` types;
  - `AspectDomainError`, `TransitionFailure`, `AspectMisuseError`, `fail` and the single error-mapping function.

  There must be no import of `~/server/auth`, `~/server/db`, or any feature (rule (a)).
- [ ] T013 [P] **If absent, create; otherwise reuse**: `src/server/core/aspects/transition.ts`, with
  `transitionOrThrow(tx, input)` per contracts/aspects.md §3.3. It converts the actor with `asUserId`, calls
  `transitionWorkItem`, and on `{ ok: false }` throws `TransitionFailure(workItemId, error)`. Do not refactor the
  copies in 011–014.
- [ ] T014 [P] Implement `src/server/collection/lock.ts`: `lockOrder(tx, orderId)` via
  `tx.$queryRaw\`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE\``. When there is no row it calls
  `fail({ code: "NOT_FOUND", entity: "Order", id })` (research.md §7).
- [ ] T015 The aspect engine and its bindings, in three steps (depends on T012 and T013):
  - (1) **If absent, create; otherwise reuse**: `src/server/core/aspects/engine.ts`, with
    `createAspects(deps).forModule<E>(opts)` returning `{ defineCommand, defineQuery }` and running the fixed
    pipeline in contracts/aspects.md §3.1. Add the §6 export lines to `src/server/core/index.ts`.
  - (2) **If absent, create; otherwise reuse**: `src/server/aspects.ts`, the composition root in §4 that binds
    `db`, `authorize`, `audit`, `Actor` and `Permission` once.
  - (3) **Always**: create `src/server/collection/errors.ts` (the `CollectionError` union from the
    contracts/collection.md Errors table, and `CollectionResult<T> = AspectResult<T, CollectionError>`) and
    `src/server/collection/aspect.ts` (`aspects.forModule<CollectionError>({ module: "collection",
    mapGuardFailure })` per contracts/aspects.md §5).
- [ ] T016 [P] Implement `src/server/collection/ports/{pricing,finance,attachments}.ts` (types,
  fail-closed/unavailable defaults, `bind…Port` once-only) and
  `src/server/collection/ports/testing.ts` (`__setCollectionPortsForTest`) per contracts/ports.md;
  export the port types and `bind…` functions from the barrel
- [ ] T017 [P] Implement pure `src/server/collection/quantities.ts` (bucket map, expected-quantity
  resolution, `validateReceiptCounts`, `nextRevisionCounts`, `isMajor`) per data-model.md
- [ ] T018 [P] Implement pure `src/server/collection/readiness.ts` (`isReadyForCustomer(mode,
  states)`, `readinessFlipped`) per data-model.md "Derived values"
- [ ] T019 [P] Implement pure `closureConditions()` in `src/server/collection/closure.ts`
  (predicate only; `tryFinancialClosure` lands in US7)
- [ ] T020 [P] Implement `src/server/collection/notifications.ts`: `notifyReadiness`,
  `notifyMajorDiscrepancy`, `notifyMonetaryCompensation`, each one `notify(tx, …)` call with the
  event types/payloads from contracts/ports.md §4 and recipients from the policy
- [ ] T021 Implement `loadPolicy(tx)` / `getCollectionPolicy(actor)` in
  `src/server/collection/policy.ts` (row or defaults; `admin.config` for the public read)
- [ ] T022 `src/instrumentation.ts` is the single shared registration point (research.md §4).
  - **If absent**, create it with an `export async function register()` that returns immediately unless
    `process.env.NEXT_RUNTIME === "nodejs"`. It then runs one block per module:
    `const { registerCollectionGuards } = await import("~/server/collection"); registerCollectionGuards();`.
    Add a header comment: "one line per module's registerXGuards(); provider barrels (051/052/050) are imported
    here to bind their ports".
  - **Otherwise** (016 created it), add only the collection block, keeping any existing blocks unchanged.
  - Stub `registerCollectionGuards` in `src/server/collection/guards.ts` as an idempotent no-op with a
    module-level `registered` flag. Export it from the barrel and call it once at barrel top level. The actual
    guards are added in T035 and T057.

**Checkpoint**: Foundation ready — every user story phase below may now start.

---

## Phase 3: User Story 1 - Collection staff see what has arrived from production (Priority: P1) 🎯 MVP

**Goal**: `/delivery` "waiting to receive" tab lists Orders with `PRODUCTION_COMPLETED` Work
Items, grouped, urgent-first then longest-waiting, paginated (FR-001, FR-002, FR-003).

**Independent Test**: spec.md US1 Independent Test.

### Tests for User Story 1

- [ ] T023 [P] [US1] Contract test `tests/contract/collection/permissions.test.ts` (created here,
  extended by later stories): for each seeded role (RECEPTION, DESIGNER, HEAD_DESIGNER,
  PRODUCTION_OPERATOR, PRINT_RECEPTION_DELIVERY, ACCOUNTING, ADMIN_OWNER) built via the real
  permission seed, `getCollectionQueue` returns `FORBIDDEN` unless the role holds
  `collection.receive`, `getDeliveryQueue` unless `delivery.record`
- [ ] T024 [P] [US1] Integration test `tests/integration/collection/queue.test.ts`: seed an urgent
  Order (1 `PRODUCTION_COMPLETED` + 1 `IN_PRODUCTION`) and two normal Orders with different
  `PhaseTiming` QUEUE `startedAt`; assert urgent first then oldest `waitingSince`, one row per
  Order, non-waiting items only in `others`, cancelled items excluded; seed 30 Orders and page with
  `pageSize: 10` — every Order appears exactly once and `total = 30`; assert the page issues a
  constant number of queries (Prisma query-event counter ≤ 3) for 10 and 30 Orders (no N+1)

### Implementation for User Story 1

- [ ] T025 [US1] Implement `getCollectionQueue` and `getDeliveryQueue` in
  `src/server/collection/queue.ts` per contracts/collection.md and research.md §6 (ordered
  `$queryRaw` page + `count` + one `findMany`; `getDeliveryQueue` adds `readyForCustomer` via
  readiness.ts and `pricingBlocked` via one batched `PricingGatePort` call); export from the barrel;
  build `src/app/(shell)/delivery/page.tsx` (two tabs, pagination, urgent badge) — the `/delivery`
  nav entry already exists in `src/app/(shell)/nav.ts`; Arabic keys in `src/messages/ar.json`

**Checkpoint**: US1 independently functional.

---

## Phase 4: User Story 2 - Receive production output and count it (Priority: P1)

**Goal**: Receive a Work Item with four validated counts and classified discrepancies; it becomes
`READY_FOR_COLLECTION` (FR-004..FR-011, FR-031).

**Independent Test**: spec.md US2 Independent Test.

### Tests for User Story 2

- [ ] T026 [P] [US2] Contract test in `tests/contract/collection/permissions.test.ts` and
  `tests/contract/collection/receive.test.ts`: `getReceiveSheet`/`receiveProduction` FORBIDDEN
  without `collection.receive`; a **direct server call** to `receiveProduction` with counts summing
  to expected − 1 returns `QUANTITY_MISMATCH { expected, sum }` and writes nothing (no receipt, no
  discrepancy, no audit row, state unchanged); negative/fractional counts → `VALIDATION`; Work Item
  not `PRODUCTION_COMPLETED` → `INVALID_STATE`; `CUSTOMER_REJECTION` line →
  `DISCREPANCY_TYPE_NOT_ALLOWED`
- [ ] T027 [P] [US2] Integration test `tests/integration/collection/receive.test.ts`: expected 100,
  accepted 90 / damaged 6 / waste 4 with lines DAMAGED 6 + WASTE 4 → state
  `READY_FOR_COLLECTION`, receipt revision 1 with the counts, 2 `Discrepancy` rows with
  `recordedById`, `recordedAt`, cause, default `responsibleDepartmentId`; `AuditEvent` rows
  `collection.receipt_recorded` ×1 and `discrepancy.recorded` ×2 whose `entityId`s match; a
  `WorkItemTransition` `PRODUCTION_COMPLETED → READY_FOR_COLLECTION`; non-accepted 10 of 100 (= 10%, default
  threshold) → exactly one `discrepancy.major` `NotificationEvent`; a receipt with 9 non-accepted →
  none; lines covering 4 of 6 damaged
  → `UNCLASSIFIED_QUANTITY`; `WorkItem.quantity = null` → expected = `producedQuantity` and
  `expectedFromProduced = true`; attachments with unbound port → `ATTACHMENTS_UNAVAILABLE`; 11 files, or files whose aggregate exceeds 100 MB
  (stub counts streamed bytes) → `VALIDATION` (path `files`), nothing written, the stub stops staging at the
  cap; with a stub port the returned `attachmentId`s are on the audit row; an actor without
  `collection.receive` sending files → `FORBIDDEN` and the stub's `stage` is never called; two concurrent `receiveProduction`
  calls (`Promise.all`) → exactly one succeeds, the other `CONFLICT`/`INVALID_STATE`; a raw SQL
  insert of a mismatching receipt fails the DB `CHECK` (skip with a clear message if T002/T003 not
  applied)

### Implementation for User Story 2

- [ ] T028 [US2] Implement `listDiscrepancyCauses` in `src/server/collection/causes.ts` (read only;
  admin mutations land in US8)
- [ ] T029 [US2] Implement `getReceiveSheet` in `src/server/collection/receive.ts` per
  contracts/collection.md
- [ ] T030 [US2] Implement `receiveProduction` in `src/server/collection/receive.ts` with
  `defineCommand` per contracts/collection.md: stage attachments in `prepare` (after the static permission check); in tx `lockOrder`, load,
  authorize, `validateReceiptCounts`, create receipt + discrepancies, commit attachments,
  `transitionOrThrow(PRODUCTION_COMPLETED → READY_FOR_COLLECTION)`, `isMajor` →
  `notifyMajorDiscrepancy`; audit entries `collection.receipt_recorded` + one
  `discrepancy.recorded` per line (depends on T015–T017, T020, T021, T028)
- [ ] T031 [US2] Export `getReceiveSheet`, `receiveProduction`, `listDiscrepancyCauses` and their
  types from the barrel; build `src/app/(shell)/delivery/receive/[workItemId]/page.tsx`, the client
  form `src/app/(shell)/delivery/_components/ReceiveForm.tsx` (`useActionState`, live sum
  indicator, one discrepancy line per non-accepted bucket, attachment inputs only when
  `attachmentsAvailable`), and the `receiveProductionAction` in
  `src/app/(shell)/delivery/actions.ts` returning a serialized `CollectionResult`; Arabic message per
  `CollectionError.code` in `src/messages/ar.json`

**Checkpoint**: US1 + US2 functional.

---

## Phase 5: User Story 3 - Hand over to the customer, never before pricing is resolved (Priority: P1)

**Goal**: Record hand-overs; `→ DELIVERED` is guarded by pricing on the central transition;
balance shown; partial rules (FR-022..FR-027, constitution II).

**Independent Test**: spec.md US3 Independent Test.

### Tests for User Story 3

- [ ] T032 [P] [US3] Contract test `tests/contract/collection/guards.test.ts` (pricing half):
  after importing `~/server/collection`, call core's `transitionWorkItem(tx, { to: "DELIVERED" })`
  **directly** on a `READY_FOR_COLLECTION` Work Item — with the port unbound → `GUARD_FAILED`,
  `details.guardCode === "PRICING_UNRESOLVED"`, state unchanged; with a stub `PENDING` → same; with
  the Order `priority: "URGENT"` → same; with a stub `RESOLVED` or `NOT_REQUIRED` → succeeds;
  calling `register()` from `src/instrumentation.ts` registers the guard; calling
  `registerCollectionGuards()` twice runs the guard once per transition (the pricing-port spy counts
  exactly one call)
- [ ] T033 [P] [US3] Contract test in `tests/contract/collection/delivery.test.ts` and
  `permissions.test.ts`: `getDeliverySheet`/`recordDelivery` FORBIDDEN without `delivery.record`;
  **direct server call** `recordDelivery` for an Order whose selected Work Items include one with
  stub `PENDING` pricing → `{ ok: false, error: { code: "PRICING_UNRESOLVED", items: [ { workItemId
  of the pending item, waitingSince, responsible } ] } }`, zero `Delivery`/`DeliveryLine` rows, all Work Items still `READY_FOR_COLLECTION`; same result for an urgent Order; an actor without
  `delivery.record` gets `FORBIDDEN` (not `PRICING_UNRESOLVED`) and the pricing-port spy records
  zero calls
- [ ] T034 [P] [US3] Integration test `tests/integration/collection/delivery.test.ts`: happy path
  (both `RESOLVED`) → both `DELIVERED`, `deliveredQuantity` = current receipt accepted (not
  client-supplied — the input schema has no quantity field), `receivedByPhone` normalized,
  `delivery.recorded` audit row; stub whose status flips `RESOLVED` (pre-check) → `PENDING` (guard)
  → whole hand-over rolled back, `PRICING_UNRESOLVED`; grouped Order delivering 2 of 3 without
  `partialConfirmed`+reason → `PARTIAL_REASON_REQUIRED`, with them → success, `isPartial: true`, 3rd still ready; grouped partial with `partialConfirmed` but a blank
  reason → `PARTIAL_REASON_REQUIRED`; separate Order 1 of 2 → success, `isPartial: true`, no reason needed; delivering an
  already-`DELIVERED` Work Item → `INVALID_STATE`; two concurrent deliveries of the same Work Item →
  one wins; `deliveredAt` in the future → `VALIDATION`; `handedOverById` omitted → the recording user,
  another active user → stored, unknown/inactive user → `NOT_FOUND`; delivery sheet with finance stub `remaining
  > 0, creditApproved: true` shows the balance and delivery still succeeds; unbound finance →
  `finance.status === "UNAVAILABLE"`

### Implementation for User Story 3

- [ ] T035 [US3] Implement `deliveryPricingGuard` in `src/server/collection/guards.ts`. It never reads priority.
  Register it inside `registerCollectionGuards()` via `registerGuard({ from: "READY_FOR_COLLECTION", to:
  "DELIVERED" }, …)`, behind the idempotency flag (research.md §4).
- [ ] T036 [US3] Implement `getDeliverySheet` in `src/server/collection/delivery.ts` per
  contracts/collection.md (fixed query count; batched pricing-port call; finance-port call;
  `closure` computed with `closureConditions` — shows "not closed" until US7)
- [ ] T037 [US3] Implement `recordDelivery` in `src/server/collection/delivery.ts` with
  `defineCommand`: pricing pre-check in `prepare` (after the static permission check); in tx `lockOrder`, validate lines, derive
  `isPartial`, `PARTIAL_REASON_REQUIRED`, create `Delivery` + `DeliveryLine`s, `transitionOrThrow`
  each Work Item to `DELIVERED` with `meta: { deliveryId }`; audit `delivery.recorded` (depends on
  T035)
- [ ] T038 [US3] Export `getDeliverySheet`, `recordDelivery` and types from the barrel; build
  `src/app/(shell)/delivery/orders/[orderId]/page.tsx` with the hand-over form
  (`_components/DeliveryForm.tsx`), pricing-blocker banner naming items, waiting time and
  responsible, balance panel (or "finance not connected"), partial checkbox + reason shown for
  grouped Orders; `recordDeliveryAction` in `actions.ts`; Arabic keys

**Checkpoint**: All P1 stories functional — receive → hand-over works end to end, gate enforced.

---

## Phase 6: User Story 4 - Record a discrepancy found after receipt (Priority: P2)

**Goal**: Post-receipt discrepancies create receipt revisions; customer rejection after hand-over
(FR-011, FR-012, FR-021).

**Independent Test**: spec.md US4 Independent Test.

### Tests for User Story 4

- [ ] T039 [P] [US4] Contract test in `tests/contract/collection/discrepancy.test.ts` and
  `permissions.test.ts`: `recordDiscrepancy` FORBIDDEN without `collection.receive`; type-by-state
  matrix (FR-011) — every disallowed (state, type) pair → `DISCREPANCY_TYPE_NOT_ALLOWED`/
  `INVALID_STATE`; quantity > accepted → `EXCEEDS_AVAILABLE`; any `COMPLETED` Work Item on the Order
  → `ORDER_CLOSED`
- [ ] T040 [P] [US4] Integration test `tests/integration/collection/discrepancy.test.ts`: ready Work
  Item accepted 90 → DAMAGED 5 → revision 2 = 85/+5 with sum = expected, revision 1 unchanged and
  still readable, `Discrepancy.receiptId` = revision 2, audit rows `discrepancy.recorded` +
  `collection.receipt_revised` (before/after counts); delivered Work Item → CUSTOMER_REJECTION 3
  stored with `receiptId = null`, `DeliveryLine.deliveredQuantity` unchanged; rejection > delivered
  − prior rejections → `EXCEEDS_AVAILABLE`; a discrepancy pushing non-accepted to ≥ 10% of expected
  writes one `discrepancy.major` `NotificationEvent` to `ADMIN_OWNER`, one below 10% writes none

### Implementation for User Story 4

- [ ] T041 [US4] Implement `recordDiscrepancy` in `src/server/collection/discrepancy.ts` with
  `defineCommand` per contracts/collection.md (revision via `nextRevisionCounts`, delivered-state
  branch, `isMajor` → `notifyMajorDiscrepancy`, attachments via the port); refactor
  `receiveProduction` (T030) to create its discrepancy rows through the shared
  `recordDiscrepancyInTx` helper so there is one write path; export from the barrel
- [ ] T042 [US4] Add the "record discrepancy" form (`_components/DiscrepancyForm.tsx`) and the
  receipt-revision history panel to `src/app/(shell)/delivery/orders/[orderId]/page.tsx`;
  `recordDiscrepancyAction` in `actions.ts`; Arabic keys

**Checkpoint**: US4 functional on top of US2/US3.

---

## Phase 7: User Story 5 - Record how each discrepancy was compensated (Priority: P2)

**Goal**: Resolutions with permission-by-kind; Reprint creates a linked Work Item back to
production (FR-014..FR-018).

**Independent Test**: spec.md US5 Independent Test.

### Tests for User Story 5

- [ ] T043 [P] [US5] Contract test in `tests/contract/collection/resolution.test.ts` and
  `permissions.test.ts`: `resolveDiscrepancy` with `CREDIT`/`PRICE_ADJUSTMENT` as
  PRINT_RECEPTION_DELIVERY → `FORBIDDEN`, as ADMIN_OWNER → ok; non-monetary kinds need
  `collection.receive`; empty `reason` → `VALIDATION`; `amount` missing on `CREDIT` or present on
  `REPRINT` → `VALIDATION`; `amount` "0" or "1.234" → `VALIDATION`
- [ ] T044 [P] [US5] Integration test `tests/integration/collection/resolution.test.ts`: 10-unit
  discrepancy resolved 6 REPRINT + 4 CUSTOMER_ACCEPTS_SHORTAGE → discrepancy resolved; a further
  1-unit resolution → `RESOLUTION_EXCEEDS_DISCREPANCY`; CREDIT 50.00 by admin stores
  `Decimal("50.00")` and writes a `compensation.monetary_recorded` outbox row; each
  `Compensation` has exactly one `compensation.recorded` `AuditEvent` with matching `entityId`,
  kind, quantity, amount string, reason; resolving on a closed Order → `ORDER_CLOSED`
- [ ] T045 [P] [US5] Integration test `tests/integration/collection/reprint.test.ts`: snapshot the
  original Work Item's `WorkItemTransition`, `ProductionReceipt`, `Discrepancy`, `AuditEvent` rows;
  resolve REPRINT 6 → a new Work Item in the **same Order** with `quantity 6`, copied spec fields,
  `departmentId` = original's effective department, `requiresDesign/requiresReview = false`,
  `reprintOfWorkItemId` = original, `Compensation.reprintWorkItemId` = new id, state
  `READY_FOR_PRODUCTION` via a `NEW → READY_FOR_PRODUCTION` transition, a `workitem.reprint_created`
  audit row; the original's snapshot rows are byte-identical afterwards (both histories kept);
  014's `getOperatorQueue` for an operator of that department lists the reprint;
  `getWorkItemLineage` returns original→reprint and reprint→original; a reprint of the reprint links
  to the reprint; a REPRINT for a CUSTOMER_REJECTION after all items are `DELIVERED` is allowed
- [ ] T046 [P] [US5] Integration test `tests/integration/production/reprintJobCard.test.ts`: 014's
  `getJobCard` on a reprint Work Item with no `DesignVersion` returns the original's approved
  version in `approvedFile`; a Work Item with its own approved version is unaffected

### Implementation for User Story 5

- [ ] T047 [US5] Implement `createReprintInTx` in `src/server/collection/reprint.ts` per
  research.md §9 (create Work Item, then caller creates `Compensation`, then
  `transitionOrThrow(NEW → READY_FOR_PRODUCTION, meta)`, audit `workitem.reprint_created`)
- [ ] T048 [US5] Implement `resolveDiscrepancy` in `src/server/collection/resolution.ts` with
  `defineCommand` per contracts/collection.md (discriminated-union schema, permission by kind,
  `lockOrder`, remaining-quantity check, REPRINT via T047, monetary → `notifyMonetaryCompensation`,
  audit `compensation.recorded`) (depends on T047)
- [ ] T049 [US5] Implement `getWorkItemLineage` in `src/server/collection/reports.ts`
- [ ] T050 [US5] Export `resolveDiscrepancy`, `getWorkItemLineage` and types from the barrel; add
  the resolve form (`_components/ResolveForm.tsx`, amount field only for monetary kinds and only
  for actors holding `admin.override`) and lineage links to the delivery sheet;
  `resolveDiscrepancyAction` in `actions.ts`; Arabic keys
- [ ] T051 [US5] Coordinate, then edit 014's `src/server/production/jobCard.ts`: when no approved
  `DesignVersion` exists for the Work Item and `reprintOfWorkItemId` is set, walk
  `reprintOfWorkItemId` up (max depth 10) to the nearest ancestor with an approved version
  (research.md §9). Same-track (Track A) change; keep the 014 barrel surface unchanged
- [ ] T052 [US5] Verify T051 against T046 and the existing `tests/{contract,integration}/production/
  jobCard*.test.ts` suite (no regression in 014)

**Checkpoint**: US5 functional — reprints flow back into 014's queue.

---

## Phase 8: User Story 6 - The customer is told when their order is ready (Priority: P2)

**Goal**: Exactly-once readiness notifications per flip, grouped vs separate (FR-019, FR-020).

**Independent Test**: spec.md US6 Independent Test.

### Tests for User Story 6

- [ ] T053 [P] [US6] Integration test `tests/integration/collection/readiness.test.ts`: grouped
  Order with 2 Work Items — receive #1 → zero `customer.ready_for_collection` rows; receive #2 →
  exactly one, payload per contracts/ports.md §4 (`templateKey`, `workItemIds` both), plus one
  `order.ready_for_collection` to `RECEPTION`; grouped Order with one `CANCELLED` item → ready once
  the others are received; separate Order → one row per received Work Item; grouped Order that was
  ready gains a reprint, then the reprint is received → a second row; **concurrency**: receive the
  last two Work Items of a grouped Order with `Promise.all` → exactly one customer row (Order lock,
  research.md §7)

### Implementation for User Story 6

- [ ] T054 [US6] Wire readiness into `receiveProduction` (`src/server/collection/receive.ts`):
  under the Order lock, load sibling states, compute `isReadyForCustomer` before/after the
  transition, on `readinessFlipped` call `notifyReadiness` (customer + internal events) in the same
  `tx`; show a "customer notified" marker on the delivery queue row

**Checkpoint**: US6 functional.

---

## Phase 9: User Story 7 - Orders close financially and become completed (Priority: P3)

**Goal**: Order-level closure to `COMPLETED`, guarded on the central transition, evaluated
post-commit (FR-028..FR-030).

**Independent Test**: spec.md US7 Independent Test.

### Tests for User Story 7

- [ ] T055 [P] [US7] Contract test in `tests/contract/collection/guards.test.ts` (closure half):
  direct `transitionWorkItem(DELIVERED → COMPLETED)` with an open discrepancy, or unresolved
  pricing, or finance `remaining > 0 && !creditApproved`, or finance unbound → `GUARD_FAILED`,
  `details.guardCode === "CLOSURE_CONDITIONS_UNMET"`, state unchanged; **all conditions met but called directly**
  (no `meta.closureRunId`, or a forged unregistered one) → still `GUARD_FAILED` /
  `CLOSURE_CONDITIONS_UNMET`; the same Order closed via `tryFinancialClosure` → succeeds; `tryFinancialClosure` FORBIDDEN for an actor with none of `delivery.record`,
  `collection.receive`, `payment.record` (in `permissions.test.ts`)
- [ ] T056 [P] [US7] Integration test `tests/integration/collection/closure.test.ts`: each closure
  condition unmet in isolation → `{ closed: false, unmet: [that condition] }`, no writes; all met →
  every `DELIVERED` Work Item `COMPLETED` in one call, one `order.financially_closed` audit row,
  cancelled items untouched; second call → `{ closed: true }` with no new rows; `recordDelivery` of the last Work Item with settled stub finance closes the Order via `afterCommit`
  (asserted from DB state: all items `COMPLETED`; the result has only `deliveryId`/`isPartial`); a closure
  hook failure is logged and the delivery still returns `ok`; `resolveDiscrepancy` of the last open discrepancy on a fully delivered,
  settled Order closes it

### Implementation for User Story 7

- [ ] T057 [US7] Implement `closureGuard` in `src/server/collection/guards.ts` (requires a registered
  `meta.closureRunId` from the module-private `activeClosureRuns` set **and** empty `closureConditions`), and register it inside
  `registerCollectionGuards()` via `registerGuard({ from: "DELIVERED", to: "COMPLETED" }, …)`
- [ ] T058 [US7] Implement `evaluateClosure(orderId)` and `tryFinancialClosure` (`defineCommand`, `allowNoChange: true`, any-of `permission`; owns the module-private `activeClosureRuns`
  set, and adds/removes `closureRunId` around its transitions) in `src/server/collection/closure.ts`; export from the
  barrel (the entry point 052 calls, contracts/ports.md §2)
- [ ] T059 [US7] Add `afterCommit: () => tryFinancialClosure(actor, orderId)` to `recordDelivery`
  (T037) and `resolveDiscrepancy` (T048). The outcome is logged only and never returned
- [ ] T060 [US7] Show closure status (unmet conditions in Arabic) and a "close order" button on
  the delivery sheet; `tryFinancialClosureAction` in `actions.ts`

**Checkpoint**: Full lifecycle `PRODUCTION_COMPLETED → … → COMPLETED` works.

---

## Phase 10: User Story 8 - Management gets the loss history (Priority: P3)

**Goal**: 090-ready discrepancy facts; Admin configuration of causes and policy (FR-013, FR-021,
FR-034).

**Independent Test**: spec.md US8 Independent Test.

### Tests for User Story 8

- [ ] T061 [P] [US8] Contract test in `permissions.test.ts`: `listDiscrepancyFacts` FORBIDDEN
  without `audit.view`; `updateCollectionPolicy` and cause mutations FORBIDDEN without
  `admin.config`; the barrel exports no function that updates or deletes a receipt, discrepancy,
  compensation or delivery (static assertion over `Object.keys(await import("~/server/collection"))`)
- [ ] T062 [P] [US8] Integration test `tests/integration/collection/reports.test.ts`: discrepancies
  on three dates across two departments → a date-range query returns only in-range rows, ordered by
  `(recordedAt, id)`, with `bucket`, `expectedQuantity` and compensations; `departmentId` filter;
  keyset pagination with `limit: 1` walks all rows exactly once; range > 366 days → `VALIDATION`
- [ ] T063 [P] [US8] Integration test `tests/integration/collection/config.test.ts`:
  `updateCollectionPolicy` persists and audits before/after; percent 0 or 101 → `VALIDATION`;
  create/rename/deactivate cause each audited; duplicate name (case-insensitive) →
  `DUPLICATE_NAME`; a deactivated cause disappears from `getReceiveSheet().causes` but remains on
  existing discrepancies; changing the percent to 5 changes `isMajor` outcomes in `recordDiscrepancy`

### Implementation for User Story 8

- [ ] T064 [US8] Implement `listDiscrepancyFacts` and `listCompensationsForOrder` in
  `src/server/collection/reports.ts` per contracts/collection.md; export from the barrel
  (`listCompensationsForOrder` under an `// integration (051/052)` comment)
- [ ] T065 [US8] Implement `updateCollectionPolicy` (`src/server/collection/policy.ts`) and
  `createDiscrepancyCause`, `renameDiscrepancyCause`, `setDiscrepancyCauseActive`
  (`src/server/collection/causes.ts`) with `defineCommand`; export from the barrel
- [ ] T066 [US8] Build `src/app/(shell)/admin/collection/page.tsx` (policy form + cause list with
  add/rename/activate) gated to `ADMIN_OWNER`; Arabic keys

**Checkpoint**: All 8 user stories independently functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T067 [P] Integration test `tests/integration/collection/audit.test.ts` (brief acceptance
  "every discrepancy + resolution is in the audit log"): run receive (2 lines) → post-receipt
  discrepancy → customer rejection after delivery → resolutions REPRINT, CUSTOMER_ACCEPTS_SHORTAGE,
  CREDIT; assert every `Discrepancy.id` has exactly one `discrepancy.recorded` and every
  `Compensation.id` exactly one `compensation.recorded` `AuditEvent`, each with `actorId`,
  `createdAt` and `after`; every receipt revision and the delivery have their audit rows
- [ ] T068 [P] Integration test (same file): with T003 applied, a raw `UPDATE`/`DELETE` on
  `"Discrepancy"` and `"Compensation"` is rejected with "permission denied" (skipped with an
  explicit message when the DB role is a superuser, mirroring 001's audit append-only test)
- [ ] T069 Run `pnpm check` (lint + typecheck) across `src/server/collection/**`,
  `src/server/core/aspects/**`, `src/server/aspects.ts`, `src/instrumentation.ts`, `src/server/production/jobCard.ts`, the pages and `prisma/seed.ts`; fix
  every violation (no `any`, no deep imports into `~/server/collection/**` outside the module)
- [ ] T070 Run the full `pnpm test` suite; every pre-existing 001/002/010–014 test still passes
  unmodified, every new `tests/{unit,contract,integration}/collection/**` test passes once T002
  unblocks the DB-dependent ones (unit tests T007–T010 pass regardless)
- [ ] T071 Manual quickstart QA — walk through quickstart.md Scenarios 1–9 against a running dev
  server; pricing-resolved paths only after 051 binds its port (quickstart.md prerequisites)
- [ ] T072 Post the cross-team contract summary (plan.md "Cross-team contracts") to the 051/052/050/
  054 Linear projects for Fady's sign-off before merging (no sensitive data — the Linear↔GitHub
  mirror is public)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — T002 blocks only DB-dependent tests, not code
- **Foundational (Phase 2)**: depends on T001 (generated Prisma types) — BLOCKS all stories
- **US1 (Phase 3)**: Foundational only
- **US2 (Phase 4)**: Foundational only (UI links from US1's queue)
- **US3 (Phase 5)**: needs Work Items in `READY_FOR_COLLECTION` — integration tests seed them
  directly, so implementation depends only on Foundational; the end-to-end demo needs US2
- **US4 (Phase 6)**: depends on US2's receipt (T030) — T041 refactors it
- **US5 (Phase 7)**: depends on US4's discrepancy write path (T041); T051 touches 014
- **US6 (Phase 8)**: depends on US2 (T030); its re-ready scenario uses US5's reprint
- **US7 (Phase 9)**: depends on US3 (T037) and US5 (T048) for the `afterCommit` wiring
- **US8 (Phase 10)**: reports depend on US4/US5 data; config is independent after Foundational
- **Polish (Phase 11)**: after all desired stories

### Within Each User Story

- Tests written before implementation, expected to fail first
- Pure logic and aspects before services; services before actions/UI
- Story complete before moving to the next priority

### Parallel Opportunities

- Setup T003–T006 in parallel after T001
- Foundational tests T007–T011 and implementations T012–T014, T016–T020 in parallel (different
  files); T015 after T012/T013
- After Foundational: US1, US2, US3 and the config half of US8 can proceed in parallel
- `tests/contract/collection/permissions.test.ts` is extended by several stories — its tasks are
  marked [P] relative to other files but must not be edited concurrently

---

## Parallel Example: Foundational

```bash
Task: "Shared aspect tests in tests/unit/core/aspects.test.ts (+ tests/unit/collection/aspect.test.ts)"
Task: "Unit test quantities in tests/unit/collection/quantities.test.ts"
Task: "Unit test readiness in tests/unit/collection/readiness.test.ts"
Task: "Unit test closure predicate in tests/unit/collection/closure.test.ts"
Task: "Contract test port defaults in tests/contract/collection/ports.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Setup + Foundational
2. US1 (queue) → US2 (receive) → US3 (hand-over + pricing gate)
3. **STOP and VALIDATE**: produced work can be received, counted, and handed over — never with
   unresolved pricing (fail closed until 051)

### Incremental Delivery

1. MVP above → demo
2. US4 + US5 (post-receipt discrepancies, compensations, reprints) → demo
3. US6 (customer notification requests) → demo (actual sending arrives with 054)
4. US7 (financial closure) → demo once 052 binds its port
5. US8 (loss facts + config) → hand off to 090

---

## Notes

- [P] tasks = different files, no dependencies
- T002 (DB migration) is the standing blocker for DB-dependent tests, as in every prior feature —
  confirm with Fady first
- T051 is the one place this feature edits another feature's module (014's `jobCard.ts`, same track)
- No task adds a permission key, a workflow edge, or a bypass of any guard
