# Phase 0 Research: Collection, Discrepancies & Delivery

## §1. Cross-cutting concerns as ONE shared command/query aspect layer (`src/server/core/aspects/`)

**Decision**: Every barrel entry point in `src/server/collection/**` is built with `defineCommand` or
`defineQuery`. These come from the **shared** aspect layer defined in
[contracts/aspects.md](./contracts/aspects.md). That file is the canonical definition, and 016 references it.
The layer has three parts:

1. **Generic engine** in `src/server/core/aspects/`, exported from `src/server/core/index.ts`:
   `createAspects(deps)`, `transitionOrThrow`, `AspectDomainError`/`TransitionFailure`/`fail`, and
   `AspectResult<T, E>`. It contains no collection-specific type.
2. **One composition root** `src/server/aspects.ts`. It binds 001's `authorize`/`audit`, `db.$transaction` and
   001's `Actor`/`Permission` once.
3. **A per-module binding** `src/server/collection/aspect.ts`. It is
   `aspects.forModule<CollectionError>({ mapGuardFailure })` and exports this module's `defineCommand` and
   `defineQuery`.

The pipeline is fixed: **validate (Zod) → static `permission` check (no I/O; a single key, an any-of list, or
a pure function of the input) → optional `prepare` (pre-transaction I/O) → `db.$transaction` → optional
entity-scoped `authorize` → `run` → `audit.record` for every entry in the same `tx` → commit →
`afterCommit` hooks → error mapping**.

- `run` must return a non-empty audit tuple. The one exception is `noChange`, which is allowed only with
  `allowNoChange: true`, and 015 uses that only in `tryFinancialClosure`.
- Because `permission` runs before `prepare`, an unauthorised caller always gets `FORBIDDEN`. It can neither
  stage attachment bytes nor probe pricing status.
- `.inTx(scope, actor, raw)` is for composition inside another transaction. It throws `AspectDomainError` so the
  caller's transaction rolls back.
- Error mapping (contracts/aspects.md §3.2) is the only place errors are converted. Unknown errors are
  re-thrown and never swallowed.
- `transitionOrThrow` replaces the `toCoreActor` + `WorkItemTransitionError` pair that is copy-pasted in
  `orders/cancelOrder.ts`, `designers/assignment.ts`, `review/review.ts`, `production/timer.ts` and
  `production/sendBack.ts`. Those files are not refactored here.

**Why the engine is dependency-injected rather than importing auth and db**: two enforced rules in
`eslint.config.js` apply to `src/server/core/**`.

- Rule (a) forbids importing `~/server/<feature>` modules, and `src/server/auth/index.ts` repeats "core must not
  import from auth".
- Rule (c) forbids `throw`, with only `core/storage/**` exempt.

An interactive transaction rolls back only when its callback rejects. So the engine takes `deps` rather than
importing them, and rule (c) gains one exemption, `src/server/core/aspects/**`, justified the same way as the
storage-port exemption. That is tasks.md T004. Rule (a) is left untouched.

**Ownership**: the first feature to implement this layer, 015 or 016, creates `src/server/core/aspects/**`,
`src/server/aspects.ts`, the barrel lines and the rule (c) exemption. The other feature reuses them. Any
change goes through contracts/aspects.md. tasks.md T012–T015 are written as "create if absent, otherwise
reuse".

**Rationale**: The brief requires authorization, audit, transactions and error mapping to be applied
as reusable aspects, and says to "first check how 011–014 already do this". I checked: there is no tRPC and no
wrapper or middleware anywhere under `src/` (grep for `trpc|withAuth|withAudit|withTransaction|
middleware` hits only `env.js` and the shell layout). 011–014 inline `authorize()`,
`db.$transaction`, `audit.record` and a local error class in every function. The Server Actions
in `src/app/(shell)/production/[workItemId]/page.tsx` silently swallow domain errors, which would
make FR-025's "clear reason and who to ask" impossible. 016 independently designed the same skeleton
(016 research §11). A single shared layer gives three guarantees:

- (a) "Every discrepancy and resolution is in the audit log" becomes structural. The non-empty audit tuple is
  enforced at compile time and checked again at runtime.
- (b) Authorization runs inside the transaction that reads the entity, so there is no TOCTOU gap.
- (c) The UI gets typed results.

