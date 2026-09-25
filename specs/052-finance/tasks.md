---

description: "Task list for 052-finance — Payments, Expenses & Profitability"
---

# Tasks: Finance — Payments, Expenses & Profitability

**Input**: Design documents from `/specs/052-finance/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — the constitution requires automated tests for permission checks, audit event emission, and money/gate behavior; spec acceptance criteria (SC-001…SC-012) are test-shaped.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `prisma/`, `config/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature scaffold and configuration seeds

- [x] T001 Create finance module scaffold per plan.md structure: `src/server/finance/index.ts` (placeholder barrel), `src/components/finance/`, test dirs `tests/unit/finance/`, `tests/integration/finance/`, `tests/contract/finance/`
- [x] T002 [P] Create config seed `config/052-finance.yaml` with FinanceConfig defaults per data-model.md: paymentMethods (Cash, Card, Bank transfer, InstaPay, Vodafone Cash, Cheque), paymentSources (Reception desk, Bank, Delivery driver), expenseCategories (Material, External production, Transport, Maintenance, Supplies, Other — `{label, active}`), approvalThreshold, shopTimezone `Africa/Cairo` (FileConfig/YAML precedent: `config/050-files.yaml`)
- [x] T003 [P] Wire finance test include paths into `vitest.config.ts` so `tests/{unit,integration,contract}/finance/` are collected

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, immutability guarantees, config/time/money/ports infrastructure that EVERY story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create `prisma/schema/finance.prisma` with all models from data-model.md, quoting each constraint: `Payment` (amount `Decimal` "> 0", `method`/`source` string snapshots, `occurredAt` `<= now`, `receiptNumber` unique, `recordedById` required), `FinanceVoid` (`@@unique([entityType, entityId])`, `reason` non-empty, entityType enum `PAYMENT|EXPENSE|DIRECT_COST`), `Expense` (amount "> 0", `category` snapshot, optional `orderId`/`workItemId`, `employee` required), `ExpenseApproval` (`expenseId` **unique**), `DirectCost` (amount "> 0", `orderId` required, optional `workItemId`), `CustomerCredit` (`customerId` PK, `creditApproved` default false, `creditLimit` Decimal optional "> 0"), `FinanceConfig` (singleton `"finance-config"`, Json lists, `approvalThreshold`, `shopTimezone`)
- [x] T005 Create migration `prisma/schema/migrations/<timestamp>_finance/`: all finance tables, `receipt_sequence`, indexes from data-model.md (`payment(orderId)`, `payment(customerId)`, `payment(occurredAt)`, `expense(orderId)`, `expense(expenseDate)`, `direct_cost(orderId)`), CHECK constraints (amounts > 0, limit > 0), plus raw-SQL step `REVOKE UPDATE, DELETE ON payment, expense, direct_cost, finance_void, expense_approval FROM <app_role>` with verification query and the non-superuser app-role prerequisite documented (001 AuditEvent precedent — research.md)
- [x] T006 [P] Implement `src/server/finance/config.ts`: FinanceConfig singleton read (startup YAML seed merge) + Zod validation helpers `isActiveMethod`, `isActiveSource`, `isActiveCategory`, `getApprovalThreshold`, `getShopTimezone` + validated write helper gated by `admin.config` with `config.updated` audit (contracts/authorization-audit.md)
- [x] T007 [P] Implement `src/server/finance/money.ts`: decimal-string parse/validate (positive, no floating point — FR-026), Decimal addition/sum helpers for totals (constitution Money constraint)
- [x] T008 [P] Implement `src/server/finance/time.ts`: shop-local day bucketing — convert UTC `occurredAt` to `YYYY-MM-DD` via `shopTimezone`, plus calendar-date helpers for `expenseDate`/`costDate` (FR-027, SC-012)
- [x] T009 [P] Implement `src/server/finance/ports.ts` per contracts/finance-ports.md: `bindFinancialClosurePort` (default no-op logging `FINANCE_NOT_CONNECTED`, returns `{ closed: false }`), `bindCompensationReadPort` (default `async () => []`), bind-once guard throwing `PORT_ALREADY_BOUND`; NO compile-time import of `~/server/collection`
- [x] T010 Implement `src/server/finance/audit.ts`: audit action constants (`payment.recorded`, `payment.voided`, `expense.recorded`, `expense.voided`, `expense.approved`, `direct_cost.recorded`, `direct_cost.voided`, `credit.updated`, `config.updated`) + `requireReason` pre-audit validator per contracts/authorization-audit.md
- [x] T011 Freeze `src/server/finance/index.ts` barrel exporting the public surface (config, money, time, ports + `financeSummaryProvider` slot) consistent with `src/server/pricing/index.ts` style
- [x] T012 [P] Contract test `tests/contract/finance/ports.test.ts`: default closure port returns `{ closed: false }` without throwing, default compensation port returns `[]`, double-bind throws `PORT_ALREADY_BOUND`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Staff record a payment and see what the order owes (Priority: P1) 🎯 MVP

