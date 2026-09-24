---

description: "Task list for 051 Pricing Engine"
---

# Tasks: Pricing Engine

**Input**: Design documents from `/specs/051-pricing/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and all files under [contracts/](./contracts/).

**Tests**: Required. Every acceptance scenario and cross-feature gate must be tested through the server entry point. Pure calculation tests may remain unit tests; UI tests must prove display/authorization behavior without duplicating pricing logic.

**Organization**: Tasks are grouped by user story. `spec.md` defines 7 stories: P1 fixed quote, P1 variable authority, P1 history/status, P1 delivery gate, P1 queue, P2 returns, and P2 administration.

## Format

- [ ] `T###` identifies execution order.
- `[P]` means parallelizable after listed prerequisites.
- `[US#]` maps a task to a user story; setup/foundational tasks have no story label.
- Every task names an exact file path.

## Dependency graph

```text
T001-T006 (setup) -> T007-T012 (foundation)
T007-T012 -> US1
US1 -> US2 -> US3
US1 + US3 -> US4
US3 -> US5
US2 + US3 -> US6
US1 + US2 + US3 -> US7
All stories -> Polish and consistency review
```

## Phase 1: Setup

- [X] T001 Create `prisma/schema/pricing.prisma` with `PricingUnit`, `PricingMode`, `PriceSource`, `PricingStatusValue`, `CustomerRuleKind`, and `PriceConfigStatus` enums plus ProductPricingPolicy, PriceList, PriceTier, CustomerPricingRule, WorkItemPrice, and PricingStatus models exactly per `data-model.md`.
- [X] T002 Add required relations from `prisma/schema/core.prisma`, `prisma/schema/customer.prisma`, and `prisma/schema/identity.prisma` to the new pricing models without redefining ProductType or Customer ownership.
- [X] T003 Add Decimal, effective-date, tier, pending-queue, and current-price indexes/constraints in `prisma/schema/pricing.prisma`; document any database-only non-overlap constraint that cannot be expressed by Prisma. Depends on T001.
- [ ] T004 **ACTION REQUIRED: blocked, do not run unattended.** Create and apply the additive Prisma migration at `prisma/migrations/20260924170000_pricing/migration.sql` containing the pricing tables, indexes, constraints, ProductPricingPolicy, and append-only SQL required by `data-model.md`. Confirm with the schema owner before applying it to any shared database; do not substitute `db push`. Depends on T001-T003.
- [ ] T005 Verify `prisma/migrations/20260924170000_pricing/migration.sql` replays successfully in a fresh database and preserves append-only permissions and effective-date/tier constraints. Depends on T004.
- [X] T006 [P] Add/coordinate pricing permission vocabulary in `src/server/auth/permissions.ts`, role seeds in `prisma/seed.ts`, and `tests/contract/role-permission-matrix.test.ts`; preserve `pricing.use_fixed`, `pricing.set_variable`, and `pricing.override` unless 001 approves a documented change.

## Phase 2: Foundational

- [X] T007 Create `src/server/pricing/index.ts` as the barrel-only public surface and add the repository import restriction for `src/server/pricing/**` in `eslint.config.js`.
- [X] T008 [P] Implement `src/server/pricing/errors.ts` with typed errors from `contracts/pricing-service.md`, including forbidden, invalid dimensions/amount, missing price, stale spec, and dispute failures.
- [X] T009 [P] Implement `src/server/pricing/calculation.ts` with pure Decimal unit conversion, area/linear calculation, tier matching, customer-rule arithmetic, tax-inclusive semantics, and nearest-whole-EGP final rounding.
- [X] T010 [P] Add `tests/unit/pricing/calculation.test.ts` covering cm/m conversion, all five units, area multiplication, invalid dimensions, Decimal precision, and final rounding.
- [X] T011 [P] Add `tests/unit/pricing/tiers-and-dates.test.ts` covering inclusive 9/10/50 boundaries, effective-from/to semantics, expired rules, overlapping configuration rejection, and deterministic equal-precedence failure.
- [X] T012 Implement `src/server/pricing/ports.ts` and the foundational persistence/binding pieces in `src/server/pricing/status.ts` for independent PricingStatus, pendingSince, responsible-user resolution, and fail-closed PricingGatePort defaults. Query functions are completed in T020.

**Checkpoint**: Foundation is ready when pure calculations, schema validation, permissions, and the fail-closed port compile and pass their focused tests. No user-story implementation starts before this checkpoint.

## Phase 3: User Story 1 - Explain a standard price (P1)

