# Contracts: Finance Ports (015 seams)

Three seams connect 052 to 015 (spec FR-023, FR-012, FR-011). 015 is not yet implemented (0/72 tasks), so every port has a safe default and 052 takes **no compile-time dependency** on `~/server/collection` — the same inversion 051 used for `PricingGatePort`. All ports are exported from `~/server/finance` and bound once at module load (double-bind throws `PORT_ALREADY_BOUND`, 015 ports.md pattern).

## 1. `FinanceSummaryPort` — implemented BY 052, bound BY 015

052 provides the provider that 015's `bindFinanceSummaryPort` accepts. Shape is copied verbatim from 015 contracts/ports.md §2:

```ts
export type OrderFinanceSummary =
  | { readonly status: "AVAILABLE"; readonly currency: "EGP";
      readonly total: Prisma.Decimal; readonly paid: Prisma.Decimal;
      readonly remaining: Prisma.Decimal;   // total - paid - applied credits; may be <= 0
      readonly creditApproved: boolean }
  | { readonly status: "UNAVAILABLE"; readonly reason: string };

export const financeSummaryProvider: FinanceSummaryPort; // { orderSummary(orderId) }
```

| Aspect | Agreement |
|---|---|
| Source data | Delegates to `finance.orderSummary` internally, then **projects** the frozen shape — `pricingIncomplete` and `counts` are dropped; 015's delivery sheet never sees panel-only fields |
| Unbound default (015 side) | 015's own default `{ status: "UNAVAILABLE", reason: "Finance module not connected" }` still applies until 015 binds this provider |
| Cash Customer | `creditApproved` always `false` for `isCashCustomer` |
| Credits | Remaining subtracts CREDIT compensations via port 2; empty port → credits = 0 (conservative) |
| Visibility | 015 shows the projection to `delivery.record` holders (052 confirmed acceptable — spec Assumptions) |

## 2. `FinancialClosurePort` — called BY 052, bound BY 015 with `tryFinancialClosure`

```ts
export type FinancialClosureFn = (actor: Actor, orderId: string) =>
  Promise<{ closed: boolean; unmet?: readonly string[] }>;

export function bindFinancialClosurePort(fn: FinancialClosureFn): void;
// default (unbound): async () => ({ closed: false, unmet: ["FINANCE_NOT_CONNECTED"] }) + one-time log
```

Call sites: after each `recordPayment` / `voidPayment` transaction **commits** (spec FR-023 — outside the `tx`, 015 research.md §5). The result is informational: `closed: false` is never an error, never rolls back or alters the committed payment (FR-023; 015 ports.md "a `closed: false` result is not an error").

Authorization note: 015 authorizes `tryFinancialClosure` with any of `delivery.record | collection.receive | payment.record` — not `payment.void`. Seeded voiders (Accounting, Admin/Owner) also hold `payment.record`, so the void-triggered call passes; a void-only grant receiving `FORBIDDEN` is benign (a void can only worsen `UNPAID_BALANCE`).

Unbound behavior is correct, not degraded: closure conditions cannot become *more* satisfied by a payment that just landed in a system that has no closure evaluator yet, and 015 re-evaluates closure on its own delivery/resolution/manual triggers when it ships.

## 3. `CompensationReadPort` — called BY 052 for credit application, bound BY 015 with `listCompensationsForOrder`

```ts
export type CreditCompensation = { readonly id: string; readonly amount: string; readonly orderId: string };
export function bindCompensationReadPort(fn: (orderId: string) => Promise<readonly CreditCompensation[]>): void;
// default (unbound): async () => []
```

Used by `orderSummary` and `customerBalance` to subtract applied CREDIT compensations from `remaining` (FR-012; 015 ports.md "052 applies CREDIT compensations (read via listCompensationsForOrder)"). Empty default: no credits exist before 015's `Compensation` model, so Remaining is simply total − paid — conservative (never silently discounts a debt).

052 filters to `kind === "CREDIT"` only; PRICE_ADJUSTMENT rows are 051's concern (pending price application), not a balance reduction.

## 4. Hand-over acknowledgment data (FR-011)

Not a port: the acknowledgment UI lives in 015's hand-over flow. 052 supplies `orderSummary` fields (`remaining`, `creditApproved`) through port 1; 015 records the "payment collected" / "will pay later" choice in its own hand-over entity. 052 never renders or stores the acknowledgment.

## Binding lifecycle

- Each port's `bind…` lives in `src/server/finance/ports.ts`; `~/server/finance/index.ts` exports them.
- 015's instrumentation boot hook (`src/instrumentation.ts`, per 015 research.md §4) will `await import("~/server/finance")` and call the binds before the first request — 052 adds no binding requirement of its own for these three.
- Until then: payments, voids, summaries, expenses, costs, profitability, and cash summary all fully functional with ports unbound.