**Goal**: Record partial/full payments against a priced order; order finance panel shows Total · Paid · Remaining (server-computed, Decimal); delivery sees read-only summary via the port

**Independent Test**: Record a 400 EGP deposit then a 600 balance on a 1000 EGP priced order; Paid/Remaining update correctly; user without `payment.record` is refused; delivery projection returns the frozen shape

### Tests for User Story 1 (required — constitution: permissions + audit + money math)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T013 [US1] Integration test `tests/integration/finance/paymentRecord.test.ts`: SC-001 fixture — order Total 1000 (Work Items 600+400), record 400 → Paid 400 / Remaining 600; record 600 → Paid 1000 / Remaining 0; receipt number allocated; `payment.recorded` audit row committed atomically
- [x] T014 [US1] Integration test `tests/integration/finance/paymentAuthz.test.ts`: record without `payment.record` (Reception) → `FORBIDDEN` with no payment and no audit event; method/source not in active config → `VALIDATION` (`METHOD_NOT_CONFIGURED`/`SOURCE_NOT_CONFIGURED`); `occurredAt` in the future → `VALIDATION`
- [x] T015 [P] [US1] Contract test `tests/contract/finance/financeSummaryPort.test.ts`: `financeSummaryProvider.orderSummary` matches 015 contracts/ports.md §2 field-for-field (`status`, `currency: "EGP"`, Decimal `total/paid/remaining`, boolean `creditApproved`, `UNAVAILABLE` shape) and drops panel-only `pricingIncomplete`/`counts`

### Implementation for User Story 1

