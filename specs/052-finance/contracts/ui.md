# UI Contracts

All surfaces: Arabic-first, RTL (logical properties only), existing `(shell)` layout and design tokens, server Components + Server Actions calling `~/server/finance` — the client never computes money (FR-026). Loading, empty, forbidden, validation, and server-error states are explicit on every surface (house rule).

## `<OrderFinancePanel>`

```ts
type OrderFinancePanelProps = { readonly orderId: string };
```

- Fills 011's `placeholderPayments` slot in `src/app/(shell)/orders/[orderId]/page.tsx` (replaces `{S.placeholderPayments}`).
- Header block: Total · Paid · Remaining · credit badge · pricing-incomplete notice; delivery-visibility values are identical to what 015 projects.
- Payments list: date/time, method, source, amount, recorder, note, receipt number, status (posted/void — voided rows dimmed with reason), print-receipt action; void action (`payment.void`) is an **inline per-row reason-required form** (server enforces non-empty reason; no modal).
- Record-payment action (`payment.record`): `<RecordPaymentForm>` — a native `<details>` disclosure (no client JS, RTL-safe): amount (decimal input), method select + source select (from `FinanceConfig`, first active option preselected), occurred-at (default now, future blocked), optional note; presets 100% / 50% deposit are submit buttons whose amounts are resolved **server-side** from the current Remaining (Decimal math — client never computes money). (Amended with tasks.md T026/T019 — originally specified as a modal dialog.)
- Profitability block (below payments): Revenue − Direct Costs − Job Expenses = Gross Profit, each figure a link to its drill-down (contract `queries.md`).
- Read-only mode for `finance.view`-only holders: full visibility, no actions.

## `<CustomerBalanceTab>`

```ts
type CustomerBalanceTabProps = { readonly customerId: string };
```

- Fills 010's `slots.paymentsBalance` prop on `CustomerProfile` (`src/components/customers/customer-profile.tsx`).
- Balance headline (Σ Remaining), credit badge (approved / not / Cash Customer), credit limit + usage when set (over-limit → warning strip, never a block — Clarifications), per-order breakdown rows linking to each order's panel.
- Admin/Owner-only edit affordance: credit flag toggle + optional Decimal limit input + mandatory reason prompt, calling `updateCreditAction` (`admin.config`); all other viewers get the read-only badge only (FR-010).
- Empty state for customers with no orders; forbidden state when `finance.view` absent.

## `<RecordPaymentForm>` (amended — was `RecordPaymentDialog`)

Native `<details>` disclosure inside `<OrderFinancePanel>` (`src/components/finance/record-payment-form.tsx`) — amount, method, source, occurred-at, note, server-resolved presets. Validation lives in the service (client hints only — server is authority). On submit the server action revalidates the route so the panel refreshes; the print-receipt link is available on every payment row immediately after (SC-010). Void uses the inline per-row form described above — there is no separate void dialog component (tasks.md T026 amendment).

## Expenses list + forms (`/finance/expenses`)

- **List**: date range, category, order (`orderId` deep-link from profitability), employee filters; columns date, category, amount, employee, order link, approval flag ("awaiting Admin/Owner approval" pill when `amount >= threshold && !approved`), voided state, **receipt link** opening `/api/finance/expense-receipt/[expenseId]` (052 entity-scope check + 050 storage stream). Pagination.
- **Moderation visibility**: approve button only for `admin.config` holders; void form only for `expense.record` holders (Accounting sees void, not approve — tasks.md T071).
- **`<ExpenseForm>`** (record): amount, category (active list), date, employee, description, optional order/work-item picker, optional receipt upload; success → list. Approval action (Admin/Owner) inline on detail rows.
- **`<DirectCostForm>`**: order picker (required), optional work item, amount, date, description, optional receipt. Also reachable from the order panel ("Add job cost").

## Profitability view (within `<OrderFinancePanel>`)

Equation row where every term opens its source records (FR-018): **Revenue** expands into the per-Work-Item 051 price rows (each linking to its order), **Direct Costs** expand inline and deep-link to the panel's `#direct-costs` section, **Expenses** expand inline and deep-link to `/finance/expenses?orderId=…`. Pricing-incomplete banner when any required Work Item lacks a current price (revenue shown as partial ≈).

## Daily cash summary (`/finance/daily-cash`)

Date picker (defaults today, shop-local) + optional method filter, per-method rows: method (links to same day filtered by that method) · count · total, grand total linking to the `#payments-of-day` section **on the same page** — the actual Payment rows for the selected shop-local day (FR-020 drill-down); voided payments excluded; `finance.view` required. Date shown with its timezone (SC-012 transparency).

## Payment receipt (print)

- Route: `/finance/receipt/[paymentId]` (print-optimized page; reachable from every payment row — order panel and daily-cash list).
- Fields: shop name, sequential receipt number, order reference, customer name, amount, method, source, date/time (shop-local), recorder, Remaining after payment; VOID watermark when the payment is voided (FR-022).
- Render target A5, paper-width-agnostic CSS (max-width layout, no fixed viewport assumptions) so an 80 mm thermal profile can be added by configuration without rework. `window.print()`; no PDF service.

## Navigation

`(shell)/nav.ts`: Finance entries (Expenses, Daily cash) gated by the `ACCOUNTING`/`ADMIN_OWNER` roles; the pages themselves authorize `finance.view` server-side. Order and customer surfaces rely on their hosts' existing access control.