It also prevents two diverging copies from appearing in parallel features.

**Alternatives considered**:
- Module-local wrappers in 015 and 016. Rejected: two copies of the same cross-cutting code, which is exactly
  the duplication the brief calls out.
- Putting the engine in core with direct imports of auth and db. Rejected: it violates rule (a) and 001's
  documented boundary.
- tRPC middleware. Rejected: a new framework that would need Complexity Tracking, when every module uses
  Server Actions.
- Decorators. Rejected: TS decorators do not apply to free functions.
- Retrofitting 011–014 now. Rejected: out of scope. It is left for a later refactor feature.

## §2. Public functions return `CollectionResult<T>`; `.inTx` variants throw

**Decision**: `type CollectionResult<T> = AspectResult<T, CollectionError>`. That is `{ ok: true; data: T } |
{ ok: false; error: AspectBaseError | CollectionError }`, the same outer shape as core's `ActionResult<T>`.
`AspectBaseError` supplies `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INVALID_STATE` and
`GUARD_FAILED`. `CollectionError` adds the module codes, whose members carry typed details. For example,
`PRICING_UNRESOLVED` carries `items: PricingBlocker[]` and `QUANTITY_MISMATCH` carries `expected`/`sum`. Both are
discriminated on `code` and can be switched exhaustively with core's `assertNever`. The `mapGuardFailure`
option converts guard codes: `PRICING_UNRESOLVED` stays `PRICING_UNRESOLVED`, and
`CLOSURE_CONDITIONS_UNMET` becomes `CLOSURE_NOT_READY`.

**Rationale**: The brief asks for "discriminated unions for results/errors, no `any`". Core's
`ErrorCode` union is frozen (contracts/errors.md, per the comment in `transition.ts`) and cannot
carry `PRICING_UNRESOLVED`, so modules extend the aspect base union instead. Composition inside another
transaction needs throw semantics so that Prisma rolls back. This covers 052 calling closure and a reprint
created inside a resolution. That is why `.inTx` throws `AspectDomainError`, mirroring 013's
`createReturn`/`createReturnInTx` split.

**Alternatives considered**:
- Throwing everywhere, like 011–014. Rejected: the UI cannot tell error details apart without `instanceof` checks
  in every action, which is exactly how 014's page ended up swallowing errors.
- Extending core's `ErrorCode`. Rejected: it is a frozen 002 contract.

## §3. Consumer-owned ports for unbuilt Track B features, with safe defaults

**Decision**: Three ports live in `src/server/collection/ports/` and are bound once at module load
by the provider feature (`bindPricingGatePort`, `bindFinanceSummaryPort`,
`bindDiscrepancyAttachmentPort`, exported from the barrel; a second bind throws
`PORT_ALREADY_BOUND` so a provider cannot be silently replaced). Defaults:

| Port | Provider | Default adapter (until bound) |
|---|---|---|
| `PricingGatePort` | 051 | every Work Item `PENDING`, responsible = "Pricing module not connected — contact Admin/Owner" (**fail closed**) |
| `FinanceSummaryPort` | 052 | `{ status: "UNAVAILABLE" }` → balance area shows "finance not connected"; closure unmet `FINANCE_UNAVAILABLE` |
| `DiscrepancyAttachmentPort` | 050 | `available: false` → UI hides attachment inputs; server refuses attachments with `ATTACHMENTS_UNAVAILABLE` |

Tests bind stubs through `__setCollectionPortsForTest()` (module-internal file, importable only
from `tests/**`, which the ESLint boundary rule exempts).

**Rationale**: The brief: "If something you need does not exist yet (051 pricing, 052 finance, 054
WhatsApp are NOT built), define it as a narrow port interface owned by the consumer, with a
no-op/default adapter." For pricing, "no-op" must mean *fail closed* — a permissive default would be
exactly the "implementation shortcut … feature flag" that constitution II forbids. Dependency
inversion keeps Track A free of imports from Track B modules (module-boundary rule).

**Alternatives considered**: 015 importing `~/server/pricing` directly — rejected: the module does
not exist, and would couple Track A to Track B's internals. Fail-open pricing default — rejected
(constitution II). A 015-owned "pricing status" column as a stop-gap — rejected: a parallel source
of truth (constitution I) that 051 would have to migrate.