- [x] T016 [US1] Implement `recordPayment` in `src/server/finance/payments.ts` per contracts/finance-service.md: `getActor` → `authorize(payment.record)` → Zod (amount "> 0" decimal string, method/source ∈ active config, `occurredAt <= now`) → `nextval(receipt_sequence)` → insert Payment → `audit.record(tx, payment.recorded)` → COMMIT → post-commit closure port call (never inside tx)
- [x] T017 [US1] Implement `orderSummary` in `src/server/finance/summaries.ts` per contracts/finance-service.md: Total = Σ `051.getCurrentPrice(workItemId)` over non-cancelled Work Items; Paid = Σ non-void payments; Remaining = Total − Paid − compensation-port credits (may be ≤ 0); `creditApproved` = CustomerCredit flag && !isCashCustomer; `pricingIncomplete` flag; `UNAVAILABLE` variant for missing order
- [x] T018 [US1] Implement `financeSummaryProvider` in `src/server/finance/ports.ts`: delegate to `orderSummary`, project to the frozen 015 shape (strip `pricingIncomplete`, `counts`)
- [x] T019 [P] [US1] Create `src/components/finance/RecordPaymentDialog.tsx` per contracts/ui.md: amount decimal input, method/source selects from FinanceConfig with the first active option **preselected** (user can change; keeps FR-021's 3-interaction budget), occurred-at (default now, future blocked), optional note, 100% / 50% deposit presets that prefill but never auto-submit; client hints only — server is authority; Arabic-first RTL
- [x] T020 [US1] Create `src/components/finance/OrderFinancePanel.tsx` per contracts/ui.md: header (Total · Paid · Remaining · credit badge · pricing-incomplete notice), payments list (date/time, method, source, amount, recorder, note, receipt number, posted status), record-payment action; read-only mode for `finance.view`-only holders — backed by `listPayments` implemented in `src/server/finance/payments.ts` per contracts/queries.md (filters, `includeVoided` default false, cursor pagination)
- [x] T021 [US1] Wire panel into `src/app/(shell)/orders/[orderId]/page.tsx` — replace the `{S.placeholderPayments}` placeholder text with `<OrderFinancePanel orderId={...} />`
- [x] T022 [US1] Add server action `recordPaymentAction` in `src/app/(shell)/orders/[orderId]/finance-actions.ts`: Zod-form validation, error mapping (`FORBIDDEN`/`VALIDATION`), returns fresh summary for panel refresh

**Checkpoint**: US1 fully functional — payments record, summary computes, delivery port serves the frozen shape

---

## Phase 4: User Story 2 - Mistakes are fixed by voiding, never by editing (Priority: P1)

**Goal**: No update/delete path exists for payments; `payment.void` + mandatory reason voids a payment, keeps the original visible, excludes it from totals; audit on every void

**Independent Test**: Attempt every update/delete path → impossible; void with reason → original retained with void marker, Paid drops; void as Reception → refused; double void → refused

### Tests for User Story 2 (required — constitution: permissions + audit + append-only)

- [x] T023 [US2] Integration test `tests/integration/finance/paymentVoid.test.ts`: SC-002/SC-003 — void with reason excludes amount from Paid/Remaining/daily cash while row stays fully retrievable; empty reason → `VALIDATION` with nothing written; void without `payment.void` (Reception) → `FORBIDDEN` no audit; second void → `ALREADY_VOIDED`; direct SQL `UPDATE payment` as app role → Postgres refuses (REVOKE); `payment.voided` audit carries before/after + reason
- [x] T024 [US2] Integration test `tests/integration/finance/voidAfterClose.test.ts`: void on a completed order that re-opens positive remaining without credit emits one `finance.void_after_close` notice via 002 `notify` (Accounting + Admin/Owner); completion state unchanged (no auto-reopen)

### Implementation for User Story 2

- [x] T025 [US2] Implement `voidPayment` in `src/server/finance/payments.ts` per contracts/finance-service.md: `authorize(payment.void)` → `requireReason(reason)` BEFORE `audit.record` → insert `FinanceVoid(PAYMENT, paymentId)` (unique violation → `ALREADY_VOIDED`) → audit `payment.voided` same tx → COMMIT → post-commit closure port + void-after-close notice check (order `COMPLETED` && remaining > 0 && no credit)
- [x] T026 [US2] Void UI with mandatory reason: implemented inline in `src/components/finance/order-finance-panel.tsx` (per-row reason-required form; server enforces non-empty reason) instead of a separate dialog file — same contract, one less component
- [x] T027 [US2] Extend `src/components/finance/OrderFinancePanel.tsx`: voided rows dimmed with reason/actor/timestamp, void action shown only with `payment.void`, totals reflect exclusion immediately

**Checkpoint**: US1 + US2 both work — full immutable payment lifecycle

---

## Phase 5: User Story 3 - Finance sees the customer's balance across all orders (Priority: P2)

**Goal**: Customer balance tab (010 slot) = Σ per-order Remaining with credit flag/limit (Admin/Owner-maintained, warn-only); Cash Customer never credit-approved

**Independent Test**: Customer with orders remaining 200, −50, 0 → balance 150 with per-order rows; non-Admin credit write refused; Cash Customer badge never approved

### Tests for User Story 3

- [x] T028 [US3] Integration test `tests/integration/finance/customerBalance.test.ts`: SC-006 fixture (200 + (−50) + 0 = 150) with per-order breakdown; Cash Customer `creditApproved` always false; balance read without `finance.view` → `FORBIDDEN`
- [x] T029 [US3] Integration test `tests/integration/finance/credit.test.ts`: Admin/Owner sets flag + Decimal limit → `credit.updated` audit with required reason; non-Admin write → `FORBIDDEN`; over-limit surfaces warning (asserted in summary output) but `creditApproved` stays true and order creation/delivery are never blocked (warn-only, Clarifications 2026-09-25)

### Implementation for User Story 3

- [x] T030 [US3] Implement `src/server/finance/credit.ts` per data-model.md CustomerCredit: read credit standing, Admin/Owner write path gated by `admin.config` (no new permission; reason required as 052-local policy validated before `audit.record`; force `creditApproved=false` for `isCashCustomer`) with `credit.updated` audit in-tx
- [x] T031 [US3] Implement `customerBalance` in `src/server/finance/summaries.ts` per contracts/finance-service.md: balance = Σ per-order Remaining, `creditApproved`, `creditLimit`, per-order rows `{orderId, total, paid, remaining, pricingIncomplete}`; requires `finance.view`
- [x] T032 [P] [US3] Create `src/components/finance/CustomerBalanceTab.tsx` per contracts/ui.md: balance headline, credit badge, limit + usage with over-limit warning strip (never a block), per-order rows linking to each `<OrderFinancePanel>`, empty state, forbidden state
- [x] T033 [US3] Wire tab into the customer profile route that instantiates `CustomerProfile` (`src/app/(shell)/customers/…`) passing `slots.paymentsBalance={<CustomerBalanceTab customerId={…} />}`; verify no core profile tab is replaced (010 contract)
- [x] T034 [US3] Credit maintenance surface (FR-010): server action `updateCreditAction` in `src/app/(shell)/customers/[customerId]/finance-actions.ts` gated by `admin.config` with mandatory reason validated before `audit.record`, calling `src/server/finance/credit.ts`; Admin-only edit affordance (credit flag toggle + optional Decimal limit input + reason prompt) inside `src/components/finance/CustomerBalanceTab.tsx`, with non-admins seeing the read-only badge; makes quickstart scenario 5 executable through the product

**Checkpoint**: US1–US3 functional — per-order money in + cross-order balance + credit standing

---

## Phase 6: User Story 4 - Accounting records expenses with receipts (Priority: P2)

**Goal**: Expenses with configurable category, optional order/work-item link, receipt attachment via 050, threshold-flagged Admin/Owner approval (never blocking), filterable list

**Independent Test**: Record a transport expense with receipt → listed with all fields, attachment opens via authorized access; threshold-1500 expense flags "awaiting approval" everywhere yet counts in totals; below threshold no flag; unlinked expense excluded from order profitability

### Tests for User Story 4

- [x] T035 [US4] Integration test `tests/integration/finance/expenseRecord.test.ts`: record with `expense.record` → row + `expense.recorded` audit (+`attachmentIds` when receipt attached); amount ≤ 0 → `VALIDATION`; inactive category → `VALIDATION`; without permission → `FORBIDDEN` no audit
- [x] T036 [US4] Integration test `tests/integration/finance/expenseApproval.test.ts`: SC fixture — threshold 1000: record 1500 → `awaitingApproval` true immediately, counted in totals/profitability; Admin/Owner approves → flag clears, `expense.approved` audited; Accounting approve attempt → `FORBIDDEN`; record 400 → no flag; approve a voided expense → refused
- [x] T037 [US4] Integration test `tests/integration/finance/expenseVoid.test.ts`: void with reason → excluded from expense totals and every order's profitability, original retrievable, no update/delete path (SC-002)

### Implementation for User Story 4

- [x] T038 [US4] Implement `src/server/finance/expenses.ts` per contracts/finance-service.md: `recordExpense` (`authorize(expense.record)`, amount "> 0", category ∈ active list, `expenseDate` calendar-date validation, optional order/work-item coherence check `workItemId ∈ orderId`, receipt via `attachments.attach(tx, {entityType:"Expense", …})` AFTER entity-scope check — 050 entity-ownership rule, audit `expense.recorded`), `voidExpense` (reason required, `FinanceVoid(EXPENSE)`), `approveExpense` (`admin.config`, refuse when `amount < threshold` / already approved / voided, insert unique `ExpenseApproval`, audit `expense.approved`)
- [x] T039 [P] [US4] Create `src/components/finance/ExpensesList.tsx` per contracts/ui.md — backed by `listExpenses` implemented in `src/server/finance/expenses.ts` per contracts/queries.md (date range/category/order/employee/approval-state filters, `includeVoided` default false, cursor pagination): columns incl. approval pill and voided state, receipt thumbnail link, pagination, empty/forbidden states
- [x] T040 [P] [US4] Create `src/components/finance/ExpenseForm.tsx`: amount, category (active list), date, employee, description, optional order/work-item picker, optional receipt upload; success → list refresh
- [x] T041 [US4] Create route `src/app/(shell)/finance/expenses/page.tsx` + server actions with per-action gating per contracts/authorization-audit.md: list/read → `finance.view`, `recordExpenseAction` / `voidExpenseAction` → `expense.record`, `approveExpenseAction` → `admin.config`; add Finance nav group entry in `src/app/(shell)/nav.ts` gated by `finance.view`; Arabic strings in `src/messages/ar.json`

**Checkpoint**: US1–US4 functional — money out with receipts and approval flags

---

## Phase 7: User Story 5 - Direct manufacturing costs are captured per order (Priority: P2)

**Goal**: Direct cost entries per order (optionally per Work Item), traceable to source, voidable, feeding gross profit

**Independent Test**: Record order-level 200 + Work-Item-level 100 costs → both appear on the order's cost list and roll into profitability with actor/date/description retrievable

### Tests for User Story 5

- [x] T042 [US5] Integration test `tests/integration/finance/directCost.test.ts`: record with `expense.record` → row + `direct_cost.recorded` audit; amount ≤ 0 → `VALIDATION`; `workItemId` not in `orderId` → `VALIDATION`; without permission → `FORBIDDEN`; void with reason → excluded from profitability, original retrievable, no update/delete path; no permission → no audit

### Implementation for User Story 5

- [x] T043 [US5] Implement `src/server/finance/costs.ts` per contracts/finance-service.md: `recordDirectCost` (required `orderId`, optional `workItemId` ∈ order, amount "> 0", `costDate`, description required, optional receipt with entity-scope check + `attachments.attach`, audit `direct_cost.recorded`), `voidDirectCost` (reason required, `FinanceVoid(DIRECT_COST)`, audit), plus `listDirectCosts` per contracts/queries.md (order/work-item/date filters, `includeVoided` default false)
- [x] T044 [P] [US5] Create `src/components/finance/DirectCostForm.tsx` per contracts/ui.md: order picker (required), optional work item, amount, date, description, optional receipt
- [x] T045 [US5] Add "Add job cost" action + server action `recordDirectCostAction` to `src/app/(shell)/orders/[orderId]/finance-actions.ts` and surface it in `src/components/finance/OrderFinancePanel.tsx` (costs section listing the order's direct costs with void support)

**Checkpoint**: US1–US5 functional — full cost capture alongside payments

---

## Phase 8: User Story 6 - Order gross profit is explainable at a glance (Priority: P3)

**Goal**: Gross profit = revenue − direct costs − order-linked expenses, server-computed, every term clickable to source records; pricing-incomplete flagged; 090-ready query

**Independent Test**: Fixture order (revenue 1000, costs 300, job expenses 100, unlinked expense 500) → gross profit 600, drill-downs open exactly their rows, unlinked expense excluded

### Tests for User Story 6

- [x] T046 [US6] Integration test `tests/integration/finance/profitability.test.ts`: SC-004 fixture → 1000 − 300 − 100 = 600 with `sources.{priceIds,directCostIds,expenseIds}` matching; unlinked expense excluded; voided cost excluded; PENDING-priced Work Item → `pricingIncomplete: true` and revenue marked partial

### Implementation for User Story 6

- [x] T047 [US6] Implement `src/server/finance/profitability.ts` per contracts/queries.md: `orderProfitability(orderId)` — revenue via `051.getCurrentPrice` over non-cancelled Work Items, directCosts Σ non-void, jobExpenses Σ order-linked non-void, grossProfit = revenue − directCosts − jobExpenses, source ID lists for drill-down, `pricingIncomplete` flag (FR-018)
- [x] T048 [US6] Create `src/components/finance/ProfitabilityBlock.tsx` per contracts/ui.md: equation row (Revenue − Direct Costs − Job Expenses = Gross Profit), each figure a link to its drill-down (price history / cost list / expense list scoped to the order), pricing-incomplete banner; embed in `src/components/finance/OrderFinancePanel.tsx`

**Checkpoint**: US1–US6 functional — every spec money story except daily cash and receipt

---

## Phase 9: User Story 7 - The daily cash picture is reconcilable (Priority: P3)

**Goal**: Daily cash summary for a shop-local date: non-void payments grouped by method with counts/totals, drillable to underlying payments

**Independent Test**: Payments 500 cash + 300 card + 200 cash on one date → Cash 700 (2), Card 300 (1), total 1000; voided excluded; payment at 23:30 shop-local lands on that local date; user without `finance.view` refused

### Tests for User Story 7

- [x] T049 [US7] Integration test `tests/integration/finance/dailyCash.test.ts`: SC-007 method totals + counts + drill-down IDs; voided payment excluded; SC-012 fixture — `occurredAt` 23:30 `shopTimezone` buckets to that local date not the UTC date; read without `finance.view` → `FORBIDDEN`

### Implementation for User Story 7

- [x] T050 [US7] Implement `src/server/finance/daily-cash.ts` per contracts/queries.md: `dailyCashSummary(date)` — bucket non-void payments by method using `src/server/finance/time.ts` shop-local conversion, per-method `{method, count, total}`, `grandTotal`, `paymentIds`; requires `finance.view`
- [x] T051 [P] [US7] Create `src/components/finance/DailyCashSummary.tsx` per contracts/ui.md: date picker (default today shop-local), per-method rows, grand total, row → filtered payments list, note when selected date ≠ UTC date
- [x] T052 [US7] Create route `src/app/(shell)/finance/daily-cash/page.tsx` + nav entry in `src/app/(shell)/nav.ts` (`finance.view`); Arabic strings in `src/messages/ar.json`

**Checkpoint**: US1–US7 functional

---

## Phase 10: User Story 8 - A printed payment receipt is issued (Priority: P3)

**Goal**: Printable A5 receipt (shop name, sequential number, order ref, amount, method, date/time shop-local, recorder, remaining balance); VOID watermark on voided payments

**Independent Test**: Print after recording → all fields match stored payment + Remaining at print time within 5 s; re-print from history; voided payment receipt visibly marked VOID

### Tests for User Story 8

- [x] T053 [US8] Integration test `tests/integration/finance/receipt.test.ts`: SC-010 — `getReceipt` fields match the stored payment and computed Remaining; receipt numbers strictly increasing; voided payment projection carries `voided: true` (for watermark); soft timing assertion: projection + page render < 5 s

### Implementation for User Story 8

- [x] T054 [US8] Implement `src/server/finance/receipt.ts` per contracts/queries.md: `getReceipt(paymentId)` projection (shop name from config, receiptNumber, order ref, customer, amount, method, source, occurredAt shop-local rendering, recorder, remaining-after) + `authorize(finance.view)`
- [x] T055 [US8] Create route `src/app/(shell)/finance/receipt/[paymentId]/page.tsx` per contracts/ui.md: print-optimized, A5 paper-width-agnostic CSS (max-width, no fixed viewport), VOID watermark when voided, `window.print()` action, renders within 5 s of invocation
- [x] T056 [US8] Wire print-receipt actions: post-record toast in `src/components/finance/RecordPaymentDialog.tsx` and per-row print button in `src/components/finance/OrderFinancePanel.tsx` payment history

**Checkpoint**: All 8 user stories functional and independently testable

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story guarantees, 090 surface, validation

- [ ] T057 [P] Permission matrix integration test `tests/integration/finance/permissions.test.ts`: every entry point × {Reception, Accounting, Admin/Owner} — assert the full table in contracts/authorization-audit.md (Reception: read-only; Accounting: record/void payments + expenses; `admin.config`-gated Admin-only: credit write, expense approval, FinanceConfig write)
- [ ] T058 [P] Audit completeness integration test `tests/integration/finance/auditMatrix.test.ts`: all nine audit actions fire with actor + timestamp; forced failure after insert → no orphan audit row (atomicity); no audit on refused attempts
- [ ] T059 [P] Decimal integrity test `tests/unit/finance/decimal.test.ts` (SC-008): migration column types are `numeric`/`Decimal` (assert via Prisma DMMF), `0.10` EGP round-trips exactly, no float math in money helpers
- [ ] T060 [P] Performance smoke `tests/integration/finance/perf.test.ts` (SC-011): orderSummary + customerBalance < 500 ms p95, single recordPayment (incl. audit) < 500 ms p95 with generous CI tolerance
- [x] T061 [P] Implement 090-only rollup query `listCustomerBalances` in `src/server/finance/summaries.ts` per contracts/queries.md (no UI; exported for reporting)
- [ ] T062 Verify `listExpenses` / `listPayments` / `listDirectCosts` filter surfaces in `src/server/finance/{expenses,payments,costs}.ts` match contracts/queries.md exactly (pagination cursors, `includeVoided` default false)
- [ ] T063 Run `specs/052-finance/quickstart.md` scenarios 1–12 end-to-end; fix any gap found (SC-001…SC-012 all demonstrated)
- [ ] T064 `pnpm check` green + full `pnpm test` green; confirm no task in this list left a placeholder or TODO in `src/server/finance/` or `src/components/finance/`
- [ ] T065 [P] Backup scope confirmation: new tables verified inside primary PostgreSQL backup set, attachments inside 050 file backup set (constitution Backups) — document result in `specs/052-finance/plan.md` delivery notes
- [ ] T066 Post-commit closure invocation test `tests/integration/finance/closureTrigger.test.ts` (SC-009): bind a spy closure port → `recordPayment` and `voidPayment` → assert the port is invoked exactly once AFTER the transaction commits (never inside `tx`), that a `{ closed: false }` result does not fail/roll back the payment, and that an unbound port leaves the payment successful (constitution VII)
- [ ] T067 Credit-application test `tests/integration/finance/creditsApplied.test.ts` (FR-012): bind a fake compensation port returning a CREDIT → `orderSummary.remaining` = total − paid − credit; unbound port → credit ignored (empty default); PRICE_ADJUSTMENT rows never reduce remaining

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational — no other story dependencies → 🎯 MVP
- **US2 (Phase 4)**: Depends on US1 (voids a payment, panel exists)
- **US3 (Phase 5)**: Depends on US1 (per-order Remaining aggregation); credit writes independent
- **US4 (Phase 6)**: Depends on Foundational only (can run parallel to US1 if staffed)
- **US5 (Phase 7)**: Depends on Foundational only (panel hook needs US1's panel → sequence after US1 for integration, service parallel)
- **US6 (Phase 8)**: Depends on US1 (revenue/panel) + US4 (expense input) + US5 (cost input) — terms default to zero without them, so it builds last in priority order
- **US7 (Phase 9)**: Depends on US1 (payments exist)
- **US8 (Phase 10)**: Depends on US1 (payment + Remaining)
- **Polish (Phase 11)**: Depends on all stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational only → independent MVP
- **US2 (P1)**: US1
- **US3 (P2)**: US1
- **US4 (P2)**: Foundational only
- **US5 (P2)**: Foundational only (panel integration after US1)
- **US6 (P3)**: US1 + US4 + US5
- **US7 (P3)**: US1
- **US8 (P3)**: US1

### Within Each Story

- Tests first (must FAIL before implementation) → services → components → routes/actions → checkpoint

### Parallel Opportunities

- Setup: T002 ∥ T003 · Foundational: T006 ∥ T007 ∥ T008 ∥ T009 ∥ T012
- US1 tests: T013 ∥ T014 ∥ T015 · US1 components: T019 ∥ T020
- US3: T028 ∥ T029 · US4 components: T038 ∥ T039 · Polish: T056 ∥ T057 ∥ T058 ∥ T059 ∥ T060 ∥ T064
- After Foundational: US1 ∥ US4 (separate files) staffed in parallel; then US2/US3/US5/US7/US8 fan out off US1; US6 last

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together first (must fail):
Task: "T013 integration test tests/integration/finance/paymentRecord.test.ts"
Task: "T014 integration test tests/integration/finance/paymentAuthz.test.ts"
Task: "T015 contract test tests/contract/finance/financeSummaryPort.test.ts"

# Then parallel implementation (different files):
Task: "T019 RecordPaymentDialog src/components/finance/RecordPaymentDialog.tsx"
Task: "T020 OrderFinancePanel src/components/finance/OrderFinancePanel.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup + Phase 2: Foundational (CRITICAL — blocks all stories)
2. Complete Phase 3: US1 — record payments, see Total/Paid/Remaining, port serves delivery
3. **STOP and VALIDATE**: quickstart scenarios 1 + 10 + 11 pass
4. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test independently → MVP demo (money in works)
3. US2 → immutable corrections → US3 → balances; each independently testable
4. US4 + US5 → money out → US6 → profitability (equation complete)
5. US7 + US8 → cash reconciliation + receipts
6. Polish → quickstart 1–12 + `pnpm check` → ready for `/speckit-analyze` and docs PR

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Developer A: US1 → US2 → US8; Developer B: US4 → US5; then both converge on US3/US6/US7
3. Polish together (permission/audit matrices are cross-story)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Every money constraint quoted above comes verbatim from data-model.md / contracts — do not leave to implementation-time discretion
- 015 seams (`bindFinancialClosurePort`, `bindCompensationReadPort`, `financeSummaryProvider`) use safe defaults — never import `~/server/collection` at compile time (research.md)
- No task may add a permission key: vocabulary frozen in 001
- Commit after each task or logical group; stop at each checkpoint to validate the story independently
