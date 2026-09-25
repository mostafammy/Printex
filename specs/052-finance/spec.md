# Feature Specification: Finance — Payments, Expenses & Profitability

**Feature Branch**: `052-finance`

**Created**: 2026-09-25

**Status**: Draft

**Input**: Linear PRI-16 / GitHub #12: define money in and money out — payments against orders, expenses, job costs, and the gross profit of each order. PRD §§22–23, §29–31, §48 (Accounting role), §55 Rule 6, §58 (Finance MVP); constitution II, III, V, VI, IX.

**PRD References**: `Printex Print Shop Management System — Product Requirements Document V1.md`; `Printex.md` §13; `DEMO ANALYSIS.md`.

## Clarifications

### Session 2026-09-25

- Q: Who may a customer be placed on credit, who sets their credit limit, and does exceeding that limit block anything? → A: Admin/Owner sets and changes the credit flag and optional Decimal limit per customer; exceeding the limit (or a positive balance on a non-flagged customer) shows a warning at order creation and on the delivery screen but never blocks anything (warn-only in V1).
- Q: At hand-over of a Cash Customer order that still has money outstanding, what must the delivery person do before the delivery can be finalized? → A: Explicit acknowledgment: when Remaining > 0 and no approved credit, finalizing hand-over requires confirming "payment collected" or "will pay later" — never a hard block on the delivery transition itself (option B).
- Q: When, if ever, must an expense be approved, and who approves it? → A: Threshold + flag: expenses at/above an Admin-configured amount show "awaiting Admin/Owner approval" everywhere until an Admin/Owner approves — always recorded, always counted in totals and profitability, never hidden or blocked (option D).

## User Scenarios & Testing

### User Story 1 - Staff record a payment and see what the order owes (Priority: P1) 🎯 MVP

A user with payment permission records a payment against an Order: amount (EGP), date and time, payment method, source/location, optional note. The order's finance panel immediately shows Total (the sum of the Order's Work Item prices from 051), Paid (the sum of non-void payments), and Remaining (Total − Paid − applied credits). Payments may be partial — a deposit today, the balance later — and multiple payments accumulate. Delivery staff see the same Total/Paid/Remaining read-only on the delivery screen so they know what to collect at hand-over.

**Why this priority**: Money in is the core of this feature; nothing else (balances, profitability, cash summary) exists without payment records.

**Independent Test**: Record a 50% deposit, then the balance, on a priced order; confirm Paid and Remaining update correctly; record a partial payment on a second order and confirm Remaining stays positive. Read the delivery screen values as a delivery user without finance permissions.

**Acceptance Scenarios**:

1. **Given** a priced order with Total 1000 EGP and no payments, **when** a user with `payment.record` records a 400 EGP cash payment at the reception desk, **then** Paid = 400, Remaining = 600, and the payment shows amount, date, time, method, source, recorder, and note.
2. **Given** that order, **when** a second 600 EGP bank-transfer payment is recorded, **then** Paid = 1000 and Remaining = 0.
3. **Given** an order with pending-priced Work Items, **when** its summary is viewed, **then** the Total reflects only priced Work Items and the summary flags that pricing is still incomplete.
4. **Given** a delivery user with `delivery.record` but no `finance.view`, **when** they open the delivery screen, **then** they see Total, Paid, Remaining, and whether the customer is covered by approved credit — read-only, with no payment history and no ability to record payments.
5. **Given** a user without `payment.record`, **when** they attempt to record a payment, **then** the server refuses and no payment or audit event is written.
6. **Given** an order with Remaining 200 EGP, **when** a user records a 250 EGP payment, **then** it is accepted as recorded, Paid increases by 250, and Remaining becomes −50.
7. **Given** an order with Remaining > 0 and no approved credit, **when** a delivery user attempts to finalize hand-over without choosing "payment collected" or "will pay later", **then** it cannot be finalized; after choosing one (recorded with actor and timestamp), hand-over completes — the balance itself never blocks the `DELIVERED` transition.

---

### User Story 2 - Mistakes are fixed by voiding, never by editing (Priority: P1)

