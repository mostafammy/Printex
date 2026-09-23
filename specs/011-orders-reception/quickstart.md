# Quickstart: Orders & Reception

Validates this feature end-to-end once implemented. Assumes the repo is already set up per the root
`README.md` (Postgres running, `.env`/`.env.test` configured) and `main` includes 001+002.

## Prerequisites

```bash
git checkout 011-orders-reception
pnpm install
pnpm exec prisma db push        # applies data-model.md's schema diff
pnpm exec prisma db seed        # runs seedProductTypes() + existing seed steps
pnpm dev
```

Log in as a seeded `RECEPTION` or `PRINT_RECEPTION_DELIVERY` user (see `prisma/seed.ts` for seeded
credentials).

## Scenario 1 — Quick Create (User Story 1, P1)

1. Navigate to `/reception/quick-create`.
2. Pick an existing customer, type a one-line description ("A2 poster, red background"), pick
   priority `NORMAL`.
3. Submit.
4. **Expected**: redirected to the new order's detail page; one Work Item listed in state `NEW`
   with the typed description and no product type/dimensions/department set yet; order status
   badge shows the "incomplete" indicator (spec.md FR-002).
5. **Verifies**: `quickCreateOrder` (contracts/order-entry.md), `Order.number` assigned via the new
   `autoincrement()` sequence (research.md §1).

## Scenario 2 — Full multi-item order (User Story 2, P1)

1. Navigate to `/reception/new`.
2. Pick a customer, set order-level due date, add two Work Items: for each, pick a product type
   from the seeded catalog (this also pre-fills that item's department/requires-design/requires-
   review from `ProductType`'s current defaults), set quantity + width + height + unit.
3. Leave item 2's own due date blank.
4. Submit.
5. **Expected**: order detail page shows both Work Items; item 2's effective due date displays the
   order-level default (FR-003a); order status badge shows "complete" once every item has product
   type + quantity + dimensions + department (data-model.md `isOrderComplete`).
6. **Verifies**: `createOrder`, the due-date fallback display logic, `isOrderComplete`.

## Scenario 3 — Reception queue (User Story 3, P1)

1. Navigate to `/reception`.
2. **Expected**: both orders from Scenarios 1-2 appear, sorted per spec.md's queue ordering rule,
   each row showing its derived status via `deriveOrderStatus` (002).

## Scenario 4 — Add a Work Item to an in-progress order (User Story 7, P2)

1. Open the Scenario 2 order's detail page. Use `transitionWorkItem` (via any existing 002-exposed
   admin/dev path, or the eventual 012 assignment UI once it ships) to move item 1 to `ASSIGNED` or
   beyond — the order is now "in progress" but not finished.
2. On the order detail page, use "Add Work Item," fill in a third item, submit.
3. **Expected**: succeeds; new item starts at `NEW`, independent of items 1-2's states.
4. **Then**: cancel or complete every Work Item on the order (via 002's transition path) so all
   three reach a terminal state.
5. Attempt "Add Work Item" again.
6. **Expected**: refused with the `ORDER_FINISHED` error (contracts/order-entry.md `addWorkItem`
   step 3b).
7. **Verifies**: FR-011b / `isOrderFinished` (data-model.md).

## Scenario 5 — Order search

1. Navigate to `/reception/search`.
2. Search by the Scenario 1 order's exact number → expect exactly that order.
3. Search by (part of) the customer's name → expect all of that customer's orders.
4. **Verifies**: `searchOrders` (contracts/order-entry.md), research.md §5's OR-query approach.

## Scenario 6 — Cancel

1. On any order with at least one non-terminal Work Item, use "Cancel Work Item" with a reason.
2. **Expected**: that item's state becomes `CANCELLED`; an audit entry exists (visible via 001's
   audit viewer if available) attributing the cancellation to the acting user with the given reason.
3. Attempt to cancel the same item again.
4. **Expected**: refused (`INVALID_TRANSITION` — already terminal), per FR-011.
5. Use "Cancel Order" on an order with multiple open items.
6. **Expected**: every non-terminal item transitions to `CANCELLED`, each with its own audit entry
   (contracts/order-entry.md `cancelOrder` step 3c).

## Scenario 7 — Edit before design starts (User Story 8, P3)

1. On a Work Item still in state `NEW` or `ASSIGNED`, edit its quantity/dimensions.
2. **Expected**: succeeds, audit entry recorded with before/after values.
3. Advance that same item to `IN_DESIGN` (via 002's transition path), then attempt to edit it again.
4. **Expected**: refused with `PAST_EDIT_WINDOW` (contracts/order-entry.md `editWorkItem` step 3b).

## Automated coverage

Each scenario above has a corresponding integration test under `tests/integration/orders/` (see
plan.md's Project Structure) — `pnpm test` runs all of them non-interactively against the test
database; this manual quickstart is for human sanity-checking the UI, not a substitute for the test
suite.
