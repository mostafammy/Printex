# Contract: Pricing Service

## Public surface

The public module is `~/server/pricing`; internal files are not imported by consumers.

```ts
export type PricingUnit =
  | "PIECE"
  | "SQUARE_METER"
  | "LINEAR_METER"
  | "SHEET"
  | "PACK";

export type PricingMode = "FIXED" | "VARIABLE";
export type PriceSource = "LIST" | "CUSTOMER_RULE" | "MANUAL";
export type PricingStatusValue = "PENDING" | "PRICED" | "DISPUTED";

export type QuoteInput = {
  readonly workItemId: string;
  readonly customerId: string;
  readonly asOf: Date;
};

export type QuoteBreakdown = {
  readonly unit: PricingUnit;
  readonly quantity: string;
  readonly widthMeters?: string;
  readonly heightMeters?: string;
  readonly areaPerPiece?: string;
  readonly totalArea?: string;
  readonly tierId?: string;
  readonly priceListId?: string;
  readonly customerRuleId?: string;
  readonly baseAmount: string;
  readonly adjustmentAmount: string;
  readonly taxIncluded: true;
  readonly finalAmount: string;
  readonly rounding: "NEAREST_EGP";
};

export type QuoteResult = {
  readonly amount: string;
  readonly currency: "EGP";
  readonly breakdown: QuoteBreakdown;
};

export function quote(input: QuoteInput): Promise<Result<QuoteResult, PricingError>>;
export function setPrice(input: SetPriceInput): Promise<Result<PriceSnapshot, PricingError>>;
export function status(workItemId: string): Promise<Result<PricingStatus, PricingError>>;
export function pendingSince(workItemId: string): Promise<Result<Date | null, PricingError>>;
```

The issue-level shorthand `pricing.quote(workItem, customer, date)` maps to `QuoteInput`; IDs are resolved server-side. Amounts and Decimal fields cross the boundary as canonical decimal strings.

## `setPrice`

```ts
export type SetPriceInput =
  | { readonly workItemId: string; readonly kind: "APPLY_QUOTE"; readonly quote: QuoteResult }
  | { readonly workItemId: string; readonly kind: "VARIABLE"; readonly amount: string; readonly reason: string }
  | { readonly workItemId: string; readonly kind: "OVERRIDE"; readonly amount: string; readonly reason: string };
```

- `APPLY_QUOTE` requires `pricing.use_fixed` and a current FIXED ProductType mode.
- `VARIABLE` requires `pricing.set_variable`.
- `OVERRIDE` requires `pricing.override` and a non-empty reason.
- Every mutation runs authorization, validation, price append, status update, and audit in one transaction.
- Existing price history is never updated or deleted.

## Errors

At minimum: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `PRICE_NOT_FOUND`, `TIER_OVERLAP`, `EFFECTIVE_DATE_CONFLICT`, `INVALID_DIMENSIONS`, `INVALID_AMOUNT`, `PRICING_DISPUTED`, `STALE_SPEC_VERSION`, and `PRICING_UNRESOLVED` for the delivery-facing result.

## Status semantics

- `PENDING`: no valid current price for the current specification.
- `PRICED`: a current WorkItemPrice exists for the current specification version.
- `DISPUTED`: a price issue is open; delivery treats it as unresolved.
- `waitingSince` is set on entry to PENDING and returned to 053.