A payment, once recorded, can never be edited or deleted. When a payment was entered wrong, a user holding the `payment.void` permission voids it with a mandatory reason. The original record stays visible and retrievable; it is simply excluded from Paid and from every total. Every void writes an audit event naming who voided it, when, and why.

**Why this priority**: Immutability and auditable reversal are constitution-level requirements (III, §55 Rules 6/8) that must hold from the very first payment; retrofitting them later is impossible without migrating history.

**Independent Test**: Record a payment, attempt every available update and delete path, and confirm none exists; void it with a reason and confirm the original still appears in history with a void marker while Paid drops back; attempt to void as Reception (no `payment.void`) and confirm refusal.

**Acceptance Scenarios**:

1. **Given** a recorded payment, **when** any server entry point is asked to update or delete it, **then** no such path exists and the record is unchanged.
2. **Given** a recorded payment, **when** a user with `payment.void` voids it with a reason, **then** the original remains readable with void status, reason, actor, and timestamp, and the amount is excluded from Paid and Remaining calculations.
3. **Given** a void without a reason, **when** any user submits it, **then** validation fails and nothing is written.
4. **Given** a user without `payment.void` (e.g. Reception), **when** they attempt a void, **then** it fails with a forbidden error and no audit event is written.
5. **Given** an already-voided payment, **when** a second void is attempted, **then** it is refused.

---

### User Story 3 - Finance sees the customer's balance across all orders (Priority: P2)

Finance can open a customer's profile and read the Payments & balance tab (the slot reserved by 010): the customer's balance summed across all of their orders, plus a per-order breakdown of Total / Paid / Remaining. Customers flagged for credit may carry a positive outstanding balance; the Cash Customer never can. The tab also shows the credit flag and optional credit limit.

**Why this priority**: Debt tracking across orders is what separates a real shop ledger from per-order bookkeeping, but it depends on payments existing first.

**Independent Test**: Give a customer three orders with different paid states and confirm the balance equals the sum of the orders' Remaining amounts; confirm the Cash Customer shows no credit coverage.

**Acceptance Scenarios**:

1. **Given** customer A with orders remaining 200, −50 (overpaid), and 0, **when** the balance tab is opened, **then** the balance is 150 EGP and each order's figures are listed.
2. **Given** a credit-approved customer with a configured credit limit, **when** outstanding balance rises within the limit, **then** the tab shows the limit, the current usage, and the credit status.
3. **Given** the built-in Cash Customer, **when** any summary is computed, **then** it is never credit-approved and its orders never qualify for credit coverage.
4. **Given** a user without `finance.view`, **when** they open the balance tab, **then** the server refuses the read.

---

### User Story 4 - Accounting records expenses with receipts (Priority: P2)

An accounting user records an expense: amount, category (configurable list: Material, External production, Transport, Maintenance, Supplies, Other), date, employee, description, optionally linked to an Order or Work Item, and an optional receipt photo attached through the file feature (050). Expenses appear in a filterable expenses list. Where approval applies, the expense carries an approval status.

**Why this priority**: Money out is half of profitability; without expenses the gross-profit story is incomplete — but payments must exist first so cash flow views can reconcile.

**Independent Test**: Record a material expense linked to an order with a receipt photo; confirm it appears in the list with all fields and its attachment opens; record a general expense with no order link and confirm it is excluded from that order's job expenses.

**Acceptance Scenarios**:

1. **Given** a user with `expense.record`, **when** they record a 250 EGP transport expense dated today with a description, **then** it is stored with actor and timestamp and an audit event is written.
2. **Given** an expense linked to an Order, **when** the order's profitability is viewed, **then** it counts toward that order's Recorded Job Expenses and is clickable through to its source record.
3. **Given** an expense with a receipt photo, **when** the list is opened, **then** the attachment is viewable through authorized file access only.
4. **Given** a user without `expense.record`, **when** they attempt to record an expense, **then** the server refuses.
5. **Given** a category removed from configuration, **when** historical expenses using it are viewed, **then** they still display their recorded category.
6. **Given** a recorded expense, **when** any server entry point is asked to update or delete it, **then** no such path exists; **when** a user with `expense.record` voids it with a reason, **then** the original stays readable and is excluded from expense totals and every order's profitability.
7. **Given** a configured approval threshold of 1000 EGP, **when** a 1500 EGP expense is recorded, **then** it is stored immediately, counted in totals and profitability, and flagged "awaiting Admin/Owner approval" everywhere it appears; **when** an Admin/Owner approves it, **then** the flag clears and the approval (actor, timestamp) is audited; **when** a 400 EGP expense is recorded, **then** no approval flag appears.

