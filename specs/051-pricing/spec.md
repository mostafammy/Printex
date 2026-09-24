# Feature Specification: Pricing Engine

**Feature Branch**: `051-pricing`

**Created**: 2026-09-24

**Status**: Draft

**Input**: Linear PRI-15 / GitHub #11: define how a Work Item is priced, who may set or override a price, and why no required Work Item can be delivered before pricing is resolved. PRD §§24-28, §55 Rules 9-10; constitution II, III, V, VI, VII, IX.

**PRD References**: `Printex Print Shop Management System — Product Requirements Document V1.md`; `Printex.md`; `DEMO ANALYSIS.md`.

## Clarifications

### Session 2026-09-24

The following decisions were supplied for this specification:

- `ProductType` remains owned by 011. 051 attaches price lists and customer-specific rules to the existing ProductType records; it does not create a duplicate catalog.
- V1 prices are tax-inclusive. Tax settlement, payments, balances, and receipts remain outside this feature and belong to 052 or a later finance decision.
- Intermediate calculations retain Decimal precision. The final quoted amount is rounded to the nearest whole EGP.
- V1 supports customer-by-product special pricing only. Order-level discounts are out of scope.
- Pricing delay thresholds are configurable and exposed to 053; 051 does not hard-code a single alert duration.
- Exact reprints require a current price. They do not silently inherit an old price.

The following remain owner-data inputs, not invented defaults: real price lists and top-product units, whether any future tax policy changes, and the configured pricing-delay threshold used by 053.

## User Scenarios & Testing

### User Story 1 - Staff can explain a standard price (Priority: P1) 🎯 MVP

A receptionist or pricing user selects a ProductType, enters the Work Item quantity and dimensions, and receives a server-computed quote in EGP. The result identifies the unit, normalized quantity, area when relevant, quantity tier, price-list entry, customer rule, tax-inclusive total, and rounding. The UI displays the explanation but cannot calculate or alter the authoritative amount.

**Why this priority**: A deterministic fixed-price path prevents unpriced standard jobs and gives reception a fast, auditable answer.

**Independent Test**: Quote a banner for a customer without a special rule and for customer ABC with an active 90 EGP/m rule while the general list is 100 EGP/m. Confirm the totals and breakdown identify the selected rule. Repeat with an expired rule and confirm the general list is used.

**Acceptance Scenarios**:

1. **Given** an active price-list entry for a ProductType and unit, **when** a valid fixed-price Work Item is quoted, **then** the result contains an amount, unit, quantity, relevant dimensions/area, tier, list entry, and tax-inclusive Decimal total.
2. **Given** a customer-specific fixed-price rule active on the quote date, **when** the customer and ProductType match, **then** the rule is automatically selected and the breakdown names it.
3. **Given** an expired or not-yet-effective customer rule, **when** the same Work Item is quoted, **then** that rule is ignored and the active general price-list entry is used.
4. **Given** quantity-tier boundaries 1-9, 10-49, and 50+, **when** quantities 9, 10, and 50 are quoted, **then** each quantity uses the correct tier.

### User Story 2 - Pricing users can set variable prices safely (Priority: P1)

A user with the appropriate permission sets a manual price for a VARIABLE Work Item. Reception can apply configured FIXED prices, but cannot set a variable price. A computed price can be overridden only by a user with `pricing.override`, and every manual or override action requires a reason.

**Why this priority**: Bespoke work is the main source of delayed and leaked revenue; authorization and reasons prevent untraceable negotiation.

**Independent Test**: Attempt each operation as Reception, a user with `pricing.set_variable`, and a user with `pricing.override`. Confirm allowed actions create a price history record and forbidden actions create neither a price nor an audit event.

**Acceptance Scenarios**:

1. **Given** a FIXED Work Item and Reception, **when** Reception applies its computed quote, **then** the Work Item becomes PRICED with source LIST or CUSTOMER_RULE.
2. **Given** a VARIABLE Work Item and Reception, **when** Reception calls `setPrice`, **then** the operation fails with `FORBIDDEN`.
3. **Given** a VARIABLE Work Item and a user with `pricing.set_variable`, **when** the user supplies a positive Decimal amount and reason, **then** the Work Item becomes PRICED with source MANUAL.
4. **Given** a computed price and a user without `pricing.override`, **when** the user attempts an override, **then** it fails with `FORBIDDEN`.
5. **Given** an override without a reason, **when** any user attempts it, **then** validation fails and no price or audit event is written.

### User Story 3 - Every price decision remains visible (Priority: P1)

