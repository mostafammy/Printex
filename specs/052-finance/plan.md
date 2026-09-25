# Implementation Plan: Finance — Payments, Expenses & Profitability

**Branch**: `helmysaman8/pri-16-spec-plan-052-finance` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/052-finance/spec.md`

## Summary

052 adds the money-in / money-out module: immutable Payment history with void-only corrections, order and customer financial summaries, configurable payment methods/sources and expense categories, expenses with receipt attachments and threshold-flagged approval, direct manufacturing costs, order gross-profit derivation, a daily cash summary, and a printable receipt. It binds 015's `FinanceSummaryPort` so delivery and financial closure can read finance, consumes 051 prices for order Total/revenue, fills 010's `payments-balance` slot and 011's order-detail payments placeholder, and ships all money math as server-side Decimal queries that 090 will reuse.

## Technical Context

**Language/Version**: TypeScript strict, Node 22.

**Primary Dependencies**: Next.js 15 App Router, Prisma/PostgreSQL, Zod, Vitest, existing 001/002/010/011/015/050/051 contracts.

**Storage**: PostgreSQL additive schema `prisma/schema/finance.prisma` delivered as a Prisma migration; `Decimal` money columns; append-only money records enforced by role-level `REVOKE UPDATE, DELETE` (001 `AuditEvent` precedent); one raw-SQL step for the revokes.

**Module boundary**: New `src/server/finance/` barrel is the only public import surface (mirror of `src/server/pricing/`). Internals: payment recording/voiding, summaries, customer balance/credit, expenses, direct costs, profitability, daily cash, receipt numbering, config, and port providers. UI in `src/components/finance/` and existing shell routes.

**Testing**: Unit tests for Decimal totals, gross-profit arithmetic, shop-local date bucketing; integration tests through server entry points for authorization, immutability (no update/delete path), void semantics, audit emission, approval flagging; contract tests for the 015 port shapes and 001 permission seams. Vitest TypeScript.

**Constraints** (from spec + constitution):

- Money is `Decimal` EGP end-to-end; totals computed server-side only; never floating point.
- Timestamps stored UTC; daily cash summary and date filters bucket by shop-local calendar date (`shopTimezone` config, default `Africa/Cairo`).
- Payments, expenses, and direct costs are immutable; corrections happen only by Void (reason + audit); approval is an appended record, never an in-place edit of the expense row.
- Permissions frozen in 001: `payment.record`, `payment.void`, `expense.record`, `finance.view`; Admin/Owner actions (credit flag/limit, expense approval, config) use the existing `admin.config` key — no new permission keys.
- Delivery is never blocked by an unpaid balance (015 FR-027 / FR-024); closure re-evaluation runs only after the payment/void transaction commits.
- Arabic-first, task-oriented RTL UI; `<OrderFinancePanel>` / `<CustomerBalanceTab>` are contracts, not second calculations.
- Backups: all new tables live in the existing primary PostgreSQL database and the receipt sequence lives with it — covered by the existing DB backup scope (constitution Backups); 052 adds no new persistent store. Receipt-photo attachments are 050 objects, already in the file backup scope.

## Constitution Check

*GATE: passed before Phase 0 research; re-checked after Phase 1 design (below).*

| Principle | Result |
|---|---|
| I. Canonical Order → Work Item model | PASS: payments/expenses/costs reference Order/WorkItem owned by 011; summaries are derived views, never stored authority; no parallel source-of-truth objects. |
| II. Business gates are inviolable | PASS: pricing-incomplete flagged, never bypassed; hand-over acknowledgment never weakens 015's `DELIVERED` gate; no admin shortcut paths; approval flags never hide money. |
| III. History is append-only | PASS: money rows + voids + approvals are append-only with DB-level `REVOKE UPDATE, DELETE`; every mutation audits in the same transaction. |
| IV. Files are immutable/private | PASS: receipt photos go through 050 `attachments.attach` with 052-owned entity-scope authorization; no new storage. |
| V. Server is the only authority | PASS: `authorize` first statement on every entry point; all totals/gross-profit/cash queries server-side; client mirrors for display only. |
| VI. Configuration over hard-coding | PASS: methods, sources, categories, approval threshold, and shop timezone are Admin-editable `FinanceConfig` data; permissions are scopes, never name checks. |
| VII. Local-first, isolated integrations | PASS: everything runs on the LAN DB; 015 seams are in-process ports with safe defaults (no-op closure, empty credits) so absence never blocks payments. |
| VIII. AI optional | PASS: no AI features. |
| IX. Arabic-first, task-oriented UX | PASS: payments tab, balance tab, record dialog, expenses list/form, cash summary, receipt are RTL shell surfaces with minimal clicks. |

**Post-design re-check (after Phase 1 artifacts)**: PASS — data-model, contracts, and quickstart introduce no new violations; the only design-time judgment (append-style void/approval records instead of row updates) strengthens Principle III relative to the spec's minimum.

## Architecture and ownership

1. `src/server/finance/payments.ts` — `recordPayment` / `voidPayment`: authorize → validate (amount, method/source ∈ config, `occurredAt ≤ now`) → insert immutable Payment (+ receipt number) or FinanceVoid → audit → commit → post-commit closure hook. Void reason validated before `audit.record` (001 policy).
2. `src/server/finance/summaries.ts` — `orderSummary(orderId)` computes Total (sum of 051 current Work Item prices via `getCurrentPrice`), Paid (non-void payments), Remaining (Total − Paid − applied credits via the compensation read port), `creditApproved` (CustomerCredit ∩ Cash-Customer rule), pricing-incomplete flag; `customerBalance(customerId)` aggregates per-order Remaining.
3. `src/server/finance/expenses.ts` / `costs.ts` — record/void expenses and direct costs; approval appended via `ExpenseApproval` (threshold from config); attachment entity-scope check before `attachments.attach`.
4. `src/server/finance/profitability.ts` — gross profit = revenue − direct costs − order-linked expenses with drill-down IDs per term; exposes the 090 query surface.
5. `src/server/finance/daily-cash.ts` — payments grouped by method for a shop-local calendar date (UTC timestamp + `shopTimezone` conversion), voided excluded.
6. `src/server/finance/ports.ts` — implements 015's `FinanceSummaryPort` provider (`financeSummaryProvider`, shape frozen in 015 ports.md §2); owns `bindFinancialClosurePort` / `bindCompensationReadPort` with safe defaults (no-op / empty) that 015 binds at its module load.
7. `src/server/finance/config.ts` — `FinanceConfig` singleton reads/writes (Admin), validation helpers for method/source/category/threshold/timezone.
8. `src/server/finance/receipt.ts` — receipt projection + sequential number from a Postgres SEQUENCE (gaps tolerated per spec assumption).
9. `src/server/finance/index.ts` — frozen public surface; guarded module-load registration consistent with neighboring barrels.
10. UI: `<OrderFinancePanel>` replaces `placeholderPayments` in `src/app/(shell)/orders/[orderId]/page.tsx`; `<CustomerBalanceTab>` fills `slots.paymentsBalance` in `src/components/customers/customer-profile.tsx`; record-payment dialog, expenses list + forms, profitability block, daily cash page, printable receipt route.

## Integration dependencies

- **001**: `getActor`, `authorize`, `audit.record`; frozen keys `payment.record`, `payment.void`, `expense.record`, `finance.view`; Admin actions (credit flag/limit, expense approval, `FinanceConfig` writes) reuse the existing `admin.config` key — pinned here and in tasks (no new permission keys).
- **002/011**: Order, WorkItem identity; 052 never writes workflow state.
- **010**: Customer + immutable Cash Customer; `payments-balance` slot (component prop `slots.paymentsBalance` exists in code); Customer master untouched — credit lives on 052's `CustomerCredit`.
- **011**: order-detail page placeholder (`placeholderPayments`) filled by `<OrderFinancePanel>`.
- **015** (contract-boundary — 72 open tasks, not yet implemented): `FinanceSummaryPort` shape consumed verbatim; `tryFinancialClosure` reached through 052's closure port; `listCompensationsForOrder` CREDIT credits through the compensation read port (empty until bound); hand-over acknowledgment prompt lives in 015's flow, fed by `orderSummary`. Safe defaults until binding — payments must ship regardless (constitution VII).
- **050**: `attachments.attach` for receipt photos; entity-ownership authorization stays with 052 (FR-013).
- **051**: `getCurrentPrice` / `pricing.status` for order Total, revenue, and pricing-incomplete flags.
- **090** (future): consumes the read queries in `contracts/queries.md`; no charts here.

## Project structure

### Documentation (this feature)

```text
specs/052-finance/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/requirements.md
├── contracts/           # Phase 1 output
│   ├── finance-service.md
│   ├── finance-ports.md
│   ├── authorization-audit.md
│   ├── ui.md
│   └── queries.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── server/finance/                 # barrel: index.ts + payments, summaries, expenses,
│   │                               # costs, profitability, daily-cash, ports, config, receipt
├── components/finance/             # OrderFinancePanel, CustomerBalanceTab, RecordPaymentDialog,
│                                   # ExpensesList, ExpenseForm, DirectCostForm, ProfitabilityBlock,
│                                   # DailyCashSummary, PaymentReceipt (print)
├── app/(shell)/orders/[orderId]/   # placeholderPayments → <OrderFinancePanel> (existing page)
├── app/(shell)/customers/          # profile slot fill: paymentsBalance → <CustomerBalanceTab>
├── app/(shell)/finance/            # expenses, daily-cash routes (new)
└── app/(shell)/orders/.../receipt  # printable receipt route (or finance/print)