---

### User Story 5 - Direct manufacturing costs are captured per order (Priority: P2)

Finance records direct manufacturing cost entries against an order (optionally a specific Work Item): material consumed, external vendor/production cost, and similar job costs, each with amount, date, description, and optional receipt attachment. Every entry names its source so cost inputs stay traceable.

**Why this priority**: Direct cost is the subtracted middle term of gross profit; it must exist before profitability means anything.

**Independent Test**: Record two direct costs against one order (one order-level, one Work-Item-level) and confirm both appear on the order's cost list, are clickable from the profitability view, and carry actor, date, and description.

**Acceptance Scenarios**:

1. **Given** a user with `expense.record`, **when** they record a 700 EGP external-print vendor cost against an order, **then** the entry is stored with amount, date, description, actor, and optional attachment, and an audit event is written.
2. **Given** a direct cost linked to a specific Work Item, **when** the order profitability view is opened, **then** it rolls into the order's Direct Manufacturing Cost and identifies its Work Item.
3. **Given** any direct cost, **when** its source is inspected, **then** actor, timestamp, description, and attachment (if any) are retrievable — no anonymous cost rows.
4. **Given** a recorded direct cost, **when** any server entry point is asked to update or delete it, **then** no such path exists; **when** it is voided with a reason, **then** the record stays retrievable and is excluded from profitability.

---

### User Story 6 - Order gross profit is explainable at a glance (Priority: P3)

For a priced order, the finance panel shows Gross Profit = Sales Revenue − Direct Manufacturing Cost − Recorded Job Expenses, where Sales Revenue is the sum of the Order's Work Item prices (051). Every number in the equation is a link: clicking Revenue opens the pricing records, clicking costs opens the cost entries, clicking expenses opens the expense records. The same figures feed the queries the reporting feature (090) will consume.

**Why this priority**: Profitability is the management payoff, but it is pure derivation — it needs prices, costs, and expenses to exist first.

**Independent Test**: On a fixture order with known prices, costs, and expenses, confirm the equation balances to the expected gross profit and each term opens its underlying records.

**Acceptance Scenarios**:

1. **Given** an order with revenue 1000, direct costs 300, and job expenses 100, **when** the profitability view is opened, **then** gross profit shows 600 and each term links to its source records.
2. **Given** an order with a Work Item still PENDING pricing, **when** the profitability view is opened, **then** revenue is flagged incomplete until pricing resolves.
3. **Given** an expense not linked to any order, **when** order profitability is computed, **then** it is excluded (it is an operating expense, not a job expense).

---

### User Story 7 - The daily cash picture is reconcilable (Priority: P3)

At end of day, a finance user opens a simple daily cash summary for a chosen date: total received, broken down by payment method (Cash, Card, Bank transfer, …), with counts, plus a link to the underlying payments. This supports the shop's drawer reconciliation ritual (Printex.md §13.1).

**Why this priority**: Useful for the end-of-shift hand-over to Accounting, but a reporting convenience over data that must already exist.

**Independent Test**: Record payments across several methods on one date and confirm the summary's per-method totals equal the sum of the underlying non-void payments for that date.

**Acceptance Scenarios**:

1. **Given** non-void payments on 2026-09-25 of 500 cash, 300 card, and 200 cash, **when** the daily summary for that date is opened, **then** Cash = 700 (2 payments), Card = 300 (1 payment), total = 1000.
2. **Given** a voided payment on that date, **when** the summary is computed, **then** it is excluded.
3. **Given** a user without `finance.view`, **when** they request the summary, **then** the server refuses.

