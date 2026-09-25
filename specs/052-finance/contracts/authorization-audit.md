# Contract: Authorization & Audit

Owner: 001 (vocabulary + primitives). This file binds 052's usage. Every entry point: `getActor()` → `authorize(actor, permission)` as its first statement → Zod validation → mutation + `audit.record(tx, …)` in one transaction → commit.

## Permission mapping (frozen vocabulary — no new keys)

| Action | Permission | Seeded holders (001 matrix) |
|---|---|---|
| `recordPayment` | `payment.record` | Accounting, Admin/Owner |
| `recordExpense`, `recordDirectCost`, `voidExpense`, `voidDirectCost` | `expense.record` | Accounting, Admin/Owner |
| `voidPayment` | `payment.void` | Accounting, Admin/Owner — **not** Reception |
| `orderSummary` (own UI), `customerBalance`, expenses list, costs, profitability, daily cash, payment history | `finance.view` | Reception included (read-only surfaces) |
| Delivery sheet projection | `delivery.record` (015's gate — not a 052 check) | Print Reception/Delivery |
| Credit flag/limit write, expense approval, `FinanceConfig` write | existing Admin/Owner admin-scope key (`admin.config` or `admin.override` — exact key fixed in tasks; **no new permission key**) | Admin/Owner |

Reception specifics (acceptance): Reception holds `finance.view` but not `payment.record`/`expense.record`/`payment.void` — record attempts refuse with `FORBIDDEN` and write **no** audit event (audit fires only on committed mutations); void attempts refuse identically.

Every surface also re-checks authentication on read: no `Actor`, no data (001 `getActor` rejects `UNAUTHENTICATED`; `isActive: false` fails every call).

## Audit actions (all via `audit.record(tx, …)` — 001 is the only AuditEvent writer)

| Action | entityType | before / after | `reason` |
|---|---|---|---|
| `payment.recorded` | `Payment` | null → payment snapshot | optional (note passthrough) |
| `payment.voided` | `Payment` | payment snapshot → `{ voidId, reason }` | **required** (validated pre-audit, 001 FR-024 pattern) |
| `expense.recorded` | `Expense` | null → expense snapshot (+ `attachmentIds` when a receipt attaches) | optional |
| `expense.voided` | `Expense` | expense snapshot → `{ voidId, reason }` | **required** |
| `expense.approved` | `Expense` | `{ awaitingApproval: true }` → `{ approvedById }` | optional |
| `direct_cost.recorded` | `DirectCost` | null → cost snapshot (+ `attachmentIds`) | optional |
| `direct_cost.voided` | `DirectCost` | cost snapshot → `{ voidId, reason }` | **required** |
| `credit.updated` | `CustomerCredit` | previous flag/limit → new | **required** (override-class, 001 rule) |
| `config.updated` | `FinanceConfig` | previous config → new | optional |

Rules:
- One audit row per mutation, inserted through the caller's `tx` — commit or roll back atomically (constitution V).
- Reason policy: the calling feature validates *before* `audit.record` (001 audit.md) — voids and credit updates reject `VALIDATION` on empty reason with nothing written.
- `attachmentIds` on expense/cost records reference 050 `Attachment` rows created in the same transaction.
- No audit event on refused/forbidden/validation-failed attempts (nothing mutated).

## Immutability guarantee (defense in depth)

1. Application layer: no function in `src/server/finance/` (or anywhere) issues `UPDATE`/`DELETE` against the five money tables — corrections append `FinanceVoid`/`ExpenseApproval` rows.
2. Database layer: migration applies `REVOKE UPDATE, DELETE ON payment, expense, direct_cost, finance_void, expense_approval FROM <app_role>` (001 `AuditEvent` precedent). App role must be non-superuser (deployment prerequisite documented in the migration and quickstart).
3. Test layer: integration tests attempt update/delete through every exposed server action and assert `FORBIDDEN`/`VALIDATION`/absence of path (SC-002).

## Transaction ordering (every write path)

```text
getActor → authorize → Zod validate (incl. reason-before-audit rules)
→ BEGIN tx → insert mutation row (payment/expense/cost/void/approval)
→ audit.record(tx, …) → COMMIT
→ post-commit (payments/voids only): closure port call — errors logged, never rethrown
```

Post-commit closure is deliberately outside the transaction (015 research.md §5): a failing closure evaluator must never fail an already-valid payment.
