# Research: Finance — Payments, Expenses & Profitability

Phase 0 for `/speckit-plan`. Every unknown in plan.md's Technical Context is resolved here.

## Decision: Append-only correction model — immutable money rows + `FinanceVoid` records

**Decision**: `Payment`, `Expense`, and `DirectCost` rows are never updated or deleted. Corrections are expressed by inserting one `FinanceVoid` row (`entityType`, `entityId`, `reason`, `voidedById`, `voidedAt`, `@@unique(entityType, entityId)`). A record counts toward totals iff it has no void row. Approval is likewise an appended `ExpenseApproval` row (`expenseId` unique, `approvedById`, `approvedAt`) — the `Expense` row itself never changes. A migration `REVOKE UPDATE, DELETE ON payment, expense, direct_cost, finance_void, expense_approval FROM <app_role>` makes this a database guarantee.

**Rationale**: The acceptance criterion "UPDATE/DELETE of a payment through any server action is impossible" is satisfied at two layers: no application code path issues such statements, and the database refuses them even against a direct SQL client. A mutable `status` column on the payment row would technically be an UPDATE of a payment — the void-row design removes that ambiguity entirely and mirrors 001's `AuditEvent` REVOKE precedent (research.md there: REVOKE chosen over triggers as simpler, zero overhead, no conditional exception needed). A single polymorphic void table covers all three record types instead of three near-identical void tables; the unique constraint enforces "no double void" structurally (second insert violates uniqueness → refused).

**Alternatives considered**:
- `status` column flipped by UPDATE — weaker: creates an update path on a payment row; acceptance tests would have to argue the distinction between "updating status" and "updating a payment."
- `BEFORE UPDATE OR DELETE` triggers raising exceptions — equivalent protection but more code and migration complexity; kept only as fallback if the deployment's app role is a superuser (then REVOKE silently no-ops — same documented prerequisite as 001).
- Separate `PaymentVoid`/`ExpenseVoid`/`DirectCostVoid` tables — verbose; no query or constraint advantage over one polymorphic table with a unique pair.

## Decision: Order Total and revenue are computed on read, never stored

**Decision**: `orderSummary` and profitability compute Total as the sum of `051.getCurrentPrice(workItemId)` over the order's non-cancelled Work Items, Paid as `SUM(amount)` over non-void payments, at query time. No cached/materialized total column exists anywhere.

**Rationale**: A stored total would be a second source of truth that drifts the moment a price is appended (051) or a payment voided (052) — the exact class of parallel authority Principle I forbids. Shop scale (single LAN, thousands of orders) makes two indexed sums trivially within the 500 ms p95 budget; 051's history table is already indexed for current-price lookup.

**Alternatives considered**: Materialized `order.total` refreshed on price/payment events — rejected (drift + cross-feature write coupling); nightly reconciliation jobs — rejected (latency and complexity for zero benefit at this scale).

## Decision: Configuration lives in a `FinanceConfig` singleton; money rows store label snapshots

**Decision**: `FinanceConfig` (single row, `FileConfig` precedent) holds `paymentMethods`, `paymentSources` (JSON string arrays), `expenseCategories` (JSON array of `{label, active}`), `approvalThreshold` (Decimal), `shopTimezone` (String, default `Africa/Cairo`), `updatedById/At`. Money rows store the chosen method/source/category as plain strings at record time. Validation at entry: value must be in the currently active configured list.

**Rationale**: Storing labels (not FKs) is what makes the spec's history rule trivial — "past payments keep the labels they were recorded with" survives any config edit with no join gymnastics. The singleton mirrors `FileConfig` exactly (Admin UI, Zod-validated write, startup YAML seed `config/052-finance.yaml` like `config/050-files.yaml`), so no new configuration subsystem is invented (Principle VI). The threshold is Admin-configurable per FR-013; below it no approval flag appears.