Staff can see the current price, all previous price decisions, who set each decision, when it was set, its source, its reason when required, and the calculation breakdown that explains a computed amount. Pricing status is independent from production workflow state.

**Why this priority**: Immutable history protects customers and Printex when prices are disputed or specifications change.

**Independent Test**: Apply a list price, then a customer-rule price, then an authorized override. Confirm all three records remain readable in order and the current record is identifiable without modifying earlier records.

**Acceptance Scenarios**:

1. **Given** a Work Item with a current price, **when** a new price is set, **then** a new append-only history record is created and prior records remain unchanged.
2. **Given** a manual or override price, **when** staff open the pricing panel, **then** the required reason, actor, timestamp, source, and amount are visible.
3. **Given** a Work Item in production with `PENDING` pricing, **when** staff view it, **then** the pricing status is visible independently from the production state.
4. **Given** a specification change accepted through 016, **when** the `SPEC_CHANGED` listener runs, **then** the current pricing status becomes PENDING, `waitingSince` is set, and the reset is audited in the same transaction.

### User Story 4 - Delivery cannot bypass unresolved pricing (Priority: P1)

The delivery workflow asks the pricing provider for every required Work Item. A transition to DELIVERED fails with `PRICING_UNRESOLVED` if any required Work Item is PENDING or otherwise lacks a valid current price. Production and other workflow transitions remain available while pricing is pending. Urgent work does not bypass the rule.

**Why this priority**: This is the primary control against the documented failure mode of printed work leaving the shop without a price.

**Independent Test**: Start production for an order with a PENDING Work Item, confirm production can start, then attempt delivery and receive `PRICING_UNRESOLVED`. Price the item and confirm delivery can proceed.

**Acceptance Scenarios**:

1. **Given** an order with one required PENDING Work Item, **when** delivery attempts `→ DELIVERED`, **then** the transition fails with `PRICING_UNRESOLVED` and no delivery state is written.
2. **Given** an order with every required Work Item PRICED, **when** delivery attempts `→ DELIVERED`, **then** the existing 015 delivery transition may proceed.
3. **Given** a PENDING Work Item, **when** production starts or continues, **then** the workflow action is allowed.
4. **Given** an urgent PENDING Work Item, **when** delivery is attempted, **then** it fails exactly like a normal-priority Work Item.
5. **Given** a reprint Work Item, **when** delivery is attempted without a current price, **then** it remains unresolved until explicitly priced.

### User Story 5 - Pricing staff can work an age-ordered queue (Priority: P1)

Users authorized to price open a pricing queue containing all PENDING Work Items. The queue orders oldest waiting items first, then urgent work according to the agreed queue policy, and displays a human-readable age such as “Waiting since 2h 14m”. The queue links to the Work Item pricing panel.

**Why this priority**: Pending work must be actionable, not merely visible, while 053 needs a stable pending timestamp for delay alerts.

**Independent Test**: Create pending items with different `waitingSince` timestamps and priorities. Confirm the queue includes all pending items, excludes PRICED items, orders according to the documented policy, and renders age from the server timestamp.

**Acceptance Scenarios**:

1. **Given** multiple PENDING Work Items, **when** a pricing user opens the queue, **then** every pending item appears with customer, ProductType, quantity, priority, responsible pricing role, and waiting age.
2. **Given** pending items with different waiting timestamps and urgency, **when** the queue is loaded, **then** ordering follows the documented deterministic oldest/urgent-first policy.
3. **Given** a user without pricing permissions, **when** the user requests the queue, **then** the server refuses access.
4. **Given** a pending item is priced, **when** the queue refreshes, **then** it no longer appears.

### User Story 6 - Staff can record pricing-originated returns (Priority: P2)

When a job is sent back because its price is wrong or disputed, staff record a Return through 013's shared Return model with origin Pricing, category `PRICING_ISSUE`, explanation, actor, assignee, and timestamp. The return does not masquerade as a design failure.

**Independent Test**: Create a pricing issue return and confirm its category and Pricing origin are queryable through the shared Return model, with no design-version field required.

**Acceptance Scenarios**:

1. **Given** a pricing dispute, **when** an authorized user records a return, **then** the Return has origin Pricing, category `PRICING_ISSUE`, a required explanation, actor, assignee, and timestamp.
2. **Given** a pricing-originated return, **when** staff inspect it, **then** it is distinguishable from design or production returns and does not require a DesignVersion.

### User Story 7 - Admins manage price configuration (Priority: P2)

An authorized administrator maintains price-list entries and customer special-pricing rules. The UI provides the price-list admin surface and the customer-profile special-pricing tab reserved by 010. Historical entries remain available and are never silently overwritten.

