# Contracts: Events, Ports, and Guards (cross-team)

These are the extension points other features, **051 Pricing, 052 Finance, and 054 WhatsApp
(Track B, owner Fady)**, build against. They are exported from `~/server/changes` and are frozen
once 016 merges. A change to any of them needs a new version of this document agreed by both
tracks.

## 1. `SPEC_CHANGED` event (`events.ts`)

```ts
export const SPEC_CHANGED = "work_item.spec_changed" as const;

export type SpecChangedEvent = {
  readonly type: typeof SPEC_CHANGED;
  readonly workItemId: string;
  readonly orderId: string;
  readonly fromVersion: number;          // >= 1
  readonly toVersion: number;            // fromVersion + 1
  readonly specVersionId: string;        // the new version
  readonly origin: "DIRECT_EDIT" | "CHANGE_REQUEST" | "ADMIN_OVERRIDE";
  readonly changeRequestId: string | null; // non-null for CHANGE_REQUEST and in-production overrides
  readonly changedFields: readonly SpecField[]; // non-empty, SPEC_FIELDS order
  readonly workItemState: WorkItemState;  // state at emission time (before any redesign transition)
  readonly actorId: string;
  readonly occurredAt: Date;
};

export type SpecChangeListener = (tx: Prisma.TransactionClient, event: SpecChangedEvent) => Promise<void>;

export function registerSpecChangeListener(name: string, listener: SpecChangeListener): void;
/** internal — called only by applySpecChangeInTx */
export function emitSpecChangedInTx(tx: Prisma.TransactionClient, event: SpecChangedEvent): Promise<void>;
```

**Guarantees (016 side)**:

- The event is emitted **exactly once per new version after v1**. It is never emitted for
  `INITIAL` or `BACKFILL`, for a refused change, or for a due-date edit (FR-021, FR-031).
- Listeners run **sequentially in registration order**, inside the same transaction as the new
  version, before commit. If any listener throws, the whole change is rolled back: version, mirror
  columns, change request decision, state transition, Return, audit, and notifications (FR-022).
  **Veto semantics under the shared aspect layer** ([aspects.md](./aspects.md) §3.2):
  - A **typed veto** means the listener throws `fail({ code: "SPEC_CHANGE_VETOED", listener:
    "<name>", reason })`. The transaction rolls back and the caller receives `{ ok: false, error: {
    code: "SPEC_CHANGE_VETOED", … } }`, a normal refusal the UI can explain.
  - **Any other throw** is an unknown error to the engine. The transaction still rolls back, and
    the error is re-thrown as a 500-class failure.
  - A listener MUST NOT throw another module's `AspectDomainError`. That would leak an
    out-of-union code into `ChangeResult`.
  - The same applies when the change runs inside 011's hand-written transaction (`editWorkItem`):
    either kind of throw rolls back 011's transaction.
- After the listeners run, one outbox row is written with `notify(tx, { type: SPEC_CHANGED, entity:
  { type: "WorkItem", id }, recipients: { userIds: [assigneeId?], departmentIds:
  [effectiveDepartmentId?] }, payload: event })`, for 053/090 delivery.
- `registerSpecChangeListener` with a `name` that is already registered replaces that listener.
  This keeps it idempotent under hot reload and test re-imports. An empty registry is valid
  (FR-023).
- A test-only `__resetSpecChangeListenersForTests()` is exported from `events.ts`. It is **not**
  in the barrel, and tests import it by path (the ESLint rule exempts `tests/**`).

**Obligations (051 side)**, to be agreed:

1. At 051's module load (barrel side effect, like `registerGuard`), call
   `registerSpecChangeListener("pricing.reset", listener)`.
2. The listener MUST use the provided `tx`. It MUST NOT open its own transaction or call external
   systems, and MUST NOT call back into `~/server/changes` commands.
3. If the Work Item has a price in a "priced" status, set it to `PENDING`, record 051's own
   audit, and do nothing else. Recalculation is out of scope for both 016 and this hook.
4. Veto only when the pricing data is inconsistent, and do it only with `fail({ code:
   "SPEC_CHANGE_VETOED", listener: "pricing.reset", reason })` (see Veto semantics above). Vetoing
   blocks the spec change.
5. 051 owns an integration test that drives the **real** `approveChangeRequest`, `editSpec`, and
   `adminOverrideSpec` and asserts `PENDING` afterwards. 016 only proves the hook with a stand-in
   listener.
