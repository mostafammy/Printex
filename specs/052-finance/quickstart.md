# Quickstart: Finance — Payments, Expenses & Profitability

Validation guide for the 052 feature branch. Proves the spec's acceptance criteria end-to-end. Implementation details live in `tasks.md`; this file only says how to run and what to expect.

## Prerequisites

- Repo dependencies installed (`pnpm install`), local Postgres up (`./start-database.sh`), `pnpm check` green before starting.
- Migration applied: `finance` schema + `REVOKE UPDATE, DELETE` raw-SQL step. **Deployment prerequisite**: the app's Postgres role is a non-superuser (otherwise REVOKE no-ops) — verify with the migration's verification query.
- Config seeded from `config/052-finance.yaml` (methods, sources, categories, threshold, `shopTimezone`).
- Seeded users with the 001 matrix: Reception (`finance.view` only), Accounting (`payment.record/void`, `expense.record`, `finance.view`), Admin/Owner (all + admin scope).
- Existing fixture data: at least one priced order (051 `PRICED` Work Items), one Cash Customer order, one credit-eligible customer with multiple orders.

## Commands

```bash
pnpm check                      # lint + typecheck gate
pnpm test                       # full suite
pnpm vitest run tests/unit/finance          # totals, gross profit, bucketing, validation
pnpm vitest run tests/integration/finance   # authz, immutability, void, audit, approval, summaries
pnpm vitest run tests/contract/finance      # port shapes, permission vocabulary, 051 reads
pnpm dev                        # manual walkthrough at http://localhost:3000 (RTL shell)
```

## Validation scenarios (map to spec acceptance)

### 1. Remaining = Total − non-void payments (SC-001, US1)

1. Open a priced order with Total 1000 (two Work Items, 600 + 400), no payments → Paid 0, Remaining 1000.
2. As Accounting, record 400 cash at Reception desk → Paid 400, Remaining 600; receipt # allocated.
3. Record 600 bank transfer → Paid 1000, Remaining 0.
4. Void the 600 payment with reason "entered twice" → Paid 400, Remaining 600; voided row still listed with reason/actor.
5. Re-void → refused (`ALREADY_VOIDED`).

### 2. Immutability & void permission (SC-002, SC-003, US2)

1. Attempt to update/delete a payment through every exposed server action (integration test enumerates them) → no path exists; row byte-identical.
2. Direct SQL `UPDATE payment SET amount = 1` as app role → Postgres refuses (REVOKE).
3. As Reception, `voidPayment` → `FORBIDDEN`, no audit event.
4. Void without reason → `VALIDATION`, nothing written.
5. Void as Accounting with reason → succeeds; `payment.voided` audit row present (actor, before/after, reason).
6. Void-after-close: on an already-`COMPLETED` order, void a payment that re-opens a positive remaining without credit → one `finance.void_after_close` internal notice (002) to Accounting + Admin/Owner; completion state unchanged (no auto-reopen).

### 3. Gross profit fixture (SC-004, US6)

Fixture order: revenue 1000 (051 prices), direct costs 300 (one order-level 200 + one work-item 100), order-linked expense 100; unlinked expense 500 excluded.

- Profitability view: 1000 − 300 − 100 = 600; each term's drill-down opens exactly its source rows; priceIds/directCostIds/expenseIds match.
- Add a PENDING-priced Work Item → `pricingIncomplete` banner; revenue marked partial.

### 4. Audit completeness (SC-005)

After running scenarios 1, 3, and the expense/cost flows: audit events exist for `payment.recorded`, `payment.voided`, `expense.recorded`, `expense.voided`, `expense.approved`, `direct_cost.recorded`, `direct_cost.voided`, `credit.updated`, `config.updated` — each with actor + timestamp, each committed atomically (rollback test: force a failure after insert → no orphan audit row).

### 5. Customer balance & credit (SC-006, FR-010)

- Customer with orders remaining 200, −50, 0 → balance tab shows 150 with per-order rows.
- Admin/Owner sets credit flag + limit 1000 → badge shows approved; over-limit shows warning strip; order creation and delivery are never blocked.
- Cash Customer: `creditApproved` always false in every summary.
- Non-Admin write to `CustomerCredit` → `FORBIDDEN`.

### 6. Cash Customer hand-over acknowledgment (FR-011, US1-7)

- With 015 absent: verify `orderSummary` returns correct `remaining`/`creditApproved` for the fixture (the data 015's prompt will consume); the prompt itself is validated in 015's suite when it ships.
- With 015 present (later): hand-over with Remaining > 0 and no credit requires the collected/will-pay-later choice; the `DELIVERED` transition itself is never refused for balance; after a payment or void commits, `tryFinancialClosure` re-evaluates and a delivered order with remaining balance and no approved credit never reaches `COMPLETED` (SC-009).

### 7. Daily cash summary (SC-007, SC-012, US7)

- Payments on today: 500 cash, 300 card, 200 cash → Cash 700 (2), Card 300 (1), total 1000; drill-down lists exactly those payments.
- Void one → excluded from totals.
- Fixture: payment at 23:30 `shopTimezone` → appears under that local date, not the UTC date.
- As Reception (`finance.view`): visible. Without `finance.view`: `FORBIDDEN`.

### 8. Expense approval threshold (FR-013, US4-7)

- Threshold 1000: record 1500 → immediately present, counted in totals/profitability, "awaiting Admin/Owner approval" everywhere; Admin/Owner approves → flag clears, `expense.approved` audited; Accounting's approve attempt → `FORBIDDEN`.
- Record 400 → no flag.
- Receipt photo: attach on record; view requires 052 entity scope + 050 download authz; finance user without scope → refused.

### 9. Receipt (SC-010, FR-022)

- After recording, print renders within 5 s: shop name, sequential number, order ref, amount, method, date/time (shop-local), recorder, Remaining; re-print from history matches; voided payment's receipt shows VOID watermark; layout fits A5 and an 80 mm profile.

### 10. Ports unbound (constitution VII)

- With 015 absent: `recordPayment`/`voidPayment` succeed; closure port logs "not connected" once, payment unaffected; `orderSummary` Remaining ignores credits (empty default); `FinanceSummaryPort` provider exported with the frozen shape (contract test asserts field-for-field match against 015 ports.md §2).

### 11. Decimal integrity (SC-008)

- Assert every persisted money column (`payment.amount`, `expense.amount`, `direct_cost.amount`, `customer_credit.credit_limit`, `finance_config.approval_threshold`) is a database `Decimal`/`numeric` type — no `float`/`double` in the migration; a payment of `0.10` EGP records and sums exactly (integration test).

### 12. Performance smoke (SC-011)

- Order summary and customer balance < 500 ms p95; single payment record (incl. audit) < 500 ms p95 on LAN (integration test with timing assertion, generous CI tolerance).