prisma/schema/finance.prisma        # additive finance schema
prisma/schema/migrations/<ts>_finance/  # migration + REVOKE raw SQL (001 pattern)
config/052-finance.yaml             # startup config seed mirroring config/050-files.yaml

tests/unit/finance/                 # totals, gross profit, timezone bucketing, validation
tests/integration/finance/          # entry-point authz, immutability, void, audit, approval, summary math
tests/contract/finance/             # FinanceSummaryPort shape, closure/compensation port defaults,
                                    # 001 permission vocabulary, 051 price reads
```

**Structure Decision**: single-project web app (existing layout). 052 follows the 051 module pattern exactly: one server barrel, additive Prisma file, feature components, feature routes under `(shell)`, and feature-scoped tests. No new top-level directories, no new packages.

## Delivery and sequencing

- Payments/voids/summaries/expenses/costs are self-sufficient: they compile and test against 001/010/011/050/051 only. 015 seams default safely (closure no-op, credits empty, `FinanceSummaryPort` exported for later binding) — 052 never imports 015 code at compile time, so 015's absence blocks nothing (constitution VII); when 015 lands, its instrumentation boot hook binds the three ports.
- The hand-over acknowledgment (FR-011) is a 015-side prompt fed by `orderSummary`; 052 delivers the data contract and the acceptance fixture, and the UI task lands with 015 unless 015 ships first — tracked as a cross-feature task, not a 052 blocker.
- Money rows get `REVOKE UPDATE, DELETE` in the same migration that creates them; the migration documents the non-superuser app-role prerequisite (001 precedent).
- Receipt sequence, config seeds, and the Cash Customer lookup all exist before the first integration test runs.
- `FinanceConfig` V1 editing = YAML seed + `admin.config`-gated write helper; no config-admin screen in V1 (spec Assumptions — "V1 config editing").