6. (Suggestion, 051's decision) Add a delivery-gate guard that compares the price's spec version
   with `WorkItem.currentSpecVersionId` as a belt-and-braces check.

## 2. `DirectCostPort` (`ports.ts`)

```ts
export type LateCancellationCost = {
  readonly lateCancellationId: string;   // source record (PRD §30 traceability)
  readonly workItemId: string;
  readonly orderId: string;
  readonly amount: string;               // exact decimal string, >= 0, 2 dp
  readonly currency: string;             // "EGP" today (LateCancellation.currency)
  readonly reason: string;
  readonly recordedById: string;
  readonly recordedAt: Date;
};

export interface DirectCostPort {
  recordLateCancellationCost(tx: Prisma.TransactionClient, cost: LateCancellationCost): Promise<void>;
}

export const noopDirectCostPort: DirectCostPort;
export function setDirectCostPort(port: DirectCostPort): void;   // called once by 052 at module load
export function getDirectCostPort(): DirectCostPort;              // internal
```

**Guarantees (016 side)**:

- The `LateCancellation` row is written **before** the port is called, in the same transaction.
  So the cost record exists even while the no-op port is installed, before 052 exists.
- The port is called exactly once per late cancellation. If it throws, the cancellation is rolled
  back.

**Obligations (052 side)**, to be agreed:

1. Implement the port with the provided `tx`, as a direct cost of the order, `sourceType:
   "LATE_CANCELLATION"`, `sourceId: lateCancellationId`. It must be idempotent on `sourceId`.
2. On first deployment of 052, backfill direct costs from all existing `LateCancellation` rows.
3. The amount is authoritative as entered. 052 must not recompute it.

## 3. Guards registered by 016 (`guards.ts`, loaded by importing `~/server/changes`)

| Edge (from → to) | Guard | Fails with `guardCode` | Allowed when |
|---|---|---|---|
| `IN_PRODUCTION → PRODUCTION_COMPLETED` | production hold | `CHANGE_HOLD` | `getProductionHold(db, id) === null` |
| `IN_PRODUCTION → REWORK_REQUIRED` | production hold | `CHANGE_HOLD` | no hold, **or** `meta.changeControl === "CHANGE_REQUEST_APPROVAL"` and `meta.changeRequestId` equals the pending hold's `changeRequestId` |
| `IN_PRODUCTION → CANCELLED` | late cancellation | `LATE_CANCELLATION_REQUIRED` | `meta.changeControl === "LATE_CANCELLATION"` |
| `PRODUCTION_COMPLETED → CANCELLED` | late cancellation | `LATE_CANCELLATION_REQUIRED` | same |
| `READY_FOR_COLLECTION → CANCELLED` | late cancellation | `LATE_CANCELLATION_REQUIRED` | same |

- Guards read via the global `db` (committed data), as `GuardContext` has no `tx` (research §18).
- The `meta` markers are a closed union parsed by a Zod schema inside the guard, and anything else
  is ignored:

  ```ts
  { changeControl: "LATE_CANCELLATION"; lateCancellationId: string }
  { changeControl: "CHANGE_REQUEST_APPROVAL"; changeRequestId: string }
  ```

  `meta` is not a security boundary against server code. Only server code can call
  `transitionWorkItem`, and code review plus the ESLint barrel rule keep the markers inside
  `src/server/changes/**`. This is recorded as a residual risk in research §18.
- **Registration is guaranteed** on the relevant paths. `~/server/orders` (`cancelWorkItem`,
  `cancelOrder`) and `~/server/production` (`completeProduction`, `sendBackToDesign`) both import
  `~/server/changes`, so its barrel's side-effect import runs first. A contract test asserts this
  for each path.
- `guards.ts` exports `registerChangeGuards()`, which is **idempotent** through a module-level flag,
  because 002's `registerGuard` appends on every call. The barrel calls it on import. This covers
  vitest, the seed, and scripts.
- `src/instrumentation.ts` is the **single shared registration point**, agreed with 015 and
  created by whichever feature lands first. Its `register()` runs when `NEXT_RUNTIME ===
  "nodejs"` and has one block per module. 016's block is `const { registerChangeGuards } = await
  import("~/server/changes"); registerChangeGuards();`. So a future route that never imports
  `orders` or `production` is still guarded (research §18).
- 015 (collection/delivery, Track A) and any future cancel path inherit these guards automatically.

## 4. Notification types emitted (outbox, for 053)

| `type` | When | Recipients |
|---|---|---|
| `work_item.spec_changed` | every new version after v1 | assignee, effective department |
| `work_item.customer_modification` | direct edit with an assigned designer | assignee (+ `design.review` holders in `WAITING_REVIEW`) |
| `work_item.change_requested` | CR recorded | effective department, `change.approve` holders |
| `work_item.revised_instruction` | CR approved with `CONTINUE_PRODUCTION` / override in production | effective department |
| `work_item.change_rejected` / `work_item.change_withdrawn` | CR rejected/withdrawn | requester, effective department |
| `work_item.customer_change_returned` | sent back to design for customer change | assignee |
| `work_item.late_cancelled` | late cancellation | order creator, effective department |

## 5. 054 WhatsApp (future, informational)

054 may record change requests that arrive by WhatsApp **only** by calling `createChangeRequest`
with a real actor who holds `order.edit`. Customer-side approval over WhatsApp is out of scope for
016. If 054 needs it, it adds a field to `ChangeRequest` in its own spec. It must not bypass
`approveChangeRequest`.
