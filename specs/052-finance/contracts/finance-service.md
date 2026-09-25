# Contract: Finance Service

Owner: 052 (this feature). Public module `~/server/finance`; internal files are never imported by consumers. All operations are server-authoritative: `getActor` → `authorize` → Zod validation → same-transaction audit → commit. Decimal fields cross the boundary as canonical decimal strings (051/001 convention).

## `recordPayment(input)`

```ts
type RecordPaymentInput = {
  readonly orderId: string;
  readonly amount: string;            // decimal string, > 0
  readonly method: string;            // must be in active FinanceConfig.paymentMethods
  readonly source: string;            // must be in active FinanceConfig.paymentSources
  readonly occurredAt?: Date;         // default now; must be <= now
  readonly note?: string;
};
// requires permission: payment.record
// returns: { paymentId, receiptNumber, orderId, customerId, summary: OrderFinancePanelData }
```

Behavior:
1. Load Order (must exist, not cancelled); derive `customerId` (010) at record time.
2. Validate amount/method/source/timestamp; allocate `receiptNumber` from `receipt_sequence`.
3. Insert immutable `Payment`; write audit `payment.recorded` (before: null, after: snapshot) in the same `tx`.
4. Commit, then invoke the closure port post-commit (see finance-ports.md) — never inside `tx`.
5. Errors: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `ORDER_NOT_FOUND`, `METHOD_NOT_CONFIGURED`, `SOURCE_NOT_CONFIGURED`.

## `voidPayment(input)`

```ts
type VoidPaymentInput = { readonly paymentId: string; readonly reason: string };
// requires permission: payment.void
// returns: { paymentId, voided: true, summary: OrderFinancePanelData }
```

Behavior:
1. Reject empty reason with `VALIDATION` **before** calling `audit.record` (001 policy for `payment.void`).
2. Insert `FinanceVoid(PAYMENT, paymentId)`; unique violation → `ALREADY_VOIDED`.
3. Audit `payment.voided` (before: payment snapshot, after: void row, reason required) in the same `tx`.
4. Post-commit: closure port (a void can only worsen `UNPAID_BALANCE`; result informational).
5. Post-commit: **void-after-close review notice** — if the order's Work Items are already `COMPLETED` and the void re-opens a positive remaining without approved credit, emit one internal notice through 002's `notify()` (`finance.void_after_close`, recipients: Accounting + Admin/Owner) so the reversal surfaces for review. V1 never reverses completion itself (spec Assumptions — Void after closure).
6. The payment row is never modified; it remains retrievable with a `voided` projection.

## `finance.orderSummary(orderId)`

```ts
// Provider-side name; also returned inside recordPayment/voidPayment responses.
// Shape-compatible projection of 015's frozen OrderFinanceSummary plus panel-only extras:
type OrderFinancePanelData = {
  readonly status: "AVAILABLE" | "UNAVAILABLE";
  readonly reason?: string;                 // when UNAVAILABLE (e.g. order missing)
  readonly currency: "EGP";
  readonly total: string;                   // Decimal string; null-safe: sums current 051 prices
  readonly paid: string;                    // Decimal string; non-void payments only
  readonly remaining: string;               // total - paid - applied credits; may be <= 0
  readonly creditApproved: boolean;         // CustomerCredit.creditApproved && !isCashCustomer (limit is warn-only, never flips this)
  readonly pricingIncomplete: boolean;      // PANEL-ONLY — never part of 015's port projection
  readonly counts: { payments: number; voidedPayments: number };
};
function orderSummary(orderId: string): Promise<OrderFinancePanelData>;
// requires permission: finance.view (delivery projection goes through FinanceSummaryPort — finance-ports.md)
```

## `finance.customerBalance(customerId)`

```ts
type CustomerBalance = {
  readonly customerId: string;
  readonly balance: string;                 // Σ per-order remaining; may be negative (overpaid)
  readonly creditApproved: boolean;
  readonly creditLimit: string | null;
  readonly orders: ReadonlyArray<{ orderId: string; total: string; paid: string; remaining: string; pricingIncomplete: boolean }>;
};
function customerBalance(customerId: string): Promise<CustomerBalance>;
// requires permission: finance.view
```

## `recordExpense(input)` / `voidExpense(input)` / `approveExpense(input)`

```ts
type RecordExpenseInput = {
  readonly amount: string;                  // > 0
  readonly category: string;                // active configured category
  readonly expenseDate: string;             // calendar date (YYYY-MM-DD)
  readonly employee: string;
  readonly description: string;
  readonly orderId?: string;
  readonly workItemId?: string;             // must belong to orderId when both set
  readonly receipt?: { stream; fileName };  // metadata created via 050 attachments.attach(tx, …) after the row insert, same tx
};
// recordExpense requires: expense.record  → audit `expense.recorded`
// approveExpense requires: Admin/Owner scope → inserts ExpenseApproval → audit `expense.approved`
//   refused when: amount < threshold (NOT_REQUIRED), already approved, or expense is voided
// voidExpense requires: expense.record     → FinanceVoid(EXPENSE) → audit `expense.voided` (reason required)
// returns: { expenseId, awaitingApproval: boolean, attachmentId?: string }
```

Attachment rule (FR-013 / 050 files.md): 052 verifies the actor may write/read the Expense or DirectCost record before `attachments.attach` and before serving receipt bytes; 050 re-checks file-level authorization on download.

## `recordDirectCost(input)` / `voidDirectCost(input)`

```ts
type RecordDirectCostInput = {
  readonly orderId: string;
  readonly workItemId?: string;
  readonly amount: string;                  // > 0
  readonly costDate: string;                // calendar date
  readonly description: string;
  readonly receipt?: { stream; fileName };
};
// recordDirectCost requires: expense.record → audit `direct_cost.recorded`
// voidDirectCost  requires: expense.record → FinanceVoid(DIRECT_COST) → audit `direct_cost.voided`
// returns: { directCostId, attachmentId?: string }
```

## Guarantees (all write paths)

- No function in this module — or any server entry point — issues `UPDATE`/`DELETE` on `payment`, `expense`, `direct_cost`, `finance_void`, `expense_approval` (DB `REVOKE` backstops the code).
- Every mutation commits its audit event atomically with the change (`audit.record(tx, …)`).
- Amounts validated as decimal strings and persisted as `Decimal`; no JavaScript floating-point arithmetic on money anywhere.
