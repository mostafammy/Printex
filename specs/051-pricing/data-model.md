# Data Model: Pricing Engine

## Ownership boundary

051 adds pricing records only. `ProductType` remains owned by 011, `Customer` by 010, `WorkItem` and workflow state by 011/002, `Return` by 013, and delivery closure by 015.

## Entities

### PriceList

| Field | Type | Rules |
|---|---|---|
| `id` | String | immutable identifier |
| `productTypeId` | String | required FK to 011 ProductType |
| `unit` | PricingUnit | `PIECE`, `SQUARE_METER`, `LINEAR_METER`, `SHEET`, `PACK` |
| `effectiveFrom` | DateTime | inclusive |
| `effectiveTo` | DateTime? | exclusive; null means open-ended |
| `createdById` / `createdAt` | String / DateTime | required audit metadata |
| `status` | PriceConfigStatus | active or retired; retirement does not delete history |

A price list owns one or more `PriceTier` rows. A ProductType/unit may have only one effective tier for a quantity at a quote date. Effective intervals must not overlap for the same ProductType/unit/tier range.

### PriceTier

| Field | Type | Rules |
|---|---|---|
| `id` | String | immutable identifier |
| `priceListId` | String | required FK |
| `minimumQuantity` | Int | positive, inclusive |
| `maximumQuantity` | Int? | null means open-ended; otherwise >= minimum |
| `basePrice` | Decimal | positive EGP amount; never Float |

Tier boundaries are inclusive. The example tiers are 1-9, 10-49, and 50-null.

### CustomerPricingRule

| Field | Type | Rules |
|---|---|---|
| `id` | String | immutable identifier |
| `customerId` | String | required FK to 010 Customer |
| `productTypeId` | String | required FK to 011 ProductType |
| `kind` | CustomerRuleKind | `FIXED` or `PERCENT_DISCOUNT` |
| `fixedPrice` | Decimal? | required only for FIXED |
| `discountPercent` | Decimal? | required only for PERCENT_DISCOUNT; 0 <= value < 100 |
| `effectiveFrom` / `effectiveTo` | DateTime | inclusive / exclusive interval |
| `createdById` / `createdAt` | String / DateTime | required audit metadata |
| `status` | PriceConfigStatus | active or retired |

Customer rules are historical. Equal-precedence active matches are rejected as configuration errors. An expired or future rule is ignored.

### WorkItemPrice

| Field | Type | Rules |
|---|---|---|
| `id` | String | immutable identifier |
| `workItemId` | String | required FK; indexed by current/status lookup |
| `amount` | Decimal | positive whole-EGP final amount; persisted Decimal |
| `currency` | String | `EGP` only in V1 |
| `source` | PriceSource | `LIST`, `CUSTOMER_RULE`, or `MANUAL` |
| `quoteId` | String? | optional link to retained quote snapshot |
| `setById` | String | required User FK |
| `setAt` | DateTime | required |
| `reason` | String? | required for MANUAL and override actions |
| `breakdown` | Json | immutable server-produced explanation |
| `specVersionId` | String? | 016 version used for the decision |
| `replacedAt` | DateTime? | historical marker; never mutate amount/source/reason |

The current price is the latest valid record for the current specification version. A new price supersedes it by append-only insertion.

### PricingStatus

| Field | Type | Rules |
|---|---|---|
| `workItemId` | String | unique FK |
| `status` | PricingStatusValue | `PENDING`, `PRICED`, `DISPUTED` |
| `waitingSince` | DateTime? | set when entering PENDING; retained while unresolved |
| `disputeReason` | String? | required for DISPUTED |
| `updatedAt` | DateTime | required |
| `updatedById` | String? | actor for last mutation |
| `currentPriceId` | String? | set only when status is PRICED |

Pricing status is not a copy of `WorkItem.state`. A Work Item can be IN_PRODUCTION while PENDING.

## QuoteBreakdown

The quote service returns an immutable response and may retain it with the WorkItemPrice:

```ts
{
  unit: "SQUARE_METER";
  quantity: string;
  widthMeters?: string;
  heightMeters?: string;
  areaPerPiece?: string;
  totalArea?: string;
  tierId?: string;
  priceListId?: string;
  customerRuleId?: string;
  baseAmount: string;
  adjustmentAmount: string;
  taxIncluded: true;
  finalAmount: string;
  rounding: "NEAREST_EGP";
}
```

All Decimal values are serialized as canonical decimal strings at API boundaries.

## Derived calculation rules

1. `PIECE`, `SHEET`, and `PACK`: billable quantity is the WorkItem quantity.
2. `SQUARE_METER`: convert width and height to metres, calculate `width × height × quantity`.
3. `LINEAR_METER`: convert the linear dimension to metres and multiply by quantity.
4. Dimensions must be positive and complete for dimensional units. Area and linear calculations reject invalid units or zero values.
5. Select the active ProductType/unit price list at the supplied quote date, then select the inclusive tier containing quantity.
6. Apply the most specific active customer rule for the same Customer/ProductType/date. A fixed rule replaces the list amount; a percentage rule discounts it.
7. Tax is included in configured amounts in V1. Round only the final amount to the nearest 1 EGP.
8. A quote never writes data. `setPrice` validates the quote or manual amount, then writes status, history, and audit atomically.

## Invariants and indexes

- Money is Decimal and currency is EGP; no Float fields or JS-number persistence.
- `PriceTier.minimumQuantity > 0`; `maximumQuantity` is null or >= minimum.
- No overlapping effective intervals for the same ProductType/unit/tier or Customer/ProductType/rule precedence.
- One PricingStatus per WorkItem.
- At most one current active WorkItemPrice for a current spec version.
- WorkItemPrice, PriceList, PriceTier, and CustomerPricingRule are append-only for commercial values; retire or supersede instead of destructive update/delete.
- Index pending queue by `(status, waitingSince)` and support priority/due-date lookup through 011 WorkItem fields.
- Index price lookup by `(productTypeId, unit, effectiveFrom, effectiveTo)` and customer rules by `(customerId, productTypeId, effectiveFrom, effectiveTo)`.

## Migration and backfill

- Additive schema only: pricing tables, enums, indexes, and the pricing status relation.
- Existing Work Items receive `PENDING` status with `waitingSince` equal to the migration/backfill timestamp unless an existing immutable price source is explicitly supplied by the schema owner.
- No historical price is fabricated from current product data. Existing items remain undeliverable until explicitly priced or marked NOT_REQUIRED by the authoritative delivery contract.
- Apply schema changes only after the shared database owner approves; document `db push`/migration ordering and verification in tasks.
- Retain all audit records and never delete or rewrite existing WorkItem data.