**Independent Test**: Create, revise, expire, and deactivate a price-list entry and a customer rule. Confirm historical prices remain readable and future quotes select only effective entries.

**Acceptance Scenarios**:

1. **Given** an authorized administrator, **when** they create a price-list entry with unit, base price, tier, and effective dates, **then** it is available for future quotes and audited.
2. **Given** an active price-list entry, **when** its commercial value needs to change, **then** a new historical entry is created instead of mutating the old value.
3. **Given** an authorized administrator, **when** they add a customer fixed-price or percentage-discount rule, **then** future matching quotes apply it automatically only during its effective period.
4. **Given** a customer profile, **when** staff open its special-pricing tab, **then** active and historical rules are shown without exposing unrelated customer data.

## Edge Cases

- Dimensions supplied in centimetres and metres normalize to metres before area calculation; invalid, zero, negative, or incomplete dimensions fail validation for area-based units.
- Area is width × height per piece, multiplied by quantity. Intermediate values retain Decimal precision; the final amount rounds to the nearest 1 EGP.
- A product/unit without an effective price-list entry cannot be quoted as FIXED and remains PENDING until a permitted manual price is set.
- Overlapping effective dates or overlapping quantity tiers for the same ProductType/unit are rejected unless an administrator explicitly closes the previous interval before creating the next.
- A percentage discount cannot produce a negative amount; fixed customer prices must be positive.
- If multiple customer rules match, the most specific active rule is selected deterministically; equal-precedence matches are a configuration error, not a random choice.
- A specification change resets a PRICED item to PENDING even if its amount would mathematically remain unchanged.
- A disputed price is not deliverable; `DISPUTED` is unresolved for the delivery gate until a new valid price is set.
- Urgency changes queue ordering only; it never changes authorization or the delivery guard.
- Price changes do not create payments, balances, receipts, inventory deductions, or customer WhatsApp messages.
- No price is written with a JavaScript floating-point amount; API boundaries accept validated decimal strings/numbers and persist Decimal values.

## Functional Requirements

- **FR-001**: The system MUST represent pricing units `PIECE`, `SQUARE_METER`, `LINEAR_METER`, `SHEET`, and `PACK`.
- **FR-002**: The system MUST normalize supported dimensions from cm or m and calculate area-based charges as width × height × quantity using server-side Decimal arithmetic.
- **FR-003**: The system MUST round only the final tax-inclusive amount to the nearest whole EGP; intermediate calculations MUST retain precision.
- **FR-004**: The system MUST retain historical price-list entries with ProductType, unit, base price, quantity tier, effective-from date, and effective-to date.
- **FR-005**: The system MUST reject invalid or overlapping price-list tiers/effective intervals for the same ProductType and unit.
- **FR-006**: The system MUST support customer × ProductType rules for fixed prices and percentage discounts with effective dates.
- **FR-007**: The system MUST apply the active customer rule automatically when quoting and identify the applied rule in the breakdown.
- **FR-008**: The system MUST support ProductType pricing modes `FIXED` and `VARIABLE` without duplicating 011's ProductType catalog.
- **FR-009**: The system MUST provide `pricing.quote(workItem, customer, date)` with amount and breakdown fields for unit, quantity, dimensions/area, tier, list entry, customer rule, tax-inclusive total, and rounding.
- **FR-010**: The system MUST persist every accepted price as an append-only `WorkItemPrice` history record with Decimal EGP amount, source, setBy, setAt, and required reason for MANUAL or override prices.
- **FR-011**: The system MUST expose pricing status `PENDING`, `PRICED`, or `DISPUTED` separately from WorkItem workflow state and retain `waitingSince` for unresolved status.
- **FR-012**: The system MUST allow Reception to apply FIXED computed prices, require `pricing.set_variable` for VARIABLE prices, and require `pricing.override` plus a reason to override a computed price.
- **FR-013**: The system MUST authorize every pricing mutation server-side and write an audit event in the same transaction.
- **FR-014**: The system MUST expose `pricing.status(workItemId)` and `pricing.pendingSince(workItemId)` for internal consumers, including 053.
- **FR-015**: The system MUST provide an authorized pricing queue containing all PENDING items with deterministic age/priority ordering and waiting-age display.
- **FR-016**: The system MUST bind 015's `PricingGatePort`; required Work Items that are not PRICED MUST cause delivery to fail with `PRICING_UNRESOLVED`.
- **FR-017**: The system MUST not block production solely because pricing is PENDING and MUST apply the same delivery gate to urgent jobs.
- **FR-018**: The system MUST record pricing-issue returns through 013's Return model with origin Pricing and category `PRICING_ISSUE`.
- **FR-019**: The system MUST expose a price-list administration surface and the customer special-pricing tab reserved by 010.
- **FR-020**: The system MUST register 016's `SPEC_CHANGED` listener and reset affected pricing to PENDING transactionally, with audit and no nested transaction or external I/O.
- **FR-021**: The system MUST keep all calculations server-side; client UI values are display-only.
- **FR-022**: The system MUST exclude AI estimates, payments/balances/receipts, inventory-cost automation, price messaging through WhatsApp, and production blocking from this feature.