**Goal**: A fixed quote selects the correct list/tier/customer rule and returns a complete server-produced explanation.

**Independent test**: `tests/integration/pricing/quote.test.ts` proves default list, customer fixed price, percentage discount, expired rule, tier boundaries, and full breakdown.

- [X] T013 [P] [US1] Implement `src/server/pricing/quote.ts` to load 011 WorkItem/ProductType and 010 Customer data, resolve active price configuration by date, and return `QuoteResult` from `contracts/pricing-service.md` without writing.
- [ ] T014 [US1] Add `tests/integration/pricing/quote.test.ts` for ABC at 90 EGP/m, other customers at 100 EGP/m, expired-rule fallback, quantities 9/10/50, and tax-inclusive whole-EGP output.
- [ ] T015 [US1] Add `tests/contract/pricing/quote-breakdown.test.ts` asserting every breakdown field is present when applicable and Decimal values cross the boundary as canonical strings.

## Phase 4: User Story 2 - Set variable prices safely (P1)

**Goal**: Fixed application, variable pricing, and overrides enforce permissions and reasons while writing history atomically.

**Independent test**: `tests/integration/pricing/set-price.test.ts` calls the server service as Reception, a variable-pricing user, and an override user.

- [X] T016 [P] [US2] Implement `src/server/pricing/authorization.ts` with operation-to-permission mapping and server-side actor checks.
- [X] T017 [US2] Implement `src/server/pricing/prices.ts` with `setPrice`, append-only WorkItemPrice insertion, current status update, spec-version association, and audit ordering from `contracts/authorization-audit.md`.
- [ ] T018 [US2] Add `tests/integration/pricing/set-price.test.ts` proving Reception can apply FIXED, cannot set VARIABLE, authorized users can set VARIABLE, unauthorized overrides fail, reasons are mandatory, and failed operations write neither price nor audit.
- [ ] T019 [US2] Add `tests/contract/pricing/price-history-append-only.test.ts` proving prior amounts/sources/reasons remain unchanged after later price decisions.

## Phase 5: User Story 3 - Preserve price decisions and status (P1)

**Goal**: Staff can inspect current and historical price decisions and independent pending/disputed state.

**Independent test**: `tests/integration/pricing/history-status.test.ts` applies multiple decisions, changes status, and verifies history and pending timestamps.

- [ ] T020 [P] [US3] Complete the `status(workItemId)` and `pendingSince(workItemId)` query functions in `src/server/pricing/status.ts` with current-spec validity checks, building on T012's foundational status persistence and binding.
- [X] T021 [US3] Implement `src/server/pricing/history.ts` for current/history queries, breakdown retrieval, source/actor/reason display data, and disputed state handling.
- [ ] T022 [US3] Add `tests/integration/pricing/history-status.test.ts` proving independent status during IN_PRODUCTION, DISPUTED unresolved behavior, waitingSince persistence, and readable history.
- [ ] T023 [US3] Add `src/server/pricing/change-listener.ts` registering `pricing.reset` with 016; use the supplied transaction, clear current price, set PENDING, and audit the reset.
- [ ] T024 [US3] Add `tests/contract/pricing/spec-change-reset.test.ts` proving successful reset, unchanged historical prices, no nested transaction/external I/O, and rollback when the listener fails.

## Phase 6: User Story 4 - Block unresolved delivery (P1)

**Goal**: 015's delivery transition fails closed for any required unpriced item while production remains available.

**Independent test**: `tests/integration/pricing/delivery-gate.test.ts` starts production with PENDING pricing, rejects delivery, then prices the item and permits the existing delivery transition.

- [ ] T025 [US4] Complete the `PricingGatePort` provider in `src/server/pricing/delivery-port.ts` with batched committed reads, current-spec validation, PENDING/DISPUTED mapping, responsible users, and no workflow writes.
- [ ] T026 [US4] Add `tests/integration/pricing/delivery-gate.test.ts` for one pending item, all priced items, disputed items, urgent jobs, missing provider fail-closed behavior, and production-before-pricing.
- [ ] T027 [US4] Add `tests/contract/pricing/delivery-port.test.ts` asserting 051 binds 015's port and does not register a duplicate `READY_FOR_COLLECTION -> DELIVERED` guard.

## Phase 7: User Story 5 - Pricing queue (P1)

**Goal**: Pricing users receive an age-ordered queue with deterministic server-rendered age.

**Independent test**: `tests/integration/pricing/queue.test.ts` creates pending items with different timestamps/priorities and verifies ordering, exclusion, age, and permission behavior.