---

### User Story 8 - A printed payment receipt is issued (Priority: P3)

After recording a payment, the recorder can print a simple payment receipt for the customer: shop name, receipt number, order reference, amount, method, date/time, recorder, and remaining balance.

**Why this priority**: A physical receipt builds customer trust at the counter but does not affect any ledger behavior.

**Independent Test**: Record a payment and print the receipt; confirm all listed fields match the stored payment and the computed remaining balance.

**Acceptance Scenarios**:

1. **Given** a recorded payment, **when** the print action is invoked, **then** a receipt renders with shop name, sequential receipt number, order reference, amount, method, timestamp, recorder, and remaining balance.
2. **Given** a voided payment, **when** a receipt for it is requested, **then** the receipt (if produced) is visibly marked VOID.

### Edge Cases

- A payment larger than the Remaining amount (overpayment) is accepted as recorded; Remaining may go ≤ 0 and the excess is surfaced as customer credit (015's `OrderFinanceSummary` allows `remaining <= 0`; refunds are out of scope). Whether that excess counts toward approved-credit coverage or a credit limit is governed solely by the credit policy (FR-010).
- Expenses and direct costs cannot be edited in place or deleted by any path; a wrongly entered amount is voided with a reason and re-entered, keeping both records.
- Voiding a payment after an order was financially closed re-runs closure evaluation; if Remaining becomes positive again without approved credit, the system raises a review notice — V1 does not silently reopen completed Work Items (assumption, see Assumptions).
- Order Total is incomplete while any required Work Item is PENDING pricing; the summary must say so rather than showing a falsely low Total.
- Voiding a payment twice, or voiding with an empty reason, is refused.
- Changing the configured payment-method or source lists never rewrites history: past payments keep the labels they were recorded with.
- The Cash Customer aggregates financially but every Cash Customer order keeps its own payments and summary.
- Concurrent payments against one order are serialized by the server; amounts are Decimal end-to-end — never floating point.
- An expense or cost with a missing optional attachment is still valid; an attachment is served only through authorized file access.
- A credit-coverage check at delivery reads `creditApproved` from the finance summary; when finance is not yet connected, 015 fails safe and the delivery screen says finance is unavailable.

## Functional Requirements

### Order summary & payments (PRD §22, §55 Rule 6)

- **FR-001**: The system MUST provide an order finance summary with Total (Decimal EGP, summed server-side from the order's current Work Item prices per 051), Paid (sum of non-void payments), and Remaining (Total − Paid − applied credits), computed on the server and never by the client.
- **FR-002**: The system MUST record a Payment with amount (positive Decimal EGP), date, time, method, source/location, recorder, optional note, and its order and customer references.
- **FR-003**: Payment methods and sources MUST be configurable data (seeded starter sets: methods Cash, Card, Bank transfer, InstaPay, Vodafone Cash, Cheque; sources Reception desk, Bank, Delivery driver) — not hard-coded enums (constitution VI).
- **FR-004**: Payments MUST be immutable: no server entry point may update or delete a Payment row; corrections happen ONLY by voiding.
- **FR-005**: A void MUST require the `payment.void` permission and a non-empty reason, MUST keep the original record visible with void status/actor/timestamp/reason, MUST exclude the amount from Paid, Remaining, and daily summaries, and MUST be refused on an already-voided payment.
- **FR-006**: Multiple payments per order MUST accumulate (partial payments and deposits), and the order finance panel MUST flag when pricing is incomplete because required Work Items are still pending — a panel-only indicator, not part of the delivery-facing summary (FR-024).
- **FR-007**: Every payment and every void MUST write an audit event (actor, action, entity, timestamp, before/after, reason for void) in the same transaction as the change (constitution III/V; 001 `audit.record`).
- **FR-008**: Every server entry point MUST authenticate the actor and authorize with 001's `authorize`: recording requires `payment.record`, voiding requires `payment.void`; reading order/payment history, the customer balance tab, the expenses list, direct-cost entries, the profitability view, and the daily cash summary requires `finance.view` (so read-only holders can view finance surfaces they may not write). The delivery screen's read-only Total/Paid/Remaining/creditApproved visibility for `delivery.record` holders is the sole exception and follows 015's contract (FR-024).

### Customer balance & credit (PRD §22–23)

- **FR-009**: The system MUST provide a customer balance = the sum of Remaining across all of the customer's orders, exposed through the `payments-balance` profile slot reserved by 010, with a per-order breakdown.
- **FR-010**: The system MUST support a `CustomerCredit` record (credit-approved flag + optional Decimal credit limit) associated with a customer — finance-owned data per Key Entities, NOT a mutation of the 010-owned Customer master row — and MUST expose whether an order's balance is covered by approved credit (`creditApproved`) through the order summary; the Cash Customer MUST never be credit-approved. Admin/Owner alone sets and changes the credit flag and limit. Exceeding the limit (or a positive balance on a non-flagged customer) MUST show a warning at order creation and on the delivery screen and MUST NEVER block order creation or delivery (warn-only in V1).
- **FR-011**: Cash Customer orders MUST be individually identifiable with their own payments and summaries (010 FR-011) while aggregating under the Cash Customer for balance views (FR-009); payment for Cash Customer orders is expected at delivery. When Remaining > 0 and the order has no approved credit, finalizing hand-over MUST require an explicit acknowledgment — "payment collected" or "will pay later" — recorded with actor and timestamp; the acknowledgment MUST NOT gate the `DELIVERED` transition itself (015 FR-027, FR-024), and financial closure stays blocked until paid (015 FR-028). The acknowledgment prompt lives in 015's hand-over flow, driven by 052's order summary.
- **FR-012**: The order summary MUST apply 015's CREDIT compensations (read via `listCompensationsForOrder`) when computing Remaining, so discrepancy credits reduce what the customer owes.

### Expenses & direct costs (PRD §30–31)

- **FR-013**: The system MUST record an Expense with amount (positive Decimal EGP), category, date, employee, description, optional linked Order/Work Item, optional receipt attachment via 050's `attachments.attach`, approval status, and actor. An Admin-configured approval threshold applies: an expense at/above the threshold MUST be flagged "awaiting Admin/Owner approval" on the expense itself, in the expenses list, and anywhere it appears, until an Admin/Owner user approves it; recording is never delayed, totals and profitability always include it, and approval NEVER blocks or hides an expense. The threshold is configurable data; below it no approval flag appears. Per 050's contract, entity-ownership authorization for the attachment's target stays with 052: the recording action MUST verify the actor may write that Expense/Direct Cost (FR-016's `expense.record` gate) before attaching, and serving a receipt MUST re-check the actor's read scope on that record in addition to 050's download-route authorization.
- **FR-014**: Expense categories MUST be configurable data seeded with Material, External production, Transport, Maintenance, Supplies, Other; historical expenses retain their recorded category even if it is later removed from configuration.
- **FR-015**: The system MUST record Direct Manufacturing Cost entries per order (optionally per Work Item) with amount, date, description, actor, and optional attachment; every cost and expense MUST remain traceable to its source record (PRD §30, constitution III).
- **FR-016**: Recording or voiding an expense or cost MUST require `expense.record`, MUST validate amounts server-side, and MUST write an audit event in the same transaction. Expenses and Direct Costs MUST NOT be hard-deleted or edited in place by any server entry point: corrections MUST be made by voiding with a mandatory reason (the original stays readable and is excluded from expense totals and profitability, mirroring FR-004/FR-005), and any approval-status transition MUST write an audit event with actor, timestamp, and previous/new values in the same transaction (constitution III — removal is modeled as Void, never as deletion).
- **FR-017**: The system MUST provide a filterable expenses list (by date range, category, order, employee) and forms for expenses and direct costs, Arabic-first RTL.

### Profitability & reporting data (PRD §30, §32)

- **FR-018**: The system MUST compute order gross profit server-side as Sales Revenue (sum of current Work Item prices per 051) − Direct Manufacturing Cost − Recorded Job Expenses (order-linked expenses only), every term linked to its underlying records, with a clear indicator when revenue is incomplete due to pending pricing.
- **FR-019**: The system MUST expose read queries (order summary, customer balance, payments by date/method, expense and cost listings, gross profit inputs) for the reporting feature (090) to consume; big reports and charts themselves are out of scope here.
- **FR-020**: The system MUST provide a daily cash summary for a selected date showing non-void payments grouped by method with counts and totals, drillable to the underlying payments.

### Screens & receipts (PRD §22, constitution IX)

- **FR-021**: The system MUST provide a payments area on the order detail page (filling the placeholder 011 left), the customer-profile Payments & balance tab (010's slot), a record-payment dialog, an expenses list with form, a direct-cost entry form, the profitability view, and the daily cash summary — all Arabic-first, task-oriented, minimal clicks.
- **FR-022**: The system MUST provide a printable payment receipt (shop name, sequential receipt number, order reference, amount, method, date/time, recorder, remaining balance), printable after recording and re-printable from payment history; voided payments' receipts MUST be visibly marked VOID; the default render target is A5 with the layout kept paper-width-agnostic so an 80 mm thermal variant can be added by configuration without rework.

### Integration, ports & scope boundaries

- **FR-023**: The system MUST implement and bind 015's `FinanceSummaryPort` (`orderSummary(orderId)`, returning 015's frozen `OrderFinanceSummary` shape — `AVAILABLE` with `currency: "EGP"`, Decimal `total`/`paid`/`remaining`, boolean `creditApproved`, or `UNAVAILABLE` with a `reason` until finance exists) and MUST call 015's `tryFinancialClosure(actor, orderId)` after each payment or void transaction commits — outside that transaction. The call's result is informational only: a non-closing result (`closed: false`) is NOT an error and MUST NOT fail, roll back, or otherwise alter the already-committed payment or void.
- **FR-024**: Delivery MUST NOT be blocked by an unpaid balance (015 FR-027); the delivery screen's read-only Total/Paid/Remaining/creditApproved visibility for `delivery.record` holders is accepted as specified by 015 (see Assumptions).
- **FR-025**: Accounting-role users MUST NOT gain any ability to modify customers, production workflow, or prices through this feature (PRD §29, §48) — credit standing lives on the finance-owned `CustomerCredit` record, not on the Customer master (010); the feature adds only the finance permissions `payment.record`, `payment.void`, `expense.record`, `finance.view` as already frozen in 001.
- **FR-026**: All monetary values MUST be Decimal EGP end-to-end; totals are computed server-side only; no floating-point money anywhere (constitution "Money").
- **FR-027**: All Payment, Expense, and DirectCost timestamps MUST be stored in UTC and rendered in the shop's local timezone (constitution "Time"); the daily cash summary (FR-020) and date-range filters (FR-017) MUST bucket records by shop-local calendar date, never by the UTC date.
- **FR-028**: This feature MUST NOT build payroll, overhead allocation, double-entry accounting, tax invoices/e-invoicing, price setting (051), inventory, big financial reports/charts (090), or refund/chargeback processing.

## Key Entities

- **Payment**: Immutable money-in record: amount, date, time, method, source, recorder, note, order, customer, status (posted/void), void metadata (reason, actor, timestamp), receipt number.
- **OrderFinancePanelData**: Derived, panel-only view of one order: Total, Paid, Remaining, creditApproved, pricing-incomplete flag. Not stored as an editable value. Distinct from 015's frozen port type `OrderFinanceSummary` (015 contracts/ports.md §2: `AVAILABLE` with `currency: "EGP"`, Decimal `total`/`paid`/`remaining`, boolean `creditApproved`, or `UNAVAILABLE` with `reason`) — the pricing-incomplete flag MUST NOT be added to that port or surfaced on the delivery sheet (FR-024).
- **CustomerCredit**: Finance-owned credit standing for a customer: credit-approved flag, optional Decimal limit (subject to the credit clarification).
- **Expense**: Money-out record with category, date, employee, description, optional order/work-item link, optional attachment, optional approval status, actor, status (posted/void) and void metadata (reason, actor, timestamp).
- **DirectCost**: Job cost entry tied to an order (optionally a Work Item) with amount, date, description, actor, optional attachment, status (posted/void) and void metadata — the traceable "source" of manufacturing cost.
- **PaymentMethod / PaymentSource / ExpenseCategory**: Configurable reference data (seeded starter sets; history keeps recorded labels).
- **DailyCashLine**: Derived per-method total and count for one date — computed, not stored.

`Order`, `WorkItem`, `Customer` (incl. Cash Customer), pricing records, `Attachment`, `Actor`/permissions, and `AuditEvent` remain owned by 011/002, 010, 051, 050, and 001 respectively.

## Out of Scope

- Payroll, salaries, overhead allocation (Phase 2).
- Full double-entry accounting / chart of accounts.
- Tax invoices / e-invoicing (unless the owner confirms the shop legally needs it now).
- Setting or changing prices (051).
- Big financial reports and charts (090) — 052 only supplies the data queries.
- Inventory and material stock accounting.
- Refunds, chargebacks, multi-currency, and point-of-sale hardware integration.
- Shift/Drawer management beyond the read-only daily cash summary (Printex.md §13.1 full shift lifecycle is future work).

## Success Criteria

- **SC-001**: On a fixture order with partial and voided payments, Remaining always equals Total − sum of non-void payments − applied credits, verified by test.
- **SC-002**: 100% of attempted Payment, Expense, and DirectCost updates and deletes through any server entry point are impossible; a voided payment, expense, or cost remains fully retrievable with its original values.
- **SC-003**: A user without `payment.void` (e.g. Reception) is refused 100% of void attempts, and 0% of voids succeed without a reason.
- **SC-004**: On a fixture order, gross profit equals revenue − direct costs − job expenses exactly, and each term opens its source records.
- **SC-005**: 100% of payments, voids, expense/cost entries, expense/cost voids, and approval-status transitions write an audit event with actor, timestamp, previous/new values, and reason-where-required, committed atomically with the change.
- **SC-006**: Customer balance across multiple orders equals the sum of per-order Remaining values, and the Cash Customer is never credit-approved.
- **SC-007**: The daily cash summary's per-method totals equal the sum of that shop-local date's non-void payments, drillable to individual payments.
- **SC-008**: All money values are Decimal-backed end-to-end; no floating-point amount is persisted or displayed as authoritative.
- **SC-009**: After any payment or void commits, financial closure is re-evaluated automatically (015); an order with a remaining balance and no approved credit MUST NOT reach financial closure (refused per 015 FR-030), and if such an order is completed by any other path a review notice is raised (see the Void-after-closure assumption).
- **SC-010**: Invoking print on a recorded payment — immediately after recording or re-printed from payment history — renders a receipt within 5 seconds, with fields matching the stored payment and the Remaining balance at print time.
- **SC-011**: Under normal LAN conditions, an order finance summary and a customer balance load within 500 ms at p95, and a single payment records (including audit) within 500 ms at p95.
- **SC-012**: A payment recorded at 23:30 shop-local time appears in that shop-local date's daily cash summary; UTC storage never shifts a payment into an adjacent day's bucket.

## Assumptions

- **Revenue basis**: Order Sales Revenue for profitability is the accrual sum of current Work Item prices (051), not cash received; cash-basis reporting belongs to 090's queries.
- **Delivery visibility**: 015's clarification — delivery-record holders see Total/Paid/Remaining/creditApproved read-only without payment history — is accepted by 052 as correct (the person handing over must know what to collect; PRD §19/§22).
- **Cash Customer payment**: Per Printex.md §13.2, cash walk-ins pay in full on or before delivery, and 015 forbids unpaid balances from blocking delivery itself — hand-over therefore requires an explicit collected/will-pay-later acknowledgment when a balance remains, with closure blocked until paid (Clarifications 2026-09-25, FR-011).
- **Credit standing**: Per Printex.md §13.2, commercial/account customers carry debit balances up to management-approved credit limits; Admin/Owner approves and maintains the credit flag and limit, and enforcement is warn-only in V1 (Clarifications 2026-09-25, FR-010).
- **Overpayment**: Remaining may be ≤ 0 (015 contract), surfaced as customer credit; refunds are out of scope.
- **Void after closure**: A void that re-opens a positive remaining on a completed order raises a review notice; V1 does not automatically reverse completion.
- **Receipt format**: Default is a simple A5-style printable receipt generated by the app, laid out paper-width-agnostic so an 80 mm thermal variant can be configured later — no hardware dependency is assumed in V1.
- **Method/source starter sets**: The starter lists in FR-003 come from the issue brief and Printex.md/DEMO evidence; the owner may edit them as configuration before go-live.
- **Approval**: Expenses at/above an Admin-configured threshold are flagged "awaiting Admin/Owner approval" until an Admin/Owner approves them; the flag never blocks recording, counting, or visibility (Clarifications 2026-09-25, FR-013).
- **Receipt numbering**: Sequential receipt numbers are per-shop and gapless-enough for a single LAN deployment; strict fiscal numbering is a tax-invoicing concern, out of scope.
- **090 queries**: 052 ships data access only; no charts or report layouts are specified here.

## Dependencies

- **Consumes**: 051 `pricing.status`/current Work Item prices (order Total & revenue); 010 Customer + Cash Customer + the `payments-balance` profile slot; 011 Order/Work Item references and the order-detail payments placeholder; 050 `attachments.attach` (receipt photos); 001 `authorize`, `audit.record`, `getActor`, and the frozen permissions `payment.record`, `payment.void`, `expense.record`, `finance.view`; 015 `FinanceSummaryPort` shape, `tryFinancialClosure`, `listCompensationsForOrder` (CREDIT compensations), and the delivery read-only summary contract; 002 notification/audit plumbing where payments need notices.
- **Provides**: `finance.orderSummary(orderId)`, `finance.customerBalance(customerId)`, `recordPayment()`, `voidPayment()`, `recordExpense()`, `recordDirectCost()`, the bound `FinanceSummaryPort` provider, `<OrderFinancePanel>`, `<CustomerBalanceTab>` (fills 010's slot), the order payments area, the expenses list/forms, the daily cash summary queries, the profitability queries, and the printable receipt.
- **Cross-contract**: 015 consumes the bound `FinanceSummaryPort.orderSummary(orderId)` (015 contracts/ports.md §2) for the delivery sheet and financial closure — `finance.orderSummary` is 052's provider-side API name (see Provides/FR-023); 090 consumes the read queries listed in FR-019; 053/054 may be notified of payment events later — no messaging is required in V1.

## Notes for Planning

- Permission vocabulary is frozen in 001 (`payment.record`, `payment.void`, `expense.record`, `finance.view`); any addition must be coordinated through 001, not invented here. The expense-approval transition and the credit flag/limit write (FR-010, FR-013) are performed by Admin/Owner through an existing 001 admin-scope permission — map the exact key in `plan.md`; no new permission key is introduced by 052.
- `FinanceSummaryPort` must return `UNAVAILABLE` until bound; 015 already fails safe (`FINANCE_UNAVAILABLE`) — do not weaken that default.
- Closure re-evaluation (`tryFinancialClosure`) MUST be called only after the payment/void transaction commits, never inside it (015 research.md §5).
- 015 authorizes `tryFinancialClosure` with any of `delivery.record`, `collection.receive`, `payment.record` — not `payment.void`. Seeded roles that can void (Accounting, Admin/Owner) also hold `payment.record`, so the void-triggered re-run passes; if a void-only per-user grant ever occurs, a forbidden result there is benign — a void can only worsen `UNPAID_BALANCE`, and V1 never reverses completion (Void-after-closure assumption).
- Monetary values persist as exact decimal types per the constitution's Money constraint (never floating point); API boundaries carry validated decimal strings (051/001 convention).
- Clarification answers from `/speckit-clarify` replace the three unresolved decisions — FR-010 (credit policy), FR-011 (Cash Customer payment gate), FR-013 (expense approval) — before planning.
- Backup scope: payments, expenses, costs, configuration, and attachments must be included in the existing backup plan (constitution Backups).
