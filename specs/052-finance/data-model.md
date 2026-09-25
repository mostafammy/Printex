# Data Model: Finance — Payments, Expenses & Profitability

## Ownership boundary

052 adds finance records only. `Order`/`WorkItem` remain owned by 011/002, `Customer` (incl. Cash Customer) by 010, `WorkItemPrice`/pricing status by 051, `Attachment`/`FileObject` by 050, `User`/permissions/`AuditEvent` by 001. Delivery closure and `Compensation` rows stay owned by 015. `CustomerCredit` is 052-owned data associated with a customer — not a mutation of the Customer master.

## Immutability envelope

The tables `payment`, `expense`, `direct_cost`, `finance_void`, and `expense_approval` receive `REVOKE UPDATE, DELETE … FROM <app_role>` in the creating migration (raw SQL step, 001 `AuditEvent` precedent; non-superuser app-role prerequisite documented). Application code never issues those statements. All five tables are append-only; lifecycle state (voided, approved) is derived at read time from the existence of the corresponding `FinanceVoid` / `ExpenseApproval` row.

## Entities

### Payment

| Field | Type | Rules |
|---|---|---|
| `id` | String | immutable identifier |
| `orderId` | String | required FK to 011 Order; indexed |
| `customerId` | String | required FK to 010 Customer (order's customer at record time); indexed |
| `amount` | Decimal | required, `> 0`, EGP; never Float; no upper bound (overpayment allowed) |
| `currency` | String | `EGP` only in V1 |
| `method` | String | snapshot of the configured payment method label at record time |
| `source` | String | snapshot of the configured source/location label at record time |
| `note` | String? | optional |
| `occurredAt` | DateTime | payment date+time; default now; `<= now`; stored UTC |
| `recordedAt` | DateTime | server now, UTC; required audit metadata |
| `recordedById` | String | required FK to 001 User (`payment.record` holder) |
| `receiptNumber` | BigInt | from `receipt_sequence`; unique |

Relationships: belongs to Order and Customer; optional one `FinanceVoid` row (`entityType = PAYMENT`); referenced by 015's delivery read via `orderSummary`.

Validation (server, Zod): `amount` positive decimal string; `method`/`source` ∈ active `FinanceConfig` lists at record time; `occurredAt` not in the future. Receipt number allocated in the same transaction.

### FinanceVoid

| Field | Type | Rules |
|---|---|---|
| `id` | String | immutable identifier |
| `entityType` | enum | `PAYMENT` \| `EXPENSE` \| `DIRECT_COST` |
| `entityId` | String | id of the voided record |
| `reason` | String | required, non-empty (validated before `audit.record`) |
| `voidedById` | String | required FK to User (`payment.void` for payments; `expense.record` for expenses/costs) |
| `voidedAt` | DateTime | server now, UTC |

Constraints: `@@unique([entityType, entityId])` — structurally enforces single-void (double void = uniqueness violation). A voided record is excluded from Paid, daily cash, expense totals, and profitability, but stays fully retrievable.

### Expense

| Field | Type | Rules |
|---|---|---|
| `id` | String | immutable identifier |
| `amount` | Decimal | required, `> 0`, EGP |
| `category` | String | snapshot of configured category label at record time |
| `expenseDate` | DateTime | user-chosen calendar date (stored UTC midnight of that date; filtered as a plain date) |
| `employee` | String | responsible employee display name (PRD §31); free text — may be a non-user (e.g. supplier contact) |
| `description` | String | required |
| `orderId` | String? | optional FK to Order — links make it a Recorded Job Expense (counts in gross profit) |
| `workItemId` | String? | optional FK to Work Item; must belong to `orderId` when both set |
| `createdById` | String | required FK to User (`expense.record` holder) |
| `createdAt` | DateTime | server now, UTC |

Relationships: optional `FinanceVoid` (`EXPENSE`); optional one `ExpenseApproval`; optional `Attachment` rows (`entityType = "Expense"`, `entityId = expense.id`, via 050). An unlinked expense is an operating expense — excluded from order profitability (FR-018).

Validation: `amount > 0`; `category` ∈ active configured categories; approval threshold compare uses `amount` vs `FinanceConfig.approvalThreshold`.

### ExpenseApproval

| Field | Type | Rules |
|---|---|---|
| `expenseId` | String | required, **unique** FK to Expense — at most one approval per expense |
| `approvedById` | String | required FK to User (Admin/Owner) |
| `approvedAt` | DateTime | server now, UTC |

Derived state: an expense is "awaiting Admin/Owner approval" iff `amount >= approvalThreshold` AND no `ExpenseApproval` row exists. Approval never blocks recording, counting, or visibility (FR-013).

### DirectCost

| Field | Type | Rules |
|---|---|---|
| `id` | String | immutable identifier |
| `amount` | Decimal | required, `> 0`, EGP |
| `costDate` | DateTime | user-chosen calendar date (UTC midnight; filtered as plain date) |
| `description` | String | required — what the cost was (material, external vendor, …) |
| `orderId` | String | required FK to Order |
| `workItemId` | String? | optional FK to Work Item within `orderId` |
| `createdById` | String | required FK to User (`expense.record` holder) |
| `createdAt` | DateTime | server now, UTC |

Relationships: optional `FinanceVoid` (`DIRECT_COST`); optional `Attachment` (`entityType = "DirectCost"`). Always counts in its order's Direct Manufacturing Cost term (FR-018).

### CustomerCredit

| Field | Type | Rules |
|---|---|---|
| `customerId` | String | primary key / FK to 010 Customer — one row per customer |
| `creditApproved` | Boolean | default `false`; MUST be `false` for the Cash Customer (enforced in write path) |
| `creditLimit` | Decimal? | optional, `> 0` when set; warn-only in V1 |
| `updatedById` / `updatedAt` | String / DateTime | Admin/Owner only; audited (`credit.updated`) |

`creditApproved` in `orderSummary` is `creditApproved = row.creditApproved && !customer.isCashCustomer` — the pure flag, **not** limit-sensitive. The limit is warn-only (Clarifications 2026-09-25): exceeding it raises warnings at order creation and on the delivery screen but never flips `creditApproved` and never blocks anything, including financial closure's credit-coverage condition.

### FinanceConfig (singleton)

| Field | Type | Rules |
|---|---|---|
| `id` | String | constant `"finance-config"` |
| `paymentMethods` | Json | string array; starter seed: Cash, Card, Bank transfer, InstaPay, Vodafone Cash, Cheque |
| `paymentSources` | Json | string array; starter seed: Reception desk, Bank, Delivery driver |
| `expenseCategories` | Json | `{ label, active }[]`; starter labels: Material, External production, Transport, Maintenance, Supplies, Other |
| `approvalThreshold` | Decimal | Admin-configured; expenses `>=` this flag for approval |
| `shopTimezone` | String | default `Africa/Cairo`; used for shop-local day bucketing |
| `updatedById` / `updatedAt` | String / DateTime | Admin config write, audited (`config.updated`) |

Mutable by Admin (principle VI); startup seed from `config/052-finance.yaml` (FileConfig precedent). Removing/deactivating an item never affects history — money rows hold label snapshots.

## Derived (never stored)

- **OrderFinancePanelData** — Total = Σ `051.getCurrentPrice(workItemId)` over non-cancelled Work Items; Paid = Σ non-void `payment.amount` for the order; Remaining = Total − Paid − applied CREDIT compensations (compensation read port; empty until 015 binds); `creditApproved` per CustomerCredit rule; `pricingIncomplete` = any required Work Item lacks a current price. Panel-only — 015's frozen `OrderFinanceSummary` port shape is projected from this without the `pricingIncomplete` flag.
- **Customer balance** — Σ Remaining across the customer's orders.
- **Gross profit** — Sales Revenue − Direct Manufacturing Cost − Σ order-linked non-void expenses; each term carries its source IDs.
- **Daily cash line** — per-method sum + count of non-void payments whose `occurredAt` falls on the shop-local calendar date (UTC → `shopTimezone`).
- **Approval flag** — threshold test + existence of `ExpenseApproval`.

## Indexes (expected)

- `payment(orderId)`, `payment(customerId)`, `payment(occurredAt)` (daily cash + date ranges), unique `receiptNumber`.
- `expense(orderId)`, `expense(expenseDate)`, `expense(category)`; `direct_cost(orderId)`.
- `finance_void(entityType, entityId)` unique (constraint covers lookup).
- `attachment(entityType, entityId)` — exists in 050.

## State transitions

No workflow state machines exist in 052. Record lifecycle is binary and derived:

```text
posted  --void(reason, perm, audit)-->  voided   (FinanceVoid row appended; original untouched)
expense: awaiting-approval (amount >= threshold, no approval row)
         --approve(Admin/Owner, audit)--> approved   (ExpenseApproval row appended)
```

Double void: refused (unique constraint). Void after approval: allowed — void wins for totals; approval row remains as history. Approval of a voided expense: refused (validate before insert).