- [X] T028 [P] [US5] Implement `src/server/pricing/queue.ts` with cursor pagination, urgent-first ordering followed by oldest waiting timestamp within each priority group, responsible pricing user data, and server-time age formatting.
- [ ] T029 [US5] Add `src/components/pricing/pricing-panel.tsx` implementing `<PricingPanel workItemId>` as display/action composition over server contracts; do not calculate prices in the component.
- [ ] T030 [US5] Add `src/components/pricing/pricing-queue.tsx` and the pricing queue route under `src/app/(shell)/pricing/`, using RTL shell conventions and server authorization.
- [ ] T031 [US5] Add `tests/integration/pricing/queue.test.ts` for all PENDING rows, urgent-first ordering with oldest-first ordering within each priority group, age labels, priced-row exclusion, and forbidden access.

## Phase 8: User Story 6 - Pricing-originated returns (P2)

**Goal**: Wrong-price returns reuse 013's Return model and remain distinguishable from design failures.

**Independent test**: `tests/integration/pricing/returns.test.ts` creates and reads a Pricing-originated `PRICING_ISSUE` return.

- [X] T032 [P] [US6] Implement `src/server/pricing/returns.ts` composing 013 `createReturnInTx` with Pricing origin, `PRICING_ISSUE`, required explanation, assignee, and no DesignVersion.
- [ ] T033 [US6] Add `tests/integration/pricing/returns.test.ts` proving category/origin, required explanation, actor/assignee/timestamp, authorization, and transaction rollback.

## Phase 9: User Story 7 - Admin price configuration (P2)

**Goal**: Administrators maintain historical price lists and customer special-pricing rules.

**Independent test**: `tests/integration/pricing/configuration.test.ts` creates, retires, and queries effective/historical configuration.

- [ ] T034 [P] [US7] Implement `src/server/pricing/configuration.ts` for ProductPricingPolicy mode configuration, price-list/tier and customer-rule create/retire operations, overlap validation, `admin.config` authorization, and audit events.
- [ ] T035 [US7] Add `src/app/(shell)/pricing/price-lists/page.tsx` and server actions for list/tier administration; never mutate historical commercial values.
- [ ] T036 [US7] Add the customer profile special-pricing tab in the 010 customer route/component slot, reading 051 rules through the public barrel.
- [ ] T037 [US7] Add `tests/integration/pricing/configuration.test.ts` for ProductPricingPolicy FIXED/VARIABLE changes, effective dates, tier overlap, rule precedence, retirement history, authorization, and audit.

## Phase 10: Polish and cross-cutting validation

- [ ] T038 [P] Add `tests/contract/pricing/public-barrel.test.ts` and update `eslint.config.js` so external code can import only `~/server/pricing`.
- [ ] T039 [P] Add Arabic/RTL message keys in `src/messages/ar.json` for statuses, sources, queue age, errors, and breakdown labels without moving calculation into the UI.
- [ ] T040 [P] Add `tests/integration/pricing/audit-coverage.test.ts` proving every accepted price change, reset, configuration mutation, and pricing return has an audit event.
- [ ] T041 Add `tests/performance/pricing/latency.test.ts` for the documented p95 targets, then run `pnpm exec prisma validate --schema prisma/schema`, `pnpm check`, and the focused pricing Vitest suites; record any pre-existing warnings separately.
- [ ] T042 Run the spec-kit consistency analysis across `spec.md`, `plan.md`, and `tasks.md`; resolve all critical coverage, terminology, and constitution findings in the docs before implementation begins.
- [ ] T043 **ACTION REQUIRED: blocked, do not run unattended.** After schema-owner approval, apply the final Prisma migration, seed approved permissions/rates, run the quickstart scenarios in `quickstart.md`, and attach evidence to the implementation PR.

## Parallel opportunities

- T006 can proceed in parallel with the schema setup after the permission vocabulary is agreed; T003 and T005 are sequential schema/migration tasks.
- T008-T011 are parallel after the schema contract is frozen.
- T013-T015, T016-T019, and T020-T024 can be split by service/test ownership after foundational work; US2 and US3 must complete before returns/configuration integration.
- UI tasks T029-T030 and configuration UI T035-T036 can proceed in parallel with their server contracts.

## Implementation strategy

1. Land the schema, Decimal calculation core, and quote path first.
2. Add authorized manual pricing and immutable history.
3. Bind delivery/reset contracts before building queue/admin surfaces.
4. Finish returns, admin configuration, UI, and cross-cutting audit checks.
5. Do not seed guessed commercial rates; wait for owner-supplied ProductType/unit data.
