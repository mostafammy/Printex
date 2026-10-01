# Tasks: Order Production Workflow

**Input**: Design documents from `/specs/093-order-production-workflow/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/
**Tests**: Included — explicitly required by spec (width vector, pricing, finishing, forbidden transitions, server-path bypass).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project init, env, constitution amendment scaffolding

- [ ] T001 Add Supabase server env vars + startup validation in src/env.js
- [ ] T002 [P] Add @supabase/supabase-js dependency via pnpm in package.json
- [ ] T003 [P] Draft Constitution VII amendment + 050 revision note in specs/093-order-production-workflow/amendment-vii.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, canonical services, transition authority, storage backend — MUST complete before any story

- [ ] T004 Create additive Prisma migration for WorkItem snapshot columns in prisma/schema/core.prisma
- [ ] T005 [P] Create FinishingService model in prisma/schema/pricing.prisma
- [ ] T006 [P] Create WorkItemFinishing model in prisma/schema/pricing.prisma
- [ ] T007 [P] Create WidthExceptionTicket model in prisma/schema/core.prisma
- [ ] T008 Seed ROLL constraints + Sulfan rate in prisma/seed.ts
- [ ] T009 Implement resolveProductionWidth() pure function in src/server/pricing/widths.ts
- [ ] T010 [P] Implement roll quote math (area/base/finishing/total) in src/server/pricing/roll-quote.ts
- [ ] T011 [P] Implement SupabaseStorageAdapter in src/server/files/supabase-adapter.ts
- [ ] T012 Extend transitionWorkItem() with pipeline guards in src/server/core/transitions.ts
- [ ] T013 Add pipeline Zod schemas (dimensions/rates/tickets) in src/server/orders/pipeline-schemas.ts

**Checkpoint**: Foundation ready — stories can now begin

---

## Phase 3: User Story 1 - Reception creates priced, designer-assigned job (Priority: P1) 🎯 MVP

**Goal**: Reception enters customer width/height/rate/finishing, sees requested→production preview + totals, assigns designer, releases NEW→ASSIGNED.

**Independent Test**: Width vector 75→80 … 320→320, >320 ticketed; 145cm×2m @100+Sulfan = 570; release without designer refused server-side.

### Tests for User Story 1

- [ ] T014 [P] [US1] Unit tests for width vector in tests/unit/width-rounding.test.ts
- [ ] T015 [P] [US1] Unit tests for area/base/finishing totals in tests/unit/roll-pricing.test.ts
- [ ] T016 [P] [US1] Contract test for quote + assignment gate in tests/contract/pipeline-us1.test.ts

### Implementation for User Story 1

- [ ] T017 [P] [US1] Implement persistQuote() snapshot writer in src/server/pricing/roll-quote.ts
- [ ] T018 [P] [US1] Implement WidthExceptionTicket create/decide in src/server/orders/width-exceptions.ts
- [ ] T019 [US1] Implement reception create + release endpoint in src/server/orders/pipeline.ts (depends on T017, T018)
- [ ] T020 [US1] Build reception entry UI with rounding preview in src/app/reception/page.tsx
- [ ] T021 [US1] Add designer-assignment control + release action in src/app/reception/page.tsx

**Checkpoint**: US1 fully functional and independently testable

---

## Phase 4: User Story 2 - Designer completes only via file upload (Priority: P1)

**Goal**: Assigned designer works queue, uploads via Supabase backend, completes IN_DESIGN→DESIGN_COMPLETED only with valid file version.

**Independent Test**: File-less submit refused; failed upload refused; double submit refused; DESIGNER→PRINTER refused.

### Tests for User Story 2

- [ ] T022 [P] [US2] Contract test for file gate + completion in tests/contract/pipeline-us2.test.ts
- [ ] T023 [P] [US2] Integration test for upload→complete flow in tests/integration/pipeline-093.test.ts

### Implementation for User Story 2

- [ ] T024 [US2] Implement designer completion guard using files.upload() in src/server/core/transitions.ts
- [ ] T025 [P] [US2] Build designer queue scoped to assignee in src/app/designer/page.tsx
- [ ] T026 [US2] Tie upload-to-completion action in src/app/designer/page.tsx (depends on T024)

**Checkpoint**: US1 + US2 work independently

---

## Phase 5: User Story 3 - Accountant verifies and approves straight to print (Priority: P1)

**Goal**: Accountant sees full breakdown + file, approves DESIGN_COMPLETED→WAITING_PRICING→READY_FOR_PRODUCTION; no branding/content stage.

**Independent Test**: Valid approval lands in the printer queue; incomplete item refused; non-accountant approval refused server-side.

### Tests for User Story 3

- [ ] T027 [P] [US3] Contract test for approval gate + bypass refusal in tests/contract/pipeline-us3.test.ts

### Implementation for User Story 3

- [ ] T028 [US3] Implement accountant approval guard (WAITING_PRICING→READY_FOR_PRODUCTION) in src/server/core/transitions.ts
- [ ] T029 [P] [US3] Set requiresReview=false for ROLL-class items at creation in src/server/orders/pipeline.ts
- [ ] T030 [P] [US3] Build accountant verification queue + breakdown panel in src/app/accountant/page.tsx

**Checkpoint**: US1–US3 independently functional

---

## Phase 6: User Story 4 - Printer receives only accountant-approved work (Priority: P2)

**Goal**: Printer queue contains only accountant-approved items in the operator's own department, with production dimensions, finishing, and approved file.

**Independent Test**: Approved item appears in printer queue; earlier-stage items invisible and refused by direct ID; draft file never downloadable.

### Tests for User Story 4

- [ ] T031 [P] [US4] Contract test for printer scoping + approved-file-only access in tests/contract/pipeline-us4.test.ts

### Implementation for User Story 4

- [ ] T032 [P] [US4] Build printer department queue with approved-file-only download in src/app/production/page.tsx
- [ ] T033 [P] [US4] Add revised-file badge + acknowledge flow in src/app/production/page.tsx

**Checkpoint**: Full forward pipeline works end-to-end

---

## Phase 7: User Story 5 - Controlled rework (Priority: P2)

**Goal**: Corrections via shared Return model (origin/category/reason/assignee) + Void/Cancel; post-approval edits follow change control with pricing reset.

**Independent Test**: Return creates record, moves item, notifies designer; reason-less return fails; direct backward write refused.

### Tests for User Story 5

- [ ] T034 [P] [US5] Contract test for returns + cancel/reopen in tests/contract/pipeline-us5.test.ts

### Implementation for User Story 5

- [ ] T035 [US5] Implement return/cancel edges via Return model in src/server/core/transitions.ts
- [ ] T036 [P] [US5] Wire SPEC_CHANGED pricing reset listener in src/server/pricing/status.ts
- [ ] T037 [P] [US5] Add return/cancel UI with reason fields in src/app/accountant/page.tsx

**Checkpoint**: All stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, hardening, docs

- [ ] T038 [P] Forbidden-edge sweep test (all bypass attempts) in tests/contract/pipeline-forbidden.test.ts
- [ ] T039 [P] Run quickstart validation per specs/093-order-production-workflow/quickstart.md
- [ ] T040 [P] Backup scope update for Supabase objects in specs/091-deploy-backup/scope-update.md
- [ ] T041 [P] Write stakeholder storyboard walkthrough in specs/093-order-production-workflow/storyboard.md
- [ ] T042 Run pnpm check (lint + typecheck) and fix findings
- [ ] T043 Arabic RTL + queue-latency review across src/app/reception/page.tsx, src/app/designer/page.tsx, src/app/accountant/page.tsx, src/app/production/page.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all stories
- **User Stories (Phases 3–7)**: Depend on Foundational; run in priority order P1 (US1→US2→US3) then P2 (US4→US5), or in parallel if staffed
- **Polish (Phase 8)**: Depends on all desired stories

### User Story Dependencies

- **US1 (P1)**: After Foundational; no story dependencies
- **US2 (P1)**: After Foundational + US1 endpoints (file gate builds on released items) but testable with seeded items
- **US3 (P1)**: After US2-shaped items; independently testable via seeded DESIGN_COMPLETED items
- **US4 (P2)**: After US3-shaped items; printer scoping independently testable
- **US5 (P2)**: Orthogonal; needs transition fn from Foundational only

### Within Each Story

- Tests FAIL before implementation; models → services → endpoints → UI; story complete before next priority

### Parallel Opportunities

- T002, T003; T005–T007, T010–T011; all [P] test tasks; T017–T018; T029–T033; T036–T037; T038–T041
- Stories can parallelize post-Foundational with seeded fixtures

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together:
Task: "Unit tests for width vector in tests/unit/width-rounding.test.ts"
Task: "Unit tests for area/base/finishing totals in tests/unit/roll-pricing.test.ts"
Task: "Contract test for quote + assignment gate in tests/contract/pipeline-us1.test.ts"

# Launch US1 snapshot + exception paths together:
Task: "Implement persistQuote() snapshot writer in src/server/pricing/roll-quote.ts"
Task: "Implement WidthExceptionTicket create/decide in src/server/orders/width-exceptions.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational
2. Complete US1 (reception entry + pricing + assignment gate)
3. STOP and VALIDATE per US1 independent test
4. Deploy/demo

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test → demo (MVP)
3. US2 → US3 → test → demo (gated pipeline core)
4. US4 → US5 → test → demo (release + rework)
5. Polish → final validation

---

## Notes

- [P] = different files, no dependencies; [USn] maps to spec stories
- Quote verbatim constraints: widths [80,110,150,210,260,270,320] round-up; `0 < heightM ≤ 50`; `80 ≤ basePricePerM2 ≤ 120`; Sulfan 90 EGP/m²; Decimal money, whole-EGP final rounding; no hard deletes; signed URLs ≤300 s
- Commit after each task; stop at any checkpoint to validate independently
