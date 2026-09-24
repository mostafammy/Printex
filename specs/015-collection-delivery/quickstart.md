# Quickstart: Collection, Discrepancies & Delivery

Manual QA scenarios, run against a seeded dev DB after the schema (data-model.md) and
`prisma/manual-sql/collection-integrity.sql` are applied (tasks.md T002 — confirm with Fady first).
Automated equivalents are listed per scenario; every gate/permission scenario also has a server-path
test (tasks.md).

## Prerequisites

- 001/002/011/012/013/014 merged (014 is on `main` as of `1a76ca9`).
- Users: one `PRINT_RECEPTION_DELIVERY` (has `collection.receive`, `delivery.record`), one
  `ADMIN_OWNER`, one `PRODUCTION_OPERATOR` in the department used below, one `RECEPTION`.
- Seed: `CollectionPolicy "default"` and the default `DiscrepancyCause` rows (`pnpm exec prisma db
  seed`).
- Work Items at `PRODUCTION_COMPLETED`: route an order through 011 → 012 → 013 → 014, or seed
  directly with `tests/helpers/seed.ts` (`seedOrder(…)` then `seedWorkItem({ orderId, state:
  "PRODUCTION_COMPLETED" })`), then set `quantity`/`producedQuantity` on the row (the helper does
  not take them).
- **Pricing/finance**: 051/052 are not built, and no dev flag or stub may be wired into the app to
  "resolve" pricing (constitution II: no feature flag may bypass a gate). Until 051/052 bind their
  ports, manual QA can only show the fail-closed behavior (Scenario 3 step 1, Scenario 8 "finance
  not connected"); the resolved-pricing and settled-balance paths (Scenario 3 steps 2–4, Scenarios
  4 and 8) are verified by the automated integration tests, which bind stubs via
  `__setCollectionPortsForTest()` inside the test process only. Re-run those scenarios manually once
  051/052 land.
- `pnpm dev`, log in, open `/delivery`.

## Scenario 1 — Collection queue (US1) · `tests/integration/collection/queue.test.ts`

1. Seed an urgent Order (one Work Item `PRODUCTION_COMPLETED`, one `IN_PRODUCTION`) and an older
   normal Order (two `PRODUCTION_COMPLETED`).
2. As Print Reception, open `/delivery` → "Waiting to receive". Expect: urgent Order first, each Order
   listed once, waiting items grouped, the in-production item shown as context only.
3. As a `DESIGNER`, open `/delivery` directly. Expect: refused.

## Scenario 2 — Receive and count (US2) · `receive.test.ts`

1. Open a waiting Work Item with expected 100. Enter accepted 90, damaged 6, waste 4, missing 0,
   with lines: DAMAGED 6 (cause "Machine fault"), WASTE 4 ("Material defect"). Save.
2. Expect: Work Item `READY_FOR_COLLECTION`; receipt revision 1 stored; `audit_event` rows
   `collection.receipt_recorded` + 2× `discrepancy.recorded`.
3. On another Work Item, enter counts summing to 99. Expect: `QUANTITY_MISMATCH`, nothing stored,
   state unchanged. Repeat by calling `receiveProduction` directly (integration test) — same result.
4. Enter damaged 6 with a line covering only 4. Expect: `UNCLASSIFIED_QUANTITY`.
5. With the attachment port unbound, the attachment inputs are hidden.

## Scenario 3 — Pricing gate at delivery (US3) · `delivery.test.ts`, `tests/contract/collection/guards.test.ts`

1. Without a pricing stub: open the delivery sheet of a ready Order and try to deliver. Expect:
   refused `PRICING_UNRESOLVED`, banner "Pricing module not connected — contact Admin/Owner".
2. With a stub reporting item A `RESOLVED` and item B `PENDING` (waiting 2h, responsible
   "Accounting"): deliver A+B. Expect: refused, banner lists B, waiting time and "Accounting"; no
   `Delivery` row; both still `READY_FOR_COLLECTION`.
3. Mark the Order urgent (011) and retry. Expect: identical refusal.
4. Set B `RESOLVED`; deliver with receiver name + phone. Expect: both `DELIVERED`, delivered
   quantity = accepted, `delivery.recorded` audited.

## Scenario 4 — Partial delivery rules (US3)

1. Grouped Order with three ready items: deliver two without the partial flag. Expect:
   `PARTIAL_REASON_REQUIRED`. Tick "partial" with a reason → succeeds, third stays ready.
2. Separate Order: deliver one of two ready items. Expect: success, recorded `isPartial: true`, no
   reason asked.

## Scenario 5 — Discrepancy after receipt (US4) · `discrepancy.test.ts`

1. On a ready Work Item (accepted 90) record DAMAGED 5. Expect: receipt revision 2 = accepted 85,
   damaged +5; revision 1 still visible in the history panel.
2. Record DAMAGED 95. Expect: `EXCEEDS_AVAILABLE`.
3. On a delivered Work Item record CUSTOMER_REJECTION 3 → accepted; record DAMAGED → refused.

## Scenario 6 — Resolutions and reprint (US5) · `resolution.test.ts`, `reprint.test.ts`

1. Resolve the 6-unit damaged discrepancy as REPRINT 6. Expect: new Work Item in the same Order,
   quantity 6, "reprint of #…" link both ways, visible in the original department's `/production`
   queue; its job card offers the original's approved file.
2. Resolve another discrepancy as 3 REPRINT + 1 CUSTOMER_ACCEPTS_SHORTAGE; a further 1-unit
   resolution → `RESOLUTION_EXCEEDS_DISCREPANCY`.
3. As Print Reception, try CREDIT 50.00 → refused. As Admin/Owner with a reason → stored; a
   `compensation.monetary_recorded` outbox row exists.

## Scenario 7 — Ready notifications (US6) · `readiness.test.ts`

1. Grouped Order, two items: receive the first → no `customer.ready_for_collection` row; receive the
   second → exactly one row.
2. Separate Order: receive one item → one row for that item.

## Scenario 8 — Financial closure (US7) · `closure.test.ts`

1. With finance stub `remaining > 0, creditApproved: false`: after the last delivery the sheet shows
   "Unpaid balance"; states stay `DELIVERED`.
2. Switch the stub to `remaining = 0` and press "Close order". Expect: all items `COMPLETED`,
   `order.financially_closed` audited.
3. Call `transitionWorkItem(DELIVERED → COMPLETED)` directly on an Order with an open discrepancy.
   Expect: `GUARD_FAILED` / `CLOSURE_CONDITIONS_UNMET`.

## Scenario 9 — Loss history & config (US8) · `reports.test.ts`, `config.test.ts`

1. As Admin/Owner call `listDiscrepancyFacts` for a date range; only in-range rows with
   compensations. As Print Reception → `FORBIDDEN`.
2. `/admin/collection`: change major % to 5, deactivate a cause; the cause disappears from the
   receive form but stays on old discrepancies.

## Automated run

```bash
pnpm check
pnpm test tests/unit/collection tests/contract/collection tests/integration/collection \
  tests/integration/production/reprintJobCard.test.ts
```