**Alternatives considered**: Normalized `PaymentMethod` reference tables with FKs — rejected (retirement/history semantics become joins and soft-delete rules for no read benefit; snapshot string already satisfies the requirement); reusing `FileConfig` or an existing settings store — rejected (wrong ownership; files config is 050's).

## Decision: Shop-local day bucketing converts at query time from UTC

**Decision**: `occurredAt` (payment date/time), `recordedAt`, and all audit timestamps persist in UTC (constitution Time). The daily cash summary and date-range filters convert `occurredAt` to the shop's local calendar date using `FinanceConfig.shopTimezone` before grouping; date-only fields (`Expense.expenseDate`, `DirectCost.costDate`) store the calendar date the user chose, at UTC midnight, and are filtered as plain dates with no timezone math.

**Rationale**: The SC-012 fixture (payment at 23:30 local must land on that local day) fails under naive UTC grouping — a real corruption of the drawer ritual for a UTC+2/+3 shop. Converting in the query keeps storage constitution-compliant (UTC) while making bucketing correct by construction. Date-only expense fields have no time component to distort, so they bypass conversion entirely.

**Alternatives considered**: Storing a second `localDate` shadow column on payments — rejected (denormalized copy that can disagree with `occurredAt` if timezone config ever changes); timezone per-user — rejected (the drawer is a shop-level fact, not a viewer preference).

## Decision: 015 seams are ports 052 owns and 015 binds — with safe defaults

**Decision**: 052 implements 015's frozen `FinanceSummaryPort` (export `financeSummaryProvider`, shape copied verbatim from 015 contracts/ports.md §2) for 015 to bind. For the reverse direction, 052 owns two thin ports with safe defaults: `bindFinancialClosurePort(fn)` (default: no-op log "015 not connected") and `bindCompensationReadPort(fn)` (default: empty array — no credits). 052 calls them after each payment/void commit; 015's module load binds the real `tryFinancialClosure` and `listCompensationsForOrder`. 052 never imports from `~/server/collection` at compile time.

**Rationale**: 015 is at 0/72 tasks — hard-importing its module would not compile today, and a dynamic-import feature-detect is type-unsafe and hides wiring failures. Port-with-default inverts the dependency the same way 051's `pricingGateProvider` did (051 exports the provider; 015 owns the guard), so the pattern is already house-style. Safe defaults satisfy constitution VII: empty credits means Remaining is overstated (conservative — nothing silently discounts a debt), and skipped closure merely leaves completion for 015's own re-evaluation triggers (delivery/resolution/manual), which all exist in 015's spec.

**Alternatives considered**: Dynamic `import("~/server/collection")` with try/catch — rejected (type-unsafe, runtime-only failure discovery); 052 registering a guard on `DELIVERED → COMPLETED` — rejected (015 FR-030 owns that guard, exactly like 051 was forbidden from a second delivery guard); blocking 052 tasks until 015 ships — rejected (payments must not depend on an unbuilt feature).

## Decision: Receipt numbers come from a Postgres SEQUENCE

**Decision**: A dedicated `receipt_sequence` Postgres sequence; `recordPayment` calls `nextval` inside its transaction. Numbers are per-shop, monotonically increasing, and may contain gaps (rollback or unused allocation).

**Rationale**: The spec's assumption is "gapless-enough for a single LAN deployment" — sequence gaps are explicitly tolerated, and `nextval` is concurrency-safe without the row-lock contention of a counter singleton update. Strict gapless fiscal numbering belongs to tax invoicing, which is out of scope (FR-028).

**Alternatives considered**: Counter row in `FinanceConfig` with `SELECT … FOR UPDATE` — correct but serializes every payment insert on one row for no benefit; per-order numbering — rejected (receipts are shop-level, printed across orders).

## Decision: Hand-over acknowledgment is a 015-side prompt fed by `orderSummary`

**Decision**: FR-011's acknowledgment UI lives in 015's hand-over flow (015 owns the delivery screen); 052 supplies the data (`remaining`, `creditApproved`) through the bound `FinanceSummaryPort` and records nothing itself. The acknowledgment's own persistence (actor, timestamp, "payment collected" / "will pay later") is a 015 record in 015's hand-over entity.

**Rationale**: 015 FR-027 already makes the delivery screen display Total/Paid/Remaining/creditApproved; bolting a second prompt onto someone else's screen from 052 would violate module ownership (051's lesson: one owner per guard). The spec states the prompt "lives in 015's hand-over flow, driven by 052's order summary" — this decision just records the task split: 052 delivers the contract + fixture; 015 delivers the prompt.

**Alternatives considered**: 052 modal opened from the delivery page — rejected (cross-feature UI coupling, authorization tangle); dropping the acknowledgment — rejected (clarified requirement, option B).

## Decision: Gross profit and 090 queries are read-only projections

**Decision**: Profitability and every FR-019 query are plain read functions over existing rows (prices, costs, expenses, payments) with no stored derived state. Each profitability term returns both its total and the IDs behind it for drill-down.

**Rationale**: Derivations stay correct as records are appended or voided; 090 gets stable query names without 052 shipping chart/report UI (out of scope). Drill-down requirement ("every number clickable to its source records") maps directly onto returning ID lists with each figure.

**Alternatives considered**: Persisted `OrderProfitability` snapshot — rejected (same drift class as stored totals); embedding report definitions in 052 — rejected (090 owns presentation).

## Dependency readiness (fact, not decision)

| Dependency | State at planning | 052 impact |
|---|---|---|
| 001 auth/audit | Implemented (`src/server/auth`) | Full surface available |
| 010 customers | Implemented; `slots.paymentsBalance` prop exists | Slot fill works today |
| 011 orders | Implemented; `placeholderPayments` exists on order page | Placeholder replacement works today |
| 050 files | Implemented (`attachments.attach` exported) | Receipt attachments work today |
| 051 pricing | Implemented (`getCurrentPrice`, `status` exported) | Total/revenue/pricing-flag work today |
| 015 collection/delivery | Spec only — 0/72 tasks, no `src/server/collection`, no `Compensation` model | Ports with safe defaults (above); no compile-time dependency |
| 090 reporting | Not started | Consumes `contracts/queries.md` later |
