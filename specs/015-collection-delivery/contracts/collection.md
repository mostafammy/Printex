# Contracts: Collection, Discrepancies & Delivery

All functions live in `src/server/collection/**` and are exported only from the barrel
`src/server/collection/index.ts` (module-boundary ESLint rule, mirrors `production`/`review`).
Every public function takes `actor: Actor` (001's `~/server/auth` `Actor`) first. It is built with the
shared `defineCommand` or `defineQuery` from [aspects.md](./aspects.md), bound for this module in
`src/server/collection/aspect.ts`. The aspect validates the input with the Zod schema named below
**before** any I/O. It then checks the static `permission` before any `prepare` step or transaction, runs any
entity-scoped check inside the transaction, and returns a `CollectionResult<T>`:

```ts
type CollectionResult<T> = AspectResult<T, CollectionError>;   // from ~/server/core
// = { ok: true; data: T } | { ok: false; error: AspectBaseError | CollectionError }
```

Mutating commands without a `prepare` step also expose `.inTx(scope: TxScope, actor, input): Promise<T>`.
It throws `AspectDomainError` so that an enclosing transaction rolls back, and it forwards `afterCommit` hooks
to the outer command.

## Queues

### `getCollectionQueue(actor, input: { page?: number; pageSize?: number }): Promise<CollectionResult<Page<CollectionQueueOrder>>>`

- `permission: "collection.receive"`.
- Zod: `page` int ≥ 1 (default 1), `pageSize` int 1..100 (default 25).
- Query shape per research.md §6 (3 queries). Only Orders with ≥ 1 Work Item in
  `PRODUCTION_COMPLETED`; urgent first, then `waitingSince` ascending, then `orderId`.
- `CollectionQueueOrder`: `{ orderId, orderNumber, customerName, mode: "GROUPED" | "SEPARATE",
  priority: "NORMAL" | "URGENT", waitingSince: Date | null, waiting: QueueItem[], others: {
  workItemId, state, productTypeName }[] }`; `QueueItem`: `{ workItemId, productTypeName,
  departmentName, quantity: number | null, producedQuantity: number | null }`.
- `Page<T>`: `{ items: T[]; page; pageSize; total }`.

### `getDeliveryQueue(actor, input: { page?; pageSize? }): Promise<CollectionResult<Page<DeliveryQueueOrder>>>`

- `permission: "delivery.record"`. Same shape, state `READY_FOR_COLLECTION`.
- `DeliveryQueueOrder` adds `readyForCustomer: boolean` (readiness.ts) and `pricingBlocked: number`
  (count of ready Work Items whose `PricingGatePort` status is `PENDING`, one batched port call
  per page).

## Receiving

### `getReceiveSheet(actor, workItemId: string): Promise<CollectionResult<ReceiveSheet>>`

- `permission: "collection.receive"`. `NOT_FOUND` if missing.
- `ReceiveSheet`: `{ workItemId, state, order: { orderId, orderNumber, customerName, mode,
  priority }, spec: { description, productTypeName, material, dimensions }, expectedQuantity,
  expectedFromProduced, producedQuantity, currentReceipt: ReceiptSummary | null, causes: {
  id, name }[] (active only), attachmentsAvailable: boolean, discrepancyTypesAllowed:
  DiscrepancyType[] }`.

### `receiveProduction(actor, input: ReceiveProductionInput, files?: DiscrepancyAttachmentUpload[]): Promise<CollectionResult<{ receiptId: string; discrepancyIds: string[]; becameReadyForCustomer: boolean }>>`

```ts
const discrepancyLineSchema = z.object({
  type: z.enum(["DAMAGED","WASTE","MISSING","SHORT_PRODUCED","INCORRECTLY_PRODUCED"]),
  quantity: z.number().int().positive(),
  causeId: z.string().min(1),
  responsibleUserId: z.string().min(1).optional(),
  responsibleDepartmentId: z.string().min(1).optional(),
  notes: z.string().trim().max(2000).optional(),
});
const receiveProductionInput = z.object({
  workItemId: z.string().min(1),
  accepted: z.number().int().min(0),
  damaged: z.number().int().min(0),
  missing: z.number().int().min(0),
  waste: z.number().int().min(0),
  notes: z.string().trim().max(2000).optional(),
  discrepancies: z.array(discrepancyLineSchema).max(20).default([]),
});
type DiscrepancyAttachmentUpload = { lineIndex: number; kind: "voice" | "image" | "file";
  fileName: string; mimeType?: string; stream: NodeJS.ReadableStream };
```

- `permission: "collection.receive"` is checked first; only then are files staged through
  `DiscrepancyAttachmentPort.stage()` in `prepare`, **before** the transaction
  (`ATTACHMENTS_UNAVAILABLE` if the port is unbound and `files` is non-empty).
- **Staging limits** (these apply to this command and to `recordDiscrepancy`; 050's per-file limits still apply
  on top): at most **10 files** per command, and at most **100 MB aggregate** staged bytes per command.
  - The count is checked before any stage call.
  - Bytes are counted while streaming, and staging stops as soon as the cap is exceeded.
  - Breaching either limit → `VALIDATION` (issue path `files`), and nothing is written.
  - Bytes that were staged but never committed are reclaimed by 050 (contracts/ports.md §3 "Orphans").
  - The limits are an ASSUMPTION pending owner confirmation. Discrepancy evidence is voice notes and photos,
    not print files.
- Transaction: `lockOrder`; load Work Item (+ productType, siblings' states, policy);
  state MUST be `PRODUCTION_COMPLETED`; compute expected;
  `validateReceiptCounts()` (quantities.ts) → `QUANTITY_MISMATCH` / `UNCLASSIFIED_QUANTITY`;
  create `ProductionReceipt` revision 1 (or next revision if a prior receipt exists — only possible
  after an admin-level reset, not in V1); create one `Discrepancy` per line
  (`recordedInState: "PRODUCTION_COMPLETED"`, `receiptId`, `responsibleDepartmentId` defaulting to
  the effective department); commit staged attachments with
  `DiscrepancyAttachmentPort.commit(tx, …)`; `transitionOrThrow(PRODUCTION_COMPLETED →
  READY_FOR_COLLECTION)`; readiness flip → `notifyReadiness`; `isMajor` → `notifyMajorDiscrepancy`.
- Audit (same tx): `collection.receipt_recorded` (after = counts, expected, notes) and one
  `discrepancy.recorded` per line (after = line + attachmentIds, `attachmentIds` also set on the
  audit row).

## Discrepancies and resolutions

### `recordDiscrepancy(actor, input: RecordDiscrepancyInput, files?): Promise<CollectionResult<{ discrepancyId: string; receiptId: string | null }>>`

- Zod: `{ workItemId, type: DiscrepancyType, quantity: int > 0, causeId, responsibleUserId?,
  responsibleDepartmentId?, notes? }`.
- `permission: "collection.receive"`; attachments staged in `prepare` under the same staging limits as
  `receiveProduction`; in the transaction `lockOrder`; rules from data-model.md "Validation
  rules" (types by state, `EXCEEDS_AVAILABLE`, `ORDER_CLOSED`).
- `READY_FOR_COLLECTION`: create receipt revision n+1 (`accepted -= q`, `bucket(type) += q`), then
  the `Discrepancy` with `receiptId` = new revision; `isMajor` check.
- `DELIVERED` (`CUSTOMER_REJECTION` only): `Discrepancy` with `receiptId = null`.
- Audit: `discrepancy.recorded`; plus `collection.receipt_revised` (before/after counts) when a
  revision is created.
- No state transition.

### `resolveDiscrepancy(actor, input: ResolveDiscrepancyInput): Promise<CollectionResult<{ compensationId: string; reprintWorkItemId: string | null; discrepancyResolved: boolean }>>`

```ts
const base = { discrepancyId: z.string().min(1), quantity: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000), notes: z.string().trim().max(2000).optional() };
const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).refine((s) => Number(s) > 0);
const resolveDiscrepancyInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("REPRINT"), ...base }),
  z.object({ kind: z.literal("REPLACEMENT_NEXT_ORDER"), ...base, replacementOrderId: z.string().min(1).optional() }),
  z.object({ kind: z.literal("CREDIT"), ...base, amount: money }),
  z.object({ kind: z.literal("PRICE_ADJUSTMENT"), ...base, amount: money }),
  z.object({ kind: z.literal("CUSTOMER_ACCEPTS_SHORTAGE"), ...base }),
  z.object({ kind: z.literal("OTHER"), ...base }),
]);
```

- Authorization by kind, as a function-form static `permission` evaluated on the parsed input before any I/O:
  `(i) => i.kind === "CREDIT" || i.kind === "PRICE_ADJUSTMENT" ? "admin.override" : "collection.receive"`.
- Transaction: `lockOrder`; `ORDER_CLOSED` if any Work Item of the Order is `COMPLETED`;
  `RESOLUTION_EXCEEDS_DISCREPANCY` if `quantity > discrepancy.quantity − resolved`.
- `REPRINT`: `createReprintInTx` (research.md §9) → new Work Item + `transitionOrThrow(NEW →
  READY_FOR_PRODUCTION)`; `Compensation.reprintWorkItemId` set. Grouped Order readiness may flip
  from ready to not-ready (no notification on that direction).
- `CREDIT | PRICE_ADJUSTMENT`: `notifyMonetaryCompensation` (outbox, contracts/ports.md).
- Audit: `compensation.recorded` (after = kind, quantity, amount as string, reason, notes,
  reprintWorkItemId); for REPRINT also `workitem.reprint_created` on the new Work Item (after =
  copied spec, `reprintOfWorkItemId`, `compensationId`).
- `afterCommit`: `tryFinancialClosure(actor, orderId)` (result ignored except for logging).

## Delivery

### `getDeliverySheet(actor, orderId: string): Promise<CollectionResult<DeliverySheet>>`

- `permission: "delivery.record"`.
- `DeliverySheet`: `{ order: { orderId, orderNumber, mode, priority, customer: { customerId,
  name, isCashCustomer, primaryPhone } }, items: DeliverySheetItem[], readyForCustomer: boolean,
  pricingBlockers: PricingBlocker[], finance: OrderFinanceSummary, closure: { closed: boolean;
  unmet: ClosureCondition[] }, deliveries: DeliverySummary[] }`.
- `DeliverySheetItem`: `{ workItemId, state, productTypeName, acceptedQuantity: number | null,
  openDiscrepancyQuantity: number, reprintOfWorkItemId: string | null, reprintWorkItemIds:
  string[], pricing: PricingStatus }`.
- `PricingBlocker`: `{ workItemId, productTypeName, waitingSince: Date | null, responsible: {
  label: string; userIds: string[] } }`.
- Queries: 1 Order load with `workItems` + latest receipt (`productionReceipts: { orderBy: {
  revision: "desc" }, take: 1 }`) + `reprints: { select: { id } }`; 1 `compensation.groupBy` +
  1 `discrepancy.findMany` (select id, quantity) for open quantities; 1 batched pricing-port call;
  1 finance-port call; 1 `delivery.findMany` for history.

### `recordDelivery(actor, input: RecordDeliveryInput): Promise<CollectionResult<{ deliveryId: string; isPartial: boolean }>>`

```ts
const recordDeliveryInput = z.object({
  orderId: z.string().min(1),
  workItemIds: z.array(z.string().min(1)).min(1).refine((a) => new Set(a).size === a.length),
  receivedByName: z.string().trim().min(1).max(120),
  receivedByPhone: z.string().trim().max(30).optional(),
  handedOverById: z.string().min(1).optional(),
  deliveredAt: z.coerce.date().optional(),
  partialConfirmed: z.boolean().optional(),
  partialReason: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});
```

- `permission: "delivery.record"` (checked before any I/O, research.md §1).
- **Pre-check (`prepare`, after the permission check, before the transaction)**: `PricingGatePort.getPricingStatus(workItemIds)`; any
  `PENDING` → `PRICING_UNRESOLVED { items: PricingBlocker[] }`, nothing written.
- Transaction: `lockOrder`; validate lines (data-model.md rules); compute `isPartial`; grouped +
  partial without `partialConfirmed && partialReason` → `PARTIAL_REASON_REQUIRED`; create
  `Delivery` + one `DeliveryLine` per Work Item (`deliveredQuantity` = current receipt's
  `acceptedQuantity`, `receiptId`); for each Work Item `transitionOrThrow(READY_FOR_COLLECTION →
  DELIVERED, meta: { deliveryId })` — the pricing guard runs here and is authoritative; any failure
  rolls back the whole hand-over and maps to `PRICING_UNRESOLVED`.
- Audit: `delivery.recorded` (after = lines, receiver, handedOverById, deliveredAt, isPartial,
  partialReason).
- `afterCommit`: `tryFinancialClosure(actor, orderId)`. It runs after commit, and its outcome is logged only,
  never returned (aspects.md §3.1 step 9: hooks cannot change the result). The UI reads the closure status
  from `getDeliverySheet`.
- `priority` is never read.

## Financial closure

### `tryFinancialClosure(actor, orderId: string): Promise<CollectionResult<{ closed: boolean; unmet: ClosureCondition[] }>>`

- `permission: ["delivery.record", "collection.receive", "payment.record"]` (any-of).
- Transaction: `lockOrder`; already all non-cancelled `COMPLETED` → `{ closed: true, unmet: [] }`
  (idempotent, returns `{ noChange: true }` — the only command declared with
  `defineCommand({ allowNoChange: true })`, research.md §1; it writes nothing on that path, asserted
  in unit tests); evaluate
  `closureConditions`; if unmet → `{ closed: false, unmet }` (no write, `noChange`); else
  generate `closureRunId = randomUUID()`, add it to the module-private (not exported)
  `activeClosureRuns` set, `transitionOrThrow(DELIVERED → COMPLETED, meta: { closureRunId })` for every
  `DELIVERED` Work Item (closure guard re-checks), and remove the id in `finally` and audit `order.financially_closed` (after = work item ids, finance summary as
  strings).
- `ClosureCondition`: `"NOT_ALL_DELIVERED" | "PRICING_UNRESOLVED" | "OPEN_DISCREPANCIES" |
  "UNPAID_BALANCE" | "FINANCE_UNAVAILABLE"`.

## Configuration

- `getCollectionPolicy(actor)` — `permission: "admin.config"`; returns the row or defaults.
- `updateCollectionPolicy(actor, input: { majorDiscrepancyPercent: string; majorDiscrepancyNotifyRoles: RoleKey[]; readyNoticeRoles: RoleKey[] })`
  — `admin.config`; upsert `id = "default"`; audit `collection_policy.updated` with before/after.
- `listDiscrepancyCauses(actor, { includeInactive?: boolean })` — `collection.receive` or
  `admin.config` (any-of `permission`).
- `createDiscrepancyCause(actor, { name })`, `renameDiscrepancyCause(actor, { causeId, name })`,
  `setDiscrepancyCauseActive(actor, { causeId, isActive })` — `admin.config`; audited
  `discrepancy_cause.created|renamed|activation_changed`. No delete function exists.

## Reports and lineage (read-only)

### `listDiscrepancyFacts(actor, input: { from: Date; to: Date; departmentId?: string; cursor?: string; limit?: number }): Promise<CollectionResult<{ items: DiscrepancyFact[]; nextCursor: string | null }>>`

- `permission: "audit.view"`. `to > from`, range ≤ 366 days, `limit` 1..200 (default 100).
- Keyset on `(recordedAt, id)`; one `findMany` with `include: { cause, workItem: { select:
  productTypeId, material, reprintOfWorkItemId, productType: { select: name } }, receipt: { select:
  expectedQuantity }, compensations: { select: kind, quantity, amount, resolvedAt } }`.
- `DiscrepancyFact`: `{ discrepancyId, recordedAt, type, bucket, quantity, causeId, causeName,
  workItemId, orderId, productTypeId, productTypeName, material, expectedQuantity: number | null,
  responsibleUserId, responsibleDepartmentId, recordedById, isReprintWorkItem, compensations: {
  kind, quantity, amount: string | null, resolvedAt }[] }`.

### `getWorkItemLineage(actor, workItemId): Promise<CollectionResult<{ ancestors: LineageNode[]; descendants: LineageNode[] }>>`

- `permission: ["collection.receive", "delivery.record", "audit.view"]` (any-of).
- `LineageNode`: `{ workItemId, state, quantity, createdAt, compensationId: string | null }`.

### `listCompensationsForOrder(orderId: string): Promise<CompensationSummary[]>` (server-to-server)

- **No actor**: integration read for 051/052 (same stance as 013's `createReturn`: "a future caller
  performs its own permission check"). Not callable from a Server Action by convention; the ESLint
  rule cannot enforce this, so it is listed in the barrel under an `// integration` comment.
- `CompensationSummary`: `{ compensationId, discrepancyId, workItemId, kind, quantity, amount:
  Prisma.Decimal | null, reason, resolvedAt, resolvedById }`.

## Guards (registered by `src/server/collection/guards.ts`)

| Edge | Guard | Failure `error.code` (→ `details.guardCode`) |
|---|---|---|
| `READY_FOR_COLLECTION → DELIVERED` | `deliveryPricingGuard` — `PricingGatePort` status for `ctx.workItem.id` must be `RESOLVED`/`NOT_REQUIRED` | `PRICING_UNRESOLVED` |
| `DELIVERED → COMPLETED` | `closureGuard` — the transition MUST carry `meta.closureRunId` that is currently registered in the module-private `activeClosureRuns` set (populated only by `tryFinancialClosure`) **and** `closureConditions` for `ctx.workItem.orderId` must be empty. Empty conditions alone never authorize the transition | `CLOSURE_CONDITIONS_UNMET` |

Guards are side-effect-free and never read `Order.priority`. They are registered by the idempotent
`registerCollectionGuards()`, exported from the barrel, which is called both at barrel import and from the
shared `src/instrumentation.ts` boot hook (research.md §4).

## Errors

The public error is `AspectBaseError | CollectionError`, discriminated on `code`. The first five rows come from the shared
base ([aspects.md](./aspects.md) §2, §3.2). The rest are `CollectionError`:

| `code` | Details | Raised by |
|---|---|---|
| `VALIDATION` | `issues: { path: string; message: string }[]` | Zod (aspect) |
| `FORBIDDEN` | — | static `permission` or scoped `check` (aspect) |
| `NOT_FOUND` | `entity: "WorkItem" \| "Order" \| "Discrepancy" \| "DiscrepancyCause" \| "User"`, `id` | services (`fail`) |
| `INVALID_STATE` | `workItemIds: string[]`, `expected: WorkItemState[]` | services; aspect maps `INVALID_TRANSITION` without `expectedFrom` |
| `CONFLICT` | `entity`, `id` | aspect: `transitionWorkItem` optimistic-concurrency miss (`details.expectedFrom` present); P2002 on receipt revision / delivery line |
| `QUANTITY_MISMATCH` | `expected`, `sum` | receive |
| `UNCLASSIFIED_QUANTITY` | `bucket`, `counted`, `classified` | receive |
| `EXPECTED_QUANTITY_UNKNOWN` | `workItemId` | receive |
| `DISCREPANCY_TYPE_NOT_ALLOWED` | `type`, `state` | receive / recordDiscrepancy |
| `EXCEEDS_AVAILABLE` | `available`, `requested` | recordDiscrepancy |
| `RESOLUTION_EXCEEDS_DISCREPANCY` | `remaining`, `requested` | resolveDiscrepancy |
| `ORDER_CLOSED` | `orderId` | recordDiscrepancy / resolveDiscrepancy |
| `PARTIAL_REASON_REQUIRED` | `undeliveredWorkItemIds` | recordDelivery |
| `PRICING_UNRESOLVED` | `items: PricingBlocker[]` (empty list when surfaced from the guard alone) | recordDelivery pre-check; guard `PRICING_UNRESOLVED` via `mapGuardFailure` |
| `CLOSURE_NOT_READY` | `unmet: ClosureCondition[]` | guard `CLOSURE_CONDITIONS_UNMET` via `mapGuardFailure`, when reached outside `tryFinancialClosure` |
| `ATTACHMENTS_UNAVAILABLE` | — | attachment port unbound |
| `DUPLICATE_NAME` | `name` | causes |

Unknown errors are re-thrown by the aspect, never converted. An unmapped guard code surfaces as the base
`GUARD_FAILED { guardCode }`.

## Authorization table

| Function | Permission | Notes |
|---|---|---|
| `getCollectionQueue`, `getReceiveSheet`, `receiveProduction`, `recordDiscrepancy` | `collection.receive` | not department-scoped (collection area serves all departments) |
| `resolveDiscrepancy` (REPRINT, REPLACEMENT_NEXT_ORDER, CUSTOMER_ACCEPTS_SHORTAGE, OTHER) | `collection.receive` | |
| `resolveDiscrepancy` (CREDIT, PRICE_ADJUSTMENT) | `admin.override` | reason mandatory (constitution II) |
| `getDeliveryQueue`, `getDeliverySheet` (incl. balance), `recordDelivery` | `delivery.record` | |
| `tryFinancialClosure` | any of `delivery.record`, `collection.receive`, `payment.record` | |
| `getCollectionPolicy`, `updateCollectionPolicy`, cause create/rename/activate | `admin.config` | |
| `listDiscrepancyCauses` | any of `collection.receive`, `admin.config` | |
| `listDiscrepancyFacts` | `audit.view` | until 090 defines its own key |
| `getWorkItemLineage` | any of `collection.receive`, `delivery.record`, `audit.view` | |
| `listCompensationsForOrder` | none (server-to-server integration read) | caller authorizes |
