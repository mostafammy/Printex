# Research: Pricing Engine

**Feature**: 051-pricing
**Date**: 2026-09-24

## Decision 1: Keep ProductType ownership in 011

**Decision**: 011 remains the owner of `ProductType`; 051 stores pricing configuration keyed by ProductType ID.

**Rationale**: 011 already owns product identity and the WorkItem fields consumed by pricing. Duplicating the catalog would create conflicting product names, deactivation rules, and historical references.

**Rejected**: Moving ProductType to 051. This would expand pricing beyond its business responsibility and break 011's existing consumer contract.

## Decision 2: Use historical price rows, not mutable current values

**Decision**: Price-list entries and customer rules are append-only commercial history with effective intervals. A correction creates a new row or closes an interval; it does not rewrite a price already used by a quote.

**Rationale**: Past quotes and WorkItemPrice records must remain explainable after rates change.

**Rejected**: One mutable price per ProductType. It cannot reproduce historical customer charges.

## Decision 3: Tax-inclusive V1 amounts

**Decision**: Configured and quoted amounts are tax-inclusive in V1. Tax settlement, payments, balances, and receipts remain with 052 or a later finance decision.

**Rationale**: This gives pricing one deterministic customer-facing amount while keeping financial posting out of PRI-15.

**Rejected**: Adding a tax calculation layer to 051. It would introduce an unowned finance policy and duplicate 052 responsibilities.

## Decision 4: Decimal arithmetic and whole-EGP final rounding

**Decision**: Convert dimensions to metres, retain Decimal precision through area, tier, and rule calculations, then round only the final amount to the nearest whole EGP.

**Rationale**: It avoids float drift and premature area/rate rounding while matching the confirmed shop pricing convention.

**Rejected**: JavaScript number arithmetic or rounding each intermediate unit value.

## Decision 5: Customer-by-product rules only

**Decision**: V1 supports customer × ProductType fixed prices and percentage discounts with effective dates. Order-level discounts are excluded.

**Rationale**: This directly satisfies PRD §25 while avoiding a second discount authority that would affect 052 and invoice totals.

**Rejected**: Order-level discounts in 051. They require finance ownership, permissions, and a new breakdown contract.

## Decision 6: 015 owns the delivery guard

**Decision**: 051 implements and binds 015's `PricingGatePort`; 015 remains the owner of the `READY_FOR_COLLECTION -> DELIVERED` guard and maps unresolved pricing to `PRICING_UNRESOLVED`.

**Rationale**: The delivery transition belongs to collection/delivery. A port keeps 002/015 independent from pricing schema and prevents duplicate guard behavior.

**Rejected**: Registering a second guard from 051 on the delivery edge. It would duplicate ownership and make registration order observable.

## Decision 7: 016 resets pricing through a transaction listener

**Decision**: 051 registers `pricing.reset` with 016's `SPEC_CHANGED` listener registry. It uses the supplied transaction, sets affected items to PENDING, records its audit event, and performs no nested transaction or external I/O.

**Rationale**: A specification change invalidates the previous explanation even when the numeric amount happens to remain equal.

**Rejected**: Polling for changes or resetting from UI actions. Both can miss server-side changes and break atomicity.

## Decision 8: Reprints require current pricing

**Decision**: An exact reprint is not automatically deliverable unless it has a current WorkItemPrice. It follows the same fixed or variable pricing path as any other Work Item.

**Rationale**: A historical price may be stale, and the issue explicitly requires nothing deliverable to remain unpriced.

**Rejected**: Treating all reprints as NOT_REQUIRED. That would bypass the delivery control.

## Decision 9: Configurable pending-age policy

**Decision**: Store `waitingSince` at each transition into unresolved pricing and expose it to 053. Keep the alert threshold configurable outside the pricing calculation.

**Rationale**: Different shop periods may need different delay policies; the timestamp is the stable cross-feature contract.

**Rejected**: Hard-coding 24 hours in 051.

## Open owner data

- Initial ProductType/unit/rate matrix for banners, cards, notebooks, digital, and other top products.
- Whether future finance policy changes the tax-inclusive convention.
- The initial operational threshold and recipient policy for 053 delay alerts.
- Final agreement that 015's delivery guard and 016's listener contracts are available before implementation begins.