## Key Entities

- **PriceListEntry**: ProductType-linked unit price configuration with historical effective dates and quantity tiers.
- **QuantityTier**: Inclusive minimum/maximum quantity range and Decimal base price within a PriceListEntry.
- **CustomerPricingRule**: Customer × ProductType fixed price or percentage discount with effective dates.
- **WorkItemPrice**: Append-only price decision and calculation snapshot for one Work Item.
- **PricingStatus**: Current independent status, pending timestamp, and optional dispute metadata for one Work Item.
- **QuoteBreakdown**: Server-produced explanation of the inputs and rule selections used for a quote.

`ProductType`, `Customer`, `WorkItem`, workflow state, authorization, audit, delivery transitions, and Return remain owned by 011, 010, 011/002, 001, 001, 015, and 013 respectively.

## Out of Scope

- AI price estimates.
- Payments, balances, receipts, tax settlement, and financial closure.
- Inventory or material-cost automation.
- Sending prices to customers through WhatsApp.
- Blocking production because pricing is pending.
- Order-level discounts.
- Duplicate ProductType or Customer catalog models.

## Success Criteria

- **SC-001**: Active customer ABC receives 90 EGP/m while an unmatched customer receives 100 EGP/m, and an expired ABC rule is ignored.
- **SC-002**: Quantities 9, 10, and 50 select the correct configured quantity tiers.
- **SC-003**: Reception's attempt to set a VARIABLE price fails as `FORBIDDEN`; an authorized pricing user succeeds with a required reason.
- **SC-004**: Delivery of an order with one PENDING or DISPUTED required Work Item fails as `PRICING_UNRESOLVED` without changing workflow state.
- **SC-005**: Production can start and continue while pricing is PENDING.
- **SC-006**: Every accepted price change creates a readable history record and audit event with actor, timestamp, source, amount, and required reason.
- **SC-007**: A pricing user can identify the oldest pending item and its waiting age from the pricing queue without opening each item.
- **SC-008**: A specification change resets pricing to PENDING in the same transaction and leaves the reset audit event visible.
- **SC-009**: A pricing-originated return is distinguishable from design and production returns through the shared Return model.
- **SC-010**: All monetary outputs are Decimal-backed and final quoted amounts are whole-EGP values; no floating-point amount is persisted.

## Assumptions

- 011's ProductType records include the product identity required for pricing attachment and remain stable historical references when deactivated.
- Required Work Items for delivery are determined by 015's collection/delivery contract; 051 does not redefine order closure semantics.
- A current price is required for every deliverable Work Item, including exact reprints.
- Pricing users and permissions are configured through 001; 051 does not infer authority from UI roles alone.
- Actual commercial rates and the initial product/unit matrix will be supplied before implementation and seeded separately.
- The configured delay threshold and notification behavior are consumed by 053 and are not hard-coded into the pricing queue.

## Dependencies

- **Consumes**: 011 ProductType and WorkItem fields; 010 Customer; 001 `authorize` and `audit`; 002 workflow transitions; 013 Return; 015 `PricingGatePort`; 016 `SPEC_CHANGED` listener.
- **Provides**: `pricing.quote()`, `pricing.setPrice()`, `pricing.status(workItemId)`, `pricing.pendingSince(workItemId)`, the bound pricing gate provider, `<PricingPanel workItemId>`, and pricing queue/admin contracts.
- **Cross-contract**: 016 must notify 051 after accepted specification changes so prices reset to PENDING.

## Notes for Planning

- The 015 delivery guard owns `READY_FOR_COLLECTION -> DELIVERED`; 051 MUST bind the existing gate port and MUST NOT register a competing guard.
- Pricing module imports should expose a barrel-only public surface consistent with neighboring server modules.
- Current source permissions include `pricing.use_fixed`, `pricing.set_variable`, and `pricing.override`; any vocabulary change must be coordinated through 001.
- Shared database migration and 015/016 implementation availability are implementation blockers to record in `tasks.md`, not reasons to weaken this specification.
