---

description: "Task list template for feature implementation"
---

# Tasks: Customer Finding & Management

**Input**: Design documents from `/specs/010-customers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included because the specification defines unit, integration, performance, authorization, audit, and acceptance criteria.

**Organization**: Tasks grouped by user story for independently testable increments.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish customer-specific source paths and schema migration scaffolding.

- [ ] T001 [P] Add customer server/component/test directories per `specs/010-customers/plan.md` under `src/server/customers/`, `src/components/customers/`, `src/app/(shell)/customers/`, and `tests/`.
- [ ] T002 [P] Add `prisma/schema/customer.prisma` for `CustomerPhone`, `CustomerAddress`, `CustomerClassification`, and `CustomerPromotion` only; extend `Customer` exclusively in `prisma/schema/core.prisma` while preserving the existing `Customer`/`Order` relation.
- [ ] T003 [P] Add customer test helpers and fixtures in `tests/fixtures/customers.ts` for canonical phones, Arabic name variants, archived records, Cash Customer, and 50,000-customer search data.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation, normalization, authorization, and audit seams required by every story.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T004 Implement Egyptian phone normalization in `src/server/customers/normalizePhone.ts`: accept `01xxxxxxxxx`, `+201xxxxxxxxx`, and `00201...` with spaces/dashes; return one canonical E.164 value or a structured validation error.
- [X] T005 [P] Implement Arabic customer-name normalization in `src/server/customers/normalizeName.ts`: map `أ/إ/آ` to `ا`, treat `ة/ه` as equivalent, treat `ى/ي` as equivalent, strip tashkeel, and preserve the display name separately.
- [X] T006 [P] Define customer input/query schemas in `src/server/customers/schemas.ts`: require `name` and one primary phone; support alternate phones, national ID, multiple addresses, notes, and configurable classification; bound search limit/query length.
- [ ] T007 [P] Add customer-specific typed error codes/details in `src/server/core/errors.ts` only where existing `VALIDATION`/`FORBIDDEN` errors cannot represent duplicate phone, immutable Cash Customer, archived selection, or promotion conflicts.
- [ ] T008 Implement customer authorization/audit adapters in `src/server/customers/authorization.ts` and `src/server/customers/audit.ts`, consuming feature 001's `authorize('customer.manage')` and append-only `audit.record` contracts; ensure failed mutations leave no partial changes and add no replacement audit storage.
- [X] T009 Define the complete customer schema in `prisma/schema/core.prisma` and `prisma/schema/customer.prisma`: extend `Customer` only in `core.prisma`; add related phone, address, classification, and promotion models in `customer.prisma` with required relations, unique canonical phones, and search indexes.
- [ ] T010 Create the Prisma migration in `prisma/migrations/` after T009; include normalized names, phones, addresses, classifications, archive state, promotion records, unique phone constraints, search indexes, and documented backup scope.
- [X] T011 Run `pnpm db:generate` (which executes `prisma migrate dev`) to apply development migrations and generate the Prisma client; verify the migrated schema preserves every existing Order's non-null Customer relation in `tests/integration/customers/schema.integration.test.ts`.

**Checkpoint**: Foundation ready; user stories can proceed independently.

---

## Phase 3: User Story 1 - Find the Customer During Intake (Priority: P1) 🎯 MVP

**Goal**: Reception can find active customers by any stored phone or normalized Arabic name with fast, bounded results.

**Independent Test**: With seeded primary/alternate phones and Arabic variants, all supported phone forms and normalized names return the intended active customer; 95% of 50,000-customer phone searches complete under 300 ms.

### Tests for User Story 1

- [ ] T012 [P] [US1] Add unit tests in `tests/unit/customers/normalizePhone.test.ts` for local, `+20`, `0020`, spaces, dashes, invalid prefixes, invalid lengths, and canonical E.164 output.
- [ ] T013 [P] [US1] Add unit tests in `tests/unit/customers/normalizeName.test.ts` for `أ/إ/آ`, `ة/ه`, `ى/ي`, tashkeel removal, and display-name preservation.
- [ ] T014 [P] [US1] Add service/integration tests in `tests/integration/customers/findCustomers.test.ts` for primary/alternate full and partial phone matching, name fallback, archived exclusion, bounded results, and duplicate-safe search behavior.
- [ ] T015 [P] [US1] Add the 50,000-customer benchmark in `tests/performance/customers/search.bench.test.ts` and assert at least 95% of representative phone searches complete under 300 ms.

### Implementation for User Story 1

- [X] T016 [US1] Implement `findCustomers(query)` in `src/server/customers/service.ts` using normalized phone first, normalized Arabic name fallback, active-only default filtering, authorized archived search, and bounded results.
- [X] T017 [US1] Expose `findCustomers` and `normalizePhone` from `src/server/customers/index.ts` with the repository's typed `Result`/action boundary shape and the contract in `specs/010-customers/contracts/customer-service.md`.
- [ ] T018 [US1] Add the customer search server route/action in `src/app/api/customers/search/route.ts` or the repository's established server-action boundary, including authentication, `authorize('customer.manage')`, schema validation, and typed errors.

**Checkpoint**: Phone/name lookup is independently usable and benchmarked.

---

## Phase 4: User Story 2 - Create and Maintain a Customer Record (Priority: P1)

**Goal**: Authorized staff can create/edit/archive customers with optional details, configurable classification, and complete before/after audit history.

**Independent Test**: Create a customer, edit each supported field, verify audit before/after values, archive it, confirm default search hides it, and retrieve it through authorized history without deletion.

### Tests for User Story 2

- [ ] T019 [P] [US2] Add create/update validation tests in `tests/integration/customers/create-update.test.ts` for required name/primary phone, alternate phones, national ID, multiple addresses, notes, classification, no partial writes, and canonical persistence.
- [ ] T020 [P] [US2] Add duplicate/concurrency tests in `tests/integration/customers/duplicate-phone.test.ts` proving an equivalent existing phone shows the existing customer and hard-blocks the second create under concurrent attempts.
- [ ] T021 [P] [US2] Add audit contract tests in `tests/integration/customers/audit-contract.test.ts` proving every edit calls feature 001's append-only `audit.record` with actor, timestamp, entity ID, before/after values, and no replacement audit table.
- [ ] T022 [P] [US2] Add archive/permission tests in `tests/integration/customers/archive-permissions.test.ts` proving Reception can edit all fields except archive/promotion, Admin can archive, archived records remain in history, and hard delete is unavailable.
- [ ] T023 [P] [US2] Add classification configuration tests in `tests/integration/customers/classifications.test.ts` proving starter values are data rows, Admin can create/update/deactivate classifications, and inactive values remain on historical customers but cannot be newly selected.

### Implementation for User Story 2

- [ ] T024 [P] [US2] Seed configurable classification rows Individual, Company, Agency, and VIP in `prisma/seed.ts`, preserving inactive historical classifications and never introducing a classification enum.
- [X] T025 [US2] Implement `createCustomer(input)`, `getCustomer(id)`, update, and archive operations in `src/server/customers/service.ts` with normalization, hard duplicate blocking, validation, atomic audit writes through feature 001, and clarified Reception/Admin permissions.
- [ ] T026 [US2] Implement classification query/configuration operations in `src/server/customers/classifications.ts`: `findClassifications`, `createClassification`, `updateClassification`, and `deactivateClassification`; require Admin authorization for configuration mutations.
- [ ] T027 [US2] Add customer mutation/profile server boundaries in `src/app/api/customers/route.ts` and `src/app/api/customers/[id]/route.ts`, including auth, authorization, validation, and no-partial-write behavior.
- [ ] T028 [US2] Add classification configuration boundaries in `src/app/api/customer-classifications/route.ts` and `src/app/api/customer-classifications/[id]/route.ts` with Admin-only mutation checks.
- [ ] T029 [US2] Implement the customer profile route in `src/app/(shell)/customers/[id]/page.tsx` with Overview, active/completed Orders, Notes, and empty extension slots for 051/052/054.
- [ ] T030 [US2] Add customer list/create/edit/archive UI in `src/app/(shell)/customers/page.tsx` and `src/components/customers/customer-form.tsx`, preserving Arabic RTL and logical directional styles.

**Checkpoint**: Customer lifecycle and configurable classification are independently testable with audit and archive guarantees.

---

## Phase 5: User Story 3 - Use the Cash Customer Safely (Priority: P1)

**Goal**: Walk-in orders use one immutable Cash Customer; selected cash orders can be promoted to a real customer with audited Admin reversal.

**Independent Test**: Cash Customer edit/rename/archive/merge attempts fail server-side; multiple cash orders stay individually identifiable; selected promotion links and Admin reversal are audited; reversal rejects if any selected order changed customer after promotion.

### Tests for User Story 3

- [ ] T031 [P] [US3] Add Cash Customer immutability tests in `tests/integration/customers/cash-customer.test.ts` for edit, rename, archive, merge rejection and continued order-history visibility.
- [ ] T032 [P] [US3] Add promotion tests in `tests/integration/customers/promotion.test.ts` for creating the real customer, selecting only chosen orders, preserving unrelated Cash Customer orders, auditing, Admin reversal, and all-or-nothing conflict rejection when a selected Order was reassigned after promotion.

### Implementation for User Story 3

- [ ] T033 [US3] Update `prisma/seed.ts` to idempotently seed exactly one immutable Cash Customer and reject duplicate seed records without modifying existing operational orders.
- [ ] T034 [US3] Implement Cash Customer guards and promotion/reversal services in `src/server/customers/promotion.ts`, including explicit order selection, atomic audited re-link, Admin-only reversal, conflict precondition requiring every selected Order still belongs to the promoted customer, and no merge operation.
- [ ] T035 [US3] Add promotion and protected-record server boundaries in `src/app/api/customers/promote/route.ts` and `src/app/api/customers/[id]/route.ts`, returning typed forbidden/immutable/conflict errors.
- [ ] T036 [US3] Add Cash Customer history and promotion controls in `src/components/customers/cash-customer.tsx` and `src/app/(shell)/customers/cash/page.tsx`, showing individually identifiable orders and explicit selected-order confirmation.

**Checkpoint**: Cash Customer and promotion workflow are independently auditable and reversible.

---

## Phase 6: User Story 4 - Review a Customer Profile and Select from Order Intake (Priority: P2)

**Goal**: Staff can use the reusable keyboard-friendly CustomerPicker and profile extension slots from order intake.

**Independent Test**: Search/select/create via keyboard, receive `customerId` exactly once, verify loading/empty/error states plus three reserved slots, and complete at least 90% of representative first-attempt flows within 30 seconds.

### Tests for User Story 4

- [ ] T037 [P] [US4] Add CustomerPicker interaction tests in `tests/components/customers/customer-picker.test.tsx` for search, result navigation, Enter selection, inline creation, duplicate block, loading, empty, validation, unauthorized, and server-error states.
- [ ] T038 [P] [US4] Add profile contract tests in `tests/components/customers/customer-profile.test.tsx` for Overview, Orders active/completed, Notes, three empty extension slots, RTL semantics, and keyboard accessibility.
- [ ] T039 [P] [US4] Add timed CustomerPicker usability validation in `tests/components/customers/customer-picker.usability.test.tsx` proving at least 90% of representative first-attempt search/select/create flows complete within 30 seconds.

### Implementation for User Story 4

- [X] T040 [US4] Implement `<CustomerPicker onSelect>` in `src/components/customers/customer-picker.tsx` with Arabic RTL search, bounded results, listbox keyboard behavior, inline create, and exactly-once `customerId` callback.
- [X] T041 [US4] Implement profile slot composition in `src/components/customers/profile-slots.tsx` and integrate it into `src/components/customers/customer-profile.tsx` for `payments-balance`, `special-pricing`, and `messages`.
- [ ] T042 [US4] Add the order-entry integration adapter contract in `src/components/customers/index.ts` and document consumption example in `specs/010-customers/contracts/customer-picker.md` without implementing order creation.

**Checkpoint**: 011 can consume the picker and profile slots without customer-internal dependencies.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify all stories, harden security/performance, and validate published contracts.

- [ ] T043 [P] Add end-to-end acceptance coverage from `specs/010-customers/quickstart.md` in `tests/integration/customers/quickstart.test.ts`.
- [ ] T044 [P] Add server authorization regression coverage in `tests/integration/customers/authorization.test.ts` for every customer entry point and Cash Customer mutation.
- [ ] T045 [P] Add query/index performance diagnostics and bounded-result safeguards in `src/server/customers/service.ts` for the 50,000-customer target.
- [ ] T046 [P] Review Arabic RTL/accessibility behavior in `src/components/customers/` and `src/app/(shell)/customers/`, replacing directional left/right styling with logical start/end properties.
- [ ] T047 Run `pnpm check`, `pnpm test`, database migration/seed validation, and the complete quickstart from `specs/010-customers/quickstart.md`; record outcomes in the implementation PR.
- [ ] T048 Update `specs/010-customers/contracts/`, `specs/010-customers/data-model.md`, and `specs/010-customers/quickstart.md` if implementation decisions change published behavior.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) precedes Foundational (Phase 2).
- Foundational (Phase 2) blocks all user stories.
- T009 defines all customer schema models; T010 creates the migration only afterward; T011 validates the generated client and existing Order relation.
- User Stories 1, 2, and 3 are P1. US1 can proceed after Phase 2. US2 depends on the schema/service foundation from Phase 2 and US1's search service. US3 depends on the Customer/Order schema and customer creation service. They can proceed in parallel once those explicit dependencies are complete.
- User Story 4 is P2 and depends on `findCustomers`/`createCustomer` contracts and profile data from US1/US2.
- Polish depends on all desired stories.

### User Story Dependencies

- **US1**: Foundational only; MVP.
- **US2**: Foundational plus shared schema and service seams; independently testable after T009-T018.
- **US3**: Foundational plus Customer/Order relations and create service from US2.
- **US4**: Foundational plus `findCustomers`/`createCustomer` contracts and profile data from US1/US2.

### Parallel Opportunities

- T001-T003 can run in parallel.
- T005-T008 can run in parallel after path setup; T009 must complete before T010/T011.
- US1 normalization/search tests can run in parallel; US2 audit/permission/classification tests can run in parallel; US3 immutability/promotion tests can run in parallel; US4 picker/profile/usability tests can run in parallel.
- Different story teams can work in parallel after shared schema/service seams are agreed.
- Polish test, accessibility, and contract documentation tasks can run in parallel.

## Parallel Example: User Story 1

```text
Task: T012 Normalize-phone unit tests in tests/unit/customers/normalizePhone.test.ts
Task: T013 Arabic-name unit tests in tests/unit/customers/normalizeName.test.ts
Task: T014 Search integration tests in tests/integration/customers/findCustomers.test.ts
Task: T015 50,000-customer benchmark in tests/performance/customers/search.bench.test.ts
```

## Parallel Example: User Story 2

```text
Task: T019 Create/update validation tests in tests/integration/customers/create-update.test.ts
Task: T020 Duplicate concurrency tests in tests/integration/customers/duplicate-phone.test.ts
Task: T021 Audit contract tests in tests/integration/customers/audit-contract.test.ts
Task: T022 Archive/permission tests in tests/integration/customers/archive-permissions.test.ts
Task: T023 Classification configuration tests in tests/integration/customers/classifications.test.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation and migration.
3. Complete US1 normalization, search service, server boundary, and tests.
4. Stop and validate phone/name lookup and the 50,000-customer benchmark.

### Incremental Delivery

1. Add US2 customer lifecycle, audit, archive, classification configuration, and profile.
2. Add US3 Cash Customer protection and selective promotion.
3. Add US4 reusable picker, usability validation, and extension-slot integration.
4. Run Phase 7 hardening and quickstart validation.

### Parallel Team Strategy

1. One owner completes schema/normalization foundation.
2. After the foundation, one owner handles search/lifecycle/classification services, one handles Cash Customer promotion, and one handles profile/picker UI.
3. Integrate through the published contracts; no order-creation implementation belongs in this feature.

## Notes

- Every task uses the required `- [ ] T### [P?] [Story?] description with file path` format.
- `CustomerPhone.phoneE164` is unique across customers; duplicate creation is hard-blocked.
- Customer merging is explicitly excluded from V1.
- Every edit/archive/promotion/reversal must remain server-authorized and audited through feature 001's append-only audit contract.
- Promotion reversal is all-or-nothing and rejects if any selected Order changed customer after promotion.
