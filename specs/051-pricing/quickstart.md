# Quickstart: 051 Pricing

This guide validates the pricing contracts without prescribing implementation bodies.

## Prerequisites

- 001 authorization/audit is available.
- 011 ProductType, Customer, Order, and WorkItem records exist.
- 015 delivery contracts and 016 change-control listener contracts are available or represented by test doubles.
- Test database is approved for additive schema changes.

## Scenario 1: Fixed price, customer rule, and expiry

1. Configure Banner / `SQUARE_METER` at 100 EGP with an active open-ended tier.
2. Configure Customer ABC / Banner at fixed 90 EGP/m for a bounded period.
3. Quote ABC during the period: expect 90 EGP/m and a breakdown naming the customer rule.
4. Quote another customer: expect 100 EGP/m and the list entry.
5. Quote ABC after expiry: expect 100 EGP/m and the expired rule absent.

## Scenario 2: Quantity tiers

Configure tiers 1-9, 10-49, and 50+. Quote quantities 9, 10, 49, and 50. Confirm each result uses the inclusive expected tier and no adjacent tier.

## Scenario 3: Units and rounding

Quote a 2.5 m × 1.2 m banner quantity 3 using `SQUARE_METER`. Confirm total area is 9.00 m² before pricing. Quote a linear-meter item with dimensions in centimetres and confirm conversion. Confirm intermediate Decimal values are retained and the final amount is rounded to a whole EGP.

## Scenario 4: Authorization and history

- Reception applies a FIXED quote: expect PRICED with source LIST or CUSTOMER_RULE.
- Reception sets a VARIABLE price: expect FORBIDDEN.
- A user with `pricing.set_variable` sets a positive Decimal with a reason: expect PRICED/MANUAL.
- A user without `pricing.override` attempts an override: expect FORBIDDEN.
- An override without a reason: expect validation failure.
- Read history: every accepted price remains present with actor, timestamp, source, amount, and reason where required.

## Scenario 5: Delivery and production

1. Create an order with one PENDING required Work Item.
2. Start production: expect success.
3. Attempt delivery: expect `PRICING_UNRESOLVED` and no state change.
4. Price the item, refresh the pricing port, and retry delivery: expect the existing 015 transition to proceed.
5. Repeat with urgent priority: expect the same delivery failure while pending.

## Scenario 6: Queue and delay timestamp

Create PENDING items with distinct `waitingSince` values and priorities. As a pricing user, load the queue and confirm all pending items appear, age is rendered from the server timestamp, and ordering follows the documented oldest/urgent-first policy. A non-pricing user is refused.

## Scenario 7: Specification change reset

1. Price a Work Item under its current specification.
2. Accept a 016 specification change in a transaction.
3. Confirm 051's listener changes status to PENDING, sets/retains `waitingSince`, clears the current-price association, and writes an audit event in that transaction.
4. Force a listener failure and confirm the specification change and pricing reset roll back together.

## Scenario 8: Pricing return

Create a Return through 013's transaction helper with origin Pricing and category `PRICING_ISSUE`. Confirm the explanation, actor, assignee, timestamp, and shared Return query are present, and no DesignVersion is required.
