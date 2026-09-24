# Contract: Pricing UI

## `<PricingPanel workItemId>`

The panel is a server-authoritative display and command surface. It receives a WorkItem ID and renders:

- ProductType identity, quantity, and dimensions from 011; authoritative pricing mode from 051's `ProductPricingPolicy`.
- Current amount, currency EGP, status, waiting age, source, actor, timestamp, and reason.
- Quote breakdown: unit, quantity, area, tier, list entry, customer rule, tax-inclusive amount, and rounding.
- Append-only price history and dispute state.
- Actions available only when the server authorizes them: apply fixed quote, set variable price, override, or record pricing issue.

The component must not calculate area, tiers, discounts, tax, or final amounts in browser code.

## Pricing queue

Route and query contract:

```ts
export type PricingQueueQuery = {
  readonly cursor?: string;
  readonly limit?: number;
  readonly priority?: "ALL" | "URGENT" | "NORMAL";
};

export type PricingQueueRow = {
  readonly workItemId: string;
  readonly orderId: string;
  readonly customerName: string;
  readonly productTypeName: string;
  readonly quantity: string;
  readonly priority: "URGENT" | "NORMAL";
  readonly waitingSince: Date;
  readonly ageLabel: string;
  readonly responsibleLabel: string;
};
```

The server orders rows with urgent items first, then by oldest waiting timestamp within each priority group. It calculates age from server time and excludes PRICED rows. Unauthorized users receive `FORBIDDEN`.

## Admin surfaces

- Price-list admin: ProductType, unit, tiers, base price, effective dates, history, retire action.
- Customer profile special-pricing tab: active and historical CustomerPricingRule rows, fixed/percentage kind, effective dates, and audit metadata.

Both surfaces use existing RTL shell, authorization, and audit conventions.
