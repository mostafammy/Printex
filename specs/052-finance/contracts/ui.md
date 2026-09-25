# UI Contracts

All surfaces: Arabic-first, RTL (logical properties only), existing `(shell)` layout and design tokens, server Components + Server Actions calling `~/server/finance` — the client never computes money (FR-026). Loading, empty, forbidden, validation, and server-error states are explicit on every surface (house rule).

## `<OrderFinancePanel>`

```ts
type OrderFinancePanelProps = { readonly orderId: string };
```

- Fills 011's `placeholderPayments` slot in `src/app/(shell)/orders/[orderId]/page.tsx` (replaces `{S.placeholderPayments}`).
- Header block: Total · Paid · Remaining · credit badge · pricing-incomplete notice; delivery-visibility values are identical to what 015 projects.
- Payments list: date/time, method, source, amount, recorder, note, receipt number, status (posted/void — voided rows dimmed with reason), print-receipt action; void action (`payment.void`) opens a reason-required dialog.
- Record-payment action (`payment.record`): `<RecordPaymentDialog>` — amount (decimal input), method select + source select (from `FinanceConfig`), occurred-at (default now, future blocked), optional note; presets 100% / 50% deposit (DEMO convention) that prefill the amount, never auto-submit.
- Profitability block (below payments): Revenue − Direct Costs − Job Expenses = Gross Profit, each figure a link to its drill-down (contract `queries.md`).
- Read-only mode for `finance.view`-only holders: full visibility, no actions.

## `<CustomerBalanceTab>`

```ts
type CustomerBalanceTabProps = { readonly customerId: string };
```

- Fills 010's `slots.paymentsBalance` prop on `CustomerProfile` (`src/components/customers/customer-profile.tsx`).
- Balance headline (Σ Remaining), credit badge (approved / not / Cash Customer), credit limit + usage when set (over-limit → warning strip, never a block — Clarifications), per-order breakdown rows linking to each order's panel.
- Empty state for customers with no orders; forbidden state when `finance.view` absent.

## `<RecordPaymentDialog>`

Modal dialog (amount, method, source, occurred-at, note, presets). Validation mirrors server Zod (client hints only — server is authority). On success: toast + panel refresh; print-receipt offered immediately (SC-010).

## Expenses list + forms (`/finance/expenses`)

- **List**: date range, category, order, employee filters; columns date, category, amount, employee, order link, approval flag ("awaiting Admin/Owner approval" pill when `amount >= threshold && !approved`), voided state, receipt thumbnail/link. Pagination.
- **`<ExpenseForm>`** (record): amount, category (active list), date, employee, description, optional order/work-item picker, optional receipt upload; success → list. Approval action (Admin/Owner) inline on detail rows.
- **`<DirectCostForm>`**: order picker (required), optional work item, amount, date, description, optional receipt. Also reachable from the order panel ("Add job cost").

## Profitability view (within `<OrderFinancePanel>`)

Equation row with linked terms; clicking Revenue opens 051's price history for the order's Work Items; Direct Costs and Expenses open filtered lists scoped to the order. Pricing-incomplete banner when any required Work Item lacks a current price (revenue shown as partial).

## Daily cash summary (`/finance/daily-cash`)

Date picker (defaults today, shop-local), per-method rows: method · count · total, grand total, link from each row to the filtered payments list; voided payments excluded; `finance.view` required. Explicit note when selected date ≠ UTC date (transparency for SC-012).

## Payment receipt (print)

- Route: `/finance/receipt/[paymentId]` (print-optimized page; also reachable from payment history and the post-record dialog).
- Fields: shop name, sequential receipt number, order reference, customer name, amount, method, source, date/time (shop-local), recorder, Remaining after payment; VOID watermark when the payment is voided (FR-022).
- Render target A5, paper-width-agnostic CSS (max-width layout, no fixed viewport assumptions) so an 80 mm thermal profile can be added by configuration without rework. `window.print()`; no PDF service.

## Navigation

`(shell)/nav.ts`: add Finance group (Expenses, Daily cash) gated by `finance.view`. Order and customer surfaces rely on their hosts' existing access control.