## §4. Pricing gate = a delivery guard that delegates to the port; registered at boot

**Decision**: `guards.ts` calls `registerGuard({ from: "READY_FOR_COLLECTION", to: "DELIVERED" },
deliveryPricingGuard)` where `deliveryPricingGuard(ctx)` asks `PricingGatePort` about
`ctx.workItem.id` and returns `{ ok: false, error: { code: "PRICING_UNRESOLVED", message } }` unless
the status is `RESOLVED` or `NOT_REQUIRED`. `transitionWorkItem` surfaces that as `GUARD_FAILED`
with `details.guardCode = "PRICING_UNRESOLVED"`; the module binding's `mapGuardFailure` (contracts/aspects.md §5) converts it to the public
`PRICING_UNRESOLVED`. `recordDelivery` additionally **pre-checks** all selected Work Items through
the port in one batch before opening its transaction, so the error lists every blocked item with
`waitingSince` and `responsible` (the guard alone would stop at the first). The guard is the
authority; the pre-check is UX. The guard never reads `Order.priority`, so urgent cannot bypass it.

Registration goes through an explicit, idempotent `registerCollectionGuards()` in `guards.ts`, exported from
the barrel. A module-level flag means a second call is a no-op, and 002's registry has no `unregister`, so a
double registration would run the guard twice. The function is called in two places:

- **At boot, from `src/instrumentation.ts`**. This is Next.js 15's once-per-server-process `register()` hook,
  Node runtime only. It is the **single shared registration point** for every module's guards: it
  `await import`s each module barrel and calls its `registerXGuards()`, for example
  `registerCollectionGuards()` and 016's `registerChangeGuards()`. The file is shared. The first feature to
  implement creates it, and every later feature adds one line (tasks.md T022). This closes the gap where a code
  path that never imports `~/server/collection` would transition without the guard.
- **From the barrel itself, on import** (`registerCollectionGuards()` at module top level). This covers
  processes that do not run the Next.js hook: vitest, `prisma db seed`, and scripts. It works the same way as
  013's `import "./guards"` in `src/server/review/index.ts`, but the call is explicit.

