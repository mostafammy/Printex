# Read Queries for Reporting (090)

Owner: 052. Consumers: 090 (big reports/charts — out of scope here) and 052's own screens. Every query is a read-only projection over existing rows — no stored derived state, no side effects, authorization enforced by the *calling* entry point (queries take no `actor`; callers authorize first, `listCompensationsForOrder` precedent).

All amounts return decimal strings; dates return UTC instants plus the shop-local date where bucketing applies.

## Payments

```ts
listPayments(filter: {
  orderId?; customerId?;
  from?; to?;                 // inclusive range on occurredAt (shop-local day boundaries → UTC)
  method?; includeVoided?: boolean;  // default false
  page?; pageSize?;
}): Promise<{ rows: PaymentRow[]; nextCursor? }>
// PaymentRow: id, orderId, customerId, amount, method, source, occurredAt, recordedById,
//             receiptNumber, note, voided: { reason, voidedById, voidedAt } | null

dailyCashSummary(date: string /* shop-local YYYY-MM-DD */, opts?: { method?: string }): Promise<{
  date: string;
  timezone: string;
  lines: Array<{ method: string; count: number; total: string }>;
  grandTotal: string;
  paymentIds: string[];       // drill-down
}>

getReceipt(paymentId: string): Promise<ReceiptProjection | null>   // see ui.md receipt fields
```

## Balances & summaries

```ts
orderSummary(orderId): Promise<OrderFinancePanelData>       // finance-service.md
customerBalance(customerId): Promise<CustomerBalance>       // finance-service.md
listCustomerBalances(filter?: { creditApproved?; positiveOnly?; page? }): Promise<…>
// customer-level rollup for debt reports (090): customerId, name, balance, creditApproved, creditLimit
```

## Expenses & costs

```ts
listExpenses(filter: {
  from?; to?;                 // expenseDate
  category?; orderId?; employee?;
  approval?: "awaiting" | "approved" | "none";   // derived, never stored
  includeVoided?: boolean; page?; pageSize?;
}): Promise<{ rows: ExpenseRow[]; nextCursor? }>

listDirectCosts(filter: { orderId?; workItemId?; from?; to?; includeVoided?; page? }):
  Promise<{ rows: DirectCostRow[]; nextCursor? }>
```

## Profitability

```ts
orderProfitability(orderId: string): Promise<{
  revenue: string;                       // Σ current WorkItem prices (051); pricingIncomplete flag alongside
  pricingIncomplete: boolean;
  directCosts: { total: string; entries: Array<{ id; amount; description; workItemId? }> };
  jobExpenses: { total: string; entries: Array<{ id; amount; category; expenseDate }> };
  grossProfit: string;                   // revenue - directCosts.total - jobExpenses.total
  sources: { priceIds: string[]; directCostIds: string[]; expenseIds: string[] };  // drill-down
}>
```

## Invariants every consumer may assume

- Voided records excluded unless `includeVoided`.
- Totals are Decimal-string sums computed in the database, never client-side.
- `dailyCashSummary` buckets by shop-local calendar date (UTC `occurredAt` + `FinanceConfig.shopTimezone`) — SC-012.
- Gross profit uses accrual revenue (prices), not cash received (spec Assumptions — revenue basis).
- No query mutates anything; none requires `finance.view` themselves — that check lives in the route/server action calling them.
