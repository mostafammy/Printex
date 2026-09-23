# Contract: Order Entry

Owner: 011 (this feature). Consumers: 012 (designer assignment reads Work Items this creates), 051
(pricing reads `ProductType`/dimensions), 052 (payments reads Order), 053 (notifications reads
Order/WorkItem for delay detection), 054 (WhatsApp reads Order for status replies), 090 (dashboard
reads everything for reporting).

All functions below live in `src/server/orders/**` and are re-exported from the barrel
`src/server/orders/index.ts` — the only legal import path for code outside this module
(data-model.md "Module boundary").

Every function takes `actor: Actor` (from `~/server/auth`'s `getActor()`) as its first argument and
calls `authorize(actor, permission)` as its first statement — see the Authorization table at the
bottom of this file for which `Permission` each function checks.

## `quickCreateOrder`

```ts
function quickCreateOrder(
  actor: Actor,
  input: {
    customerId: string;
    description: string;      // 1-500 chars, trimmed, required non-empty
    priority: OrderPriority;
    channel?: OrderChannel;   // defaults to "WALK_IN" when omitted (spec.md FR-001/FR-001a)
  },
): Promise<{ orderId: string; orderNumber: number; workItemId: string }>;
```

1. Zod-validate `input` (`description` non-empty after trim, `customerId` non-empty string,
   `priority` must be a valid enum member; `channel` defaults to `"WALK_IN"` via
   `.default("WALK_IN")` in the Zod schema when omitted, so the UI only needs to send it when the
   reception user picks something other than the default — this keeps Quick Create at 3 required
   inputs per FR-001a).
2. `db.$transaction(async (tx) => { ... })`:
   a. `tx.order.create({ data: { customerId, channel, priority, mode: "SEPARATE", createdById: actor.userId } })`
      — `mode` defaults to `"SEPARATE"` for a single-item Quick Create (grouping is meaningless
      with one item; reception can change it later via the full form if they add more items).
      `number` is omitted — Postgres assigns it (data-model.md's `@default(autoincrement())`).
   b. `tx.workItem.create({ data: { orderId: order.id, description, state: "NEW", requiresDesign: true, requiresReview: true } })`
      — `requiresDesign`/`requiresReview` default `true` (the safe default; nothing else about the
      job is known yet at Quick Create time).
   c. `audit.record(tx, { action: "order.created", entityType: "Order", entityId: order.id, actorId: actor.userId, after: { customerId, channel, priority, source: "quick_create" } })`
   d. `audit.record(tx, { action: "workitem.created", entityType: "WorkItem", entityId: workItem.id, actorId: actor.userId, after: { description, orderId: order.id } })`
3. Return `{ orderId, orderNumber: order.number, workItemId }`.

**No call to `transitionWorkItem`** for this initial `NEW` state — `transitionWorkItem` moves a
Work Item *from* an existing state *to* a new one (data-model.md's allowed-edges table has no `from:
null` row); setting the initial value on `create` is not a transition and is the one sanctioned
exception to "only `transitionWorkItem` writes `state`" (plan.md's Technical Context note).

## `createOrder`

```ts
function createOrder(
  actor: Actor,
  input: {
    customerId: string;
    channel: OrderChannel;
    priority: OrderPriority;
    mode: OrderMode;
    dueDate?: Date;
    workItems: ReadonlyArray<WorkItemCreateInput>;   // see shape below; min 1 item, Zod .min(1)
  },
): Promise<{ orderId: string; orderNumber: number; workItemIds: string[] }>;

interface WorkItemCreateInput {
  productTypeId?: string;
  quantity: number;             // positive integer, Zod .int().positive()
  widthValue: number;           // positive, Zod .positive()
  heightValue: number;
  dimensionUnit: WorkItemDimensionUnit;
  material?: string;
  finishNotes?: string;
  requiresDesign: boolean;
  requiresReview: boolean;
  departmentId?: string;
  dueDate?: Date;
  description?: string;
}
```

1. Zod-validate `input` (`workItems` non-empty array; each item's own schema as annotated above).
2. `db.$transaction(async (tx) => { ... })`:
   a. Create the `Order` row (same shape as Quick Create step 2a, plus `mode`/`dueDate` from
      input).
   b. For each item in `input.workItems`, in array order: `tx.workItem.create({ data: { orderId, state: "NEW", ...item } })`.
   c. One `audit.record(tx, { action: "order.created", ... })` for the order.
   d. One `audit.record(tx, { action: "workitem.created", entityId: workItem.id, after: {...item, orderId} })`
      per Work Item — each gets its own audit row (matches constitution III's per-entity audit
      requirement; do not batch these into one event).
3. Return `{ orderId, orderNumber, workItemIds }`.

## `addWorkItem`

```ts
function addWorkItem(
  actor: Actor,
  orderId: string,
  input: WorkItemCreateInput,      // same shape as createOrder's per-item input
): Promise<{ workItemId: string }>;
```

1. `authorize(actor, "order.create")` — appending a new Work Item is a creation action, not an edit
   of existing data (matches FR-011b's framing; `order.edit` is reserved for changing an *existing*
   item's own fields, per `editWorkItem` below).
2. Zod-validate `input`.
3. `tx = db.$transaction`:
   a. Fetch the order's current Work Items' states: `tx.workItem.findMany({ where: { orderId }, select: { state: true } })`.
   b. If `isOrderFinished(workItems)` (data-model.md) → throw `new DomainOrderError("ORDER_FINISHED", "Order is fully finished; create a new order instead.")` — **before** any write (caller's `try/catch` converts this to a user message; nothing was written).
   c. Otherwise `tx.workItem.create({ data: { orderId, state: "NEW", ...input } })`.
   d. `audit.record(tx, { action: "workitem.created", entityType: "WorkItem", entityId: workItem.id, actorId: actor.userId, after: { ...input, orderId, addedToExistingOrder: true } })`.
4. Return `{ workItemId }`.

## `editWorkItem`

```ts
function editWorkItem(
  actor: Actor,
  workItemId: string,
  patch: Partial<{
    quantity: number;
    widthValue: number;
    heightValue: number;
    dimensionUnit: WorkItemDimensionUnit;
    material: string;
    finishNotes: string;
    dueDate: Date | null;
  }>,
): Promise<void>;
```

1. `authorize(actor, "order.edit")`.
2. Zod-validate `patch` (all fields optional, but if present must pass the same rules as
   `WorkItemCreateInput`'s corresponding field; at least one key required — an empty patch is a
   caller bug, reject with a validation error).
3. `tx = db.$transaction`:
   a. `existing = tx.workItem.findUniqueOrThrow({ where: { id: workItemId } })`.
   b. If `!PRE_DESIGN_EDITABLE_STATES.has(existing.state)` (data-model.md) → throw
      `new DomainOrderError("PAST_EDIT_WINDOW", "This item has entered design; use 016's change process instead.")`.
   c. `tx.workItem.update({ where: { id: workItemId }, data: patch })`.
   d. `audit.record(tx, { action: "workitem.edited", entityType: "WorkItem", entityId: workItemId, actorId: actor.userId, before: pick(existing, Object.keys(patch)), after: patch })`.

## `cancelWorkItem`

```ts
function cancelWorkItem(actor: Actor, workItemId: string, reason: string): Promise<void>;
```

1. `authorize(actor, "order.cancel")`.
2. Zod-validate `reason` (non-empty after trim — matches 002's own `transitionWorkItem` requirement
   that `CANCELLED` edges require a reason; this is enforced twice, once here for a fast user-facing
   error and once inside `transitionWorkItem` itself as the real guarantee).
3. `tx = db.$transaction`: call `transitionWorkItem(tx, { workItemId: asWorkItemId(workItemId), to: "CANCELLED", actor, reason })`
   (imported from `~/server/core`). If the returned `Result` is `{ ok: false }`, surface its
   `error.code` (e.g. `"INVALID_TRANSITION"` if already terminal — matches FR-011's "refuse to
   cancel a Work Item already in a terminal state") — **do not** wrap this in another
   `DomainOrderError`; let 002's own `DomainError` shape pass through, since `transitionWorkItem`
   already handles the audit write internally as part of its own contract (contracts/workflow.md
   step 6) — this function does NOT call `audit.record` again itself, to avoid a duplicate event.

## `cancelOrder`

```ts
function cancelOrder(actor: Actor, orderId: string, reason: string): Promise<{ cancelledWorkItemIds: string[] }>;
```

1. `authorize(actor, "order.cancel")`.
2. Zod-validate `reason`.
3. `tx = db.$transaction`:
   a. `workItems = tx.workItem.findMany({ where: { orderId }, select: { id: true, state: true } })`.
   b. `nonTerminal = workItems.filter(wi => !["DELIVERED", "COMPLETED", "CANCELLED"].includes(wi.state))`.
   c. For each item in `nonTerminal`, in order: `await transitionWorkItem(tx, { workItemId: asWorkItemId(wi.id), to: "CANCELLED", actor, reason })`, collecting successful ids. A single item's `INVALID_TRANSITION` mid-loop (e.g. it became terminal between step (a)'s read and this write, in a hypothetical concurrent edit) is logged and skipped, not thrown — cancelling "the order" is best-effort across its items, not an all-or-nothing atomic unit (matches FR-011a's per-item audited framing; document this explicitly in the function's own comment, since it deliberately does not roll back the whole batch on one item's edge case).
4. Return `{ cancelledWorkItemIds }`.

## `changeOrderPriority`

```ts
function changeOrderPriority(actor: Actor, orderId: string, priority: OrderPriority): Promise<void>;
```

1. `authorize(actor, "order.edit")`.
2. Zod-validate `priority` is a valid `OrderPriority` member.
3. `tx = db.$transaction`:
   a. `existing = tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { priority: true } })`.
   b. If `existing.priority === priority` → return without writing or auditing (no-op change is not
      an event).
   c. `tx.order.update({ where: { id: orderId }, data: { priority } })`.
   d. `audit.record(tx, { action: "order.priority_changed", entityType: "Order", entityId: orderId, actorId: actor.userId, before: { priority: existing.priority }, after: { priority } })`.
4. Matches FR-007's "Changing an order's priority MUST be recorded as an audited event" and US3
   Acceptance Scenario 3 (priority change moves the order to the front of the reception queue
   without skipping any workflow gate — `changeOrderPriority` never touches `WorkItem.state`).

## `searchOrders`

```ts
function searchOrders(
  actor: Actor,
  query: { orderNumber?: number; phone?: string; customerName?: string },
): Promise<OrderSearchResult[]>;

interface OrderSearchResult {
  orderId: string;
  orderNumber: number;
  customerName: string;
  channel: OrderChannel;
  priority: OrderPriority;
  status: OrderStatusBucket;         // from 002's deriveOrderStatus — computed per result, not stored
  createdAt: Date;
}
```

1. Requires only an authenticated `actor` (`getActor()` resolved a session) — **no specific
   `Permission` gate**. FR-010 says "any authorized user," and US4 frames order lookup as something
   reception, a designer, *and* an admin all need ("anyone who needs to answer 'where is this
   order?'") — narrower than Reception's own capability set. 001 froze the `Permission` vocabulary
   at 22 keys with no `order.view` entry, so this stays a plain authentication check rather than
   inventing one; every *mutating* function in this file keeps its specific permission gate as
   before. `listReceptionQueue` and `getOrderDetail` (contracts below) apply this same
   authenticated-only rule for the same reason.
2. Build a single Prisma query with `OR` branches (research.md §5): exact `number` match if
   `query.orderNumber` is set; `customer: { name: { contains: query.customerName, mode: "insensitive" } }`
   if set; `customer: { phone: { contains: query.phone } }` if set **and** the `Customer.phone`
   field exists (guard via a runtime check or a 010-availability flag — see research.md §5's note;
   if 010 hasn't shipped yet, silently drop this clause rather than erroring).
3. Include `workItems: { select: { state: true } }` on the query so `deriveOrderStatus` can run
   per result without N+1 queries.
4. Map each result through `deriveOrderStatus(order.workItems)` for `status`.

## `listReceptionQueue`

```ts
function listReceptionQueue(
  actor: Actor,
  opts?: { getDelayedWorkItemIds?: () => Promise<ReadonlySet<string>> }, // 053, optional
): Promise<OrderQueueRow[]>;

interface OrderQueueRow extends OrderSearchResult {
  isComplete: boolean;        // isOrderComplete() result
  delayed: boolean;           // false when opts.getDelayedWorkItemIds is not supplied (053 not shipped)
}
```

1. Requires only an authenticated `actor` — same rationale as `searchOrders` above.
2. Query orders with their Work Items' completeness-relevant fields and states (no filter — every
   order with at least one non-`DELIVERED` Work Item is "new/unassigned" territory; FR-008 does not
   ask this list to hide finished orders, only to sort/flag the active ones usefully).
3. Sort: `priority === "URGENT"` first, then `createdAt` ascending within each bucket (FR-008).
4. Map each row through `isOrderComplete()` (FR-002) and, when `opts.getDelayedWorkItemIds` is
   supplied, mark `delayed: true` if any of that order's Work Item ids appear in the returned set
   (FR-008a) — omitted entirely (`delayed: false`) when 053 hasn't shipped.

## `getOrderDetail`

```ts
function getOrderDetail(actor: Actor, orderId: string): Promise<{
  order: OrderSearchResult;
  workItems: WorkItemDetail[];
  timeline: TimelineEntry[];
  isComplete: boolean;
}>;

interface TimelineEntry { workItemId: string; from: WorkItemState | null; to: WorkItemState; actorId: string; at: Date; reason?: string; }
```

1. Requires only an authenticated `actor` — same rationale as `searchOrders` above.
2. Fetch the `Order` with `Customer`, all `WorkItem`s, and each Work Item's
   `WorkItemTransition[]` (002).
3. Flatten every Work Item's transitions into one list, sort by `at` ascending, across the whole
   order — this is FR-009's "chronological timeline of every transition recorded against any of its
   Work Items."
4. Compute `status` via `deriveOrderStatus` and `isComplete` via `isOrderComplete()`.

## Authorization table

| Function | Permission |
|---|---|
| `quickCreateOrder`, `createOrder`, `addWorkItem` | `order.create` |
| `editWorkItem` | `order.edit` |
| `cancelWorkItem`, `cancelOrder` | `order.cancel` |
| `changeOrderPriority` | `order.edit` |
| `searchOrders`, `listReceptionQueue`, `getOrderDetail` | none — authenticated actor only (see rationale in `searchOrders` above) |

All mutation permissions are already seeded onto `RECEPTION` and `PRINT_RECEPTION_DELIVERY` in
`prisma/seed.ts` (confirmed by reading that file — no seed change needed for these permission
grants; only the new `ProductType` starter-catalog seed data is new, per data-model.md).