**Rationale**: The brief says the guard is "owned by 051, registered through the existing guard
registry". 051 does not exist, and 002's registry has no `unregister`, so if 051 registered its own
guard later, a fail-closed placeholder from 015 would block forever. Splitting *mechanism* (015's
guard on the edge) from *policy* (051's port adapter) gives 051 full ownership of the pricing
decision with zero edits to 015 and zero risk of an ungated window. `tests/contract/
externalGuard.test.ts` already demonstrates the registry mechanism from outside core.

**Alternatives considered**: 051 registers the guard directly (literal brief) — rejected for the
reasons above; flagged as a deviation for the owner. Checking pricing only inside `recordDelivery`
— rejected: any other caller of `transitionWorkItem` would bypass it (constitution V: gate in the
centralized transition function).

**Known limitation**: `GuardContext` carries no `tx` (002), so the guard reads committed data via
the port. Pricing is written by 051 in its own transactions, so this is correct for the delivery
gate; it is the reason closure runs post-commit (§5).

## §5. Financial closure: order-level predicate, guarded edge, evaluated post-commit

**Decision**: `closure.ts` has a pure predicate `closureConditions(snapshot) → ClosureCondition[]`
(unmet list; empty = ready) over: `NOT_ALL_DELIVERED`, `PRICING_UNRESOLVED`,
`OPEN_DISCREPANCIES`, `UNPAID_BALANCE`, `FINANCE_UNAVAILABLE`. `tryFinancialClosure(actor, orderId)`
(a `defineCommand`) locks the Order, evaluates, and if ready transitions every `DELIVERED` Work Item
to `COMPLETED` in one transaction with one `order.financially_closed` audit event (plus the
per-transition `WorkItemTransition` rows core writes). A second guard,
`registerGuard({ from: "DELIVERED", to: "COMPLETED" }, closureGuard)`, re-evaluates the same
predicate so no other path can complete early (FR-030). `recordDelivery` and `resolveDiscrepancy`
call `tryFinancialClosure` from their `afterCommit` hook; 052 calls it after its payment commits;
the delivery sheet has a manual "close order" button.

**Rationale**: Finance is order-level (brief: `finance.orderSummary`), so closure must be
order-level. Because guards read committed data only (§4 limitation), evaluating closure inside the
triggering transaction would read stale discrepancy/payment state; post-commit evaluation is
idempotent and safe to repeat. Closure failure after a successful delivery is not an error — the
result reports unmet conditions.

**Alternatives considered**: Closing each Work Item independently — rejected: balance is
order-level. Closing inside the delivery transaction — rejected: stale reads via guard. A scheduled
job — rejected: no scheduler exists; event-driven triggers cover every condition change (delivery,
resolution, payment; pricing changes are covered because 051's resolution of the last price is
followed by a payment or a manual close).

**Known gap flagged (002, not fixed here)**: `deriveOrderStatus` returns `COMPLETED`/`DELIVERED`
only when *every* Work Item is in those states; an Order with one `CANCELLED` item and the rest
`COMPLETED` derives as `PARTIALLY_READY`. Cancelled items should be ignored there. Out of this
feature's write scope; reported to the 002 owner.

## §6. Queue queries: one ordered `$queryRaw` page + one `findMany`, no N+1

**Decision**: `getCollectionQueue` (state `PRODUCTION_COMPLETED`) and `getDeliveryQueue` (state
`READY_FOR_COLLECTION`) share one query shape:

1. `$queryRaw` (tagged template, parameterized): select `Order.id`, `priority`,
   `MIN(PhaseTiming.startedAt)` of the open `QUEUE` segment for that phase, grouped by Order,
   `ORDER BY (priority = 'URGENT') DESC, waitingSince ASC NULLS LAST, id ASC LIMIT $n OFFSET $m`.
   `waitingSince` comes from the open QUEUE segment `transitionWorkItem` step 5 already opens for
   the destination phase — no transition-history scan (014's queue loads *all* transitions per Work
   Item; not repeated here).
2. `count(DISTINCT orderId)` with the same `WHERE` for pagination totals.
3. `db.order.findMany({ where: { id: { in: pageIds } }, include: { customer: { select: { name } },
   workItems: { select: { id, state, quantity, producedQuantity, productType: { select: { name } },
   department: { select: { name } } } } } })`, re-sorted in memory to the page order.

Three queries per page regardless of page size. Indexes: new `WorkItem @@index([state])` (the
existing `@@index([orderId, state])` cannot serve a state-only filter); existing
`PhaseTiming @@index([workItemId, phase, kind])` serves the join.

**Rationale**: Prisma's `orderBy` cannot sort parent rows by an aggregate over a filtered relation
(MIN of a nested relation's column), and sorting all waiting Orders in memory would defeat
pagination. `$queryRaw` with a typed row interface is the minimal escape hatch; details still use
Prisma's type-safe `findMany`.

**Alternatives considered**: Sort by `Order.createdAt` — rejected: an old order whose last item
just finished would jump ahead of items waiting longer. In-memory sort of all rows (014's approach)
— rejected: unbounded; the brief requires pagination and no N+1. Offset vs keyset: offset chosen
for queues (small, human-paged, stable ordering keys); keyset chosen for the 090 fact export (§10).

## §7. Order row lock for order-level invariants

**Decision**: Commands that read sibling Work Items to make an order-level decision
(`receiveProduction`, `recordDiscrepancy`, `resolveDiscrepancy` with Reprint, `recordDelivery`,
`tryFinancialClosure`) first run `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE` in their
transaction (`src/server/collection/lock.ts`).

**Rationale**: Under Postgres READ COMMITTED, two concurrent receipts for the last two Work Items
of a grouped Order would each see the other as still `PRODUCTION_COMPLETED`, and neither would
record the "ready" notification (SC-007 miss); similarly two receipt revisions could race for the
same revision number. Serializing per Order is cheap (one shop, low contention) and removes the
race. Per-Work-Item double submission is additionally caught by `transitionWorkItem`'s optimistic
`updateMany … WHERE state = from` and by unique constraints (`ProductionReceipt @@unique([workItemId,
revision])`, `DeliveryLine.workItemId @unique`).

**Alternatives considered**: SERIALIZABLE isolation with retries — rejected: needs retry plumbing
in every command. Advisory locks — equivalent but less discoverable than a row lock.

## §8. Quantity model: four buckets, typed discrepancies, revisions

**Decision**: A receipt stores `expectedQuantity` (spec `WorkItem.quantity`, else
`producedQuantity` with `expectedFromProduced = true`), `producedQuantity` (snapshot of 014's
field), and `accepted/damaged/missing/waste`. Discrepancy types map to buckets by a pure total
function: `DAMAGED | INCORRECTLY_PRODUCED | CUSTOMER_REJECTION → damaged`, `MISSING |
SHORT_PRODUCED → missing`, `WASTE → waste`. At receipt, for each bucket, the sum of that bucket's
discrepancy-line quantities must equal the bucket count (FR-006). After receipt,
`recordDiscrepancy` on a `READY_FOR_COLLECTION` Work Item creates revision *n+1* with
`accepted -= q` and `bucket(type) += q`. On a `DELIVERED` Work Item only `CUSTOMER_REJECTION` is
allowed, with `q ≤ DeliveryLine.deliveredQuantity`, and no revision is created
(`Discrepancy.receiptId = null`). The invariant `accepted + damaged + missing + waste =
expectedQuantity` and non-negativity are enforced three times: Zod refinement where possible,
service check with a typed error (`QUANTITY_MISMATCH`, `UNCLASSIFIED_QUANTITY`,
`EXCEEDS_AVAILABLE`), and a DB `CHECK` constraint.

**Rationale**: The brief's acceptance criterion is literally "accepted + damaged + missing + waste =
expected; validated server-side". Revisions keep the count history append-only while letting later
findings stay consistent. Mapping types to buckets (rather than storing a bucket) keeps one source of
truth.

**Alternatives considered**: Storing counts only on discrepancies (no receipt row) — rejected: the
PRD §20 list includes accepted quantity, which is not a discrepancy. Updating the receipt row in
place — rejected (constitution III). A separate "customer rejected" bucket — rejected: breaks the
four-bucket invariant the brief fixes; the type preserves the distinction for analytics.

## §9. Reprint = new Work Item in the same Order; approved file via lineage

**Decision**: `createReprintInTx` creates a `WorkItem` (state `NEW`, same `orderId`, copies
`productTypeId`, `description`, `widthValue`, `heightValue`, `dimensionUnit`, `material`,
`finishNotes`; `quantity` = reprint quantity; `departmentId` = source's effective department
`source.departmentId ?? source.productType.defaultDepartmentId` — the same rule as 014's
`effectiveDepartmentId`; `requiresDesign = false`, `requiresReview = false`, `dueDate = null` →
falls back to `Order.dueDate`; `reprintOfWorkItemId = source.id`), creates the `Compensation` with
`reprintWorkItemId`, then `transitionOrThrow(NEW → READY_FOR_PRODUCTION, meta: { reprintOf,
compensationId })` — an edge that already exists — and audits `workitem.reprint_created`. 014's
`getJobCard` gains a lineage fallback: if the Work Item has no approved `DesignVersion` and
`reprintOfWorkItemId` is set, walk up the chain (max depth 10) to the nearest ancestor with one.

**Rationale**: No backward edge from `READY_FOR_COLLECTION`/`DELIVERED` to production exists, and
re-using the original Work Item would overwrite its production history ("both histories are kept").
Keeping the reprint in the same Order keeps "where is my order?" answerable and makes grouped
readiness naturally wait for the reprint. Referencing, not copying, the approved `DesignVersion`
avoids fabricating an approval record and respects constitution IV. It bypasses 011's
`addWorkItem` deliberately: that function requires `order.create`, opens its own transaction, and
refuses once all items are delivered (`isOrderFinished`) — but a post-delivery customer rejection
is exactly when a reprint is needed.

**Alternatives considered**: Copying `DesignVersion` rows onto the reprint (same `storageKey`) —
rejected: duplicates approval metadata (`approvedById` would claim an approval that never
happened on this Work Item). Reprint in a new Order — rejected (traceability).

**Pre-existing gap flagged**: 014's job card links to `/api/design-versions/{id}/download`, which
does not exist in `src/app/api/` yet; when it is built (by 014 or replaced by 050's
`files.getDownloadUrl`), its department check must accept an ancestor's version for a reprint.

## §10. 090 quality facts: raw facts, keyset pagination, no aggregates here

**Decision**: `listDiscrepancyFacts(actor, { from, to, departmentId?, cursor?, limit ≤ 200 })`
returns one row per discrepancy (type, bucket, quantity, cause id/name, recordedAt, recordedBy,
responsible user/department, Work Item id, product type, material, receipt expected quantity,
reprint lineage flag, and its compensations `{ kind, quantity, amount }`) ordered by
`(recordedAt, id)` with a keyset cursor. Indexes: `Discrepancy @@index([recordedAt, id])`,
`@@index([responsibleDepartmentId, recordedAt])`. Permission `audit.view` (Admin/Owner) until 090
defines its own.

**Rationale**: PRD §21/§32 metrics (waste %, damage %, missing %, reprint frequency, loss by
department/material/employee) are all derivable from these facts plus receipts; aggregation belongs
to 090 (out of scope). Keyset pagination is stable under concurrent inserts, which matters for
exports.

**Alternatives considered**: Pre-aggregated tables — rejected (090's job; would need
invalidation). `production.operate`-style reuse (014's workload query) — rejected: loss data is
management data.

## §11. Permissions — reuse 001's seeded keys only

**Decision**: `collection.receive` (queue, receive sheet, receipt, discrepancies, non-monetary
resolutions, lineage), `delivery.record` (delivery queue/sheet incl. read-only balance, hand-over),
`admin.override` (Credit / Price adjustment, reason required), `admin.config` (policy, causes),
`audit.view` (090 facts). `tryFinancialClosure` accepts any of `delivery.record`,
`collection.receive`, `payment.record` (via the aspect's any-of `PermissionSpec` — 001's
`authorize()` takes one key). All seeded in `prisma/seed.ts` today: PRINT_RECEPTION_DELIVERY has
`collection.receive` + `delivery.record`; ADMIN_OWNER has all 22.

**Rationale**: `src/server/auth/permissions.ts` already defines `collection.receive` and
`delivery.record` for exactly this feature; adding keys is a 001 (Track B) change.

**Alternatives considered**: New `discrepancy.resolve` key — deferred (see spec Clarifications).
Gating balance on `finance.view` — rejected (PRINT_RECEPTION_DELIVERY lacks it).

## §12. Notifications — reuse the 002 outbox, recipients from policy

**Decision**: All notices use core's `notify(tx, event)` in the command's transaction:
`customer.ready_for_collection` (recipients `{}` — the customer is not a user; payload carries
`customerId`, `orderId`, `orderNumber`, `mode`, `workItemIds`, `templateKey`) for 054;
`order.ready_for_collection` to `CollectionPolicy.readyNoticeRoles`;
`discrepancy.major` to `CollectionPolicy.majorDiscrepancyNotifyRoles`;
`compensation.monetary_recorded` to roles `["ACCOUNTING"]` merged with policy's major roles.
Readiness flip detection is pure (`readiness.ts`: compare predicate on sibling states before/after
the transition, under the Order lock).

**Rationale**: `contracts/notifications.md` (002) says "Do not build a second outbox table". The
outbox already supports role recipients and JSON payloads; delivery is 053/054's concern
(constitution VII).

**Alternatives considered**: A `CustomerMessagePort` called synchronously — rejected: an outage
would block receipt (constitution VII); the outbox is already the queued/retried channel.

## §13. Migrations and the shared-DB blocker

**Decision**: Ship the schema as a Prisma migration (`prisma migrate dev --create-only`, then append
the `CHECK` constraints to its `migration.sql`) **and** keep `prisma/manual-sql/
collection-integrity.sql` for the `REVOKE` (role-dependent, mirrors 001). Applying it is blocked on
the same shared-dev-DB drift as 011–014's T002 (012–014 used `db push`, so `prisma/migrations/`
stops at `20260923160000_orders_reception`) — confirm with Fady before running.

**Rationale**: Constitution: "Database schema changes MUST ship as Prisma migrations". The drift is
pre-existing and must not be resolved unilaterally.

**Alternatives considered**: `db push` only like 012–014 — rejected (constitution), but noted as the
fallback the team has used if Fady decides so.
