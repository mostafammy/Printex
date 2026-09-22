# Contract: Work Item Workflow

Owner: 002 (this feature). Primary consumer: 011 (order entry/reception screens) and every feature
that needs to move a Work Item forward (024–028 pricing, 050 production, 051 delivery gate).

## `transitionWorkItem`

```ts
function transitionWorkItem(
  tx: PrismaTransactionClient,
  input: {
    workItemId: string;
    to: WorkItemState;
    actor: Actor;                 // from 001's getActor(); { id, roles, departmentIds }
    reason?: string;               // required by validation for edges landing in REWORK_REQUIRED or CANCELLED
    rejectionCategory?: RejectionCategory; // required when `to === "REWORK_REQUIRED"`
    meta?: Record<string, unknown>;
  }
): Promise<WorkItem>;
```

**Behavior** (all inside the caller-supplied `tx`, so the caller controls the outer transaction
boundary — e.g. 011 wraps Order creation + first transition in one `tx`):

1. Load the Work Item's current state.
2. Look up `(current, to)` in the allowed-edges table ([data-model.md](../data-model.md#allowed-edges-table-authoritative)).
   Not found → return/throw `INVALID_TRANSITION` (per [errors.md](./errors.md)); nothing written.
3. Run every guard registered against this `(from, to)` pair (see `registerGuard` below), in
   registration order. Any guard returning `{ ok: false }` or throwing → the whole call fails with
   `GUARD_FAILED` (guard's `code`/`message` attached); nothing written.
4. Write a `WorkItemTransition` row, update `WorkItem.state`, write the corresponding audit event
   (via 001's `audit.record`), and call `notify()` for this transition — all within `tx`.
5. Return the updated Work Item.

**Guarantee**: steps 4 either all commit or all roll back together, because they share `tx`
(constitution V, III). If `audit.record` throws, the `WorkItem.state` write rolls back too.

**This is the only code path allowed to write `WorkItem.state`.** No other function, migration
script, or admin tool may set that column directly (spec FR-005).

## `registerGuard`

```ts
function registerGuard(
  match: { from?: WorkItemState; to: WorkItemState },
  guard: (ctx: {
    workItem: WorkItem;
    actor: Actor;
    reason?: string;
    meta?: Record<string, unknown>;
  }) => Promise<{ ok: true } | { ok: false; code: string; message: string }>
): void;
```

- Call at module load time (top-level in the registering feature's server module), not inside a
  request handler — registration is process-lifetime, not per-request.
- `match.from` omitted = the guard runs for every edge landing on `match.to`, regardless of source
  state.
- Guards run in registration order; the first failure wins and short-circuits the rest.
- A guard MUST be side-effect-free on failure (no partial writes) — it only inspects state and
  returns a verdict. Any writes a guard needs belong in `transitionWorkItem`'s own step 4 pipeline
  via `meta`, not inside the guard itself.

### Example (illustrative — implemented by 051, not by this feature)

```ts
registerGuard({ to: "DELIVERED" }, async ({ workItem }) => {
  const priced = await isPriced(workItem.id);
  return priced ? { ok: true } : { ok: false, code: "UNPRICED", message: "..." };
});
```

## Consuming the state list

`WorkItemState` and the edges table are exported from `src/server/core/workflow/states.ts` and
`edges.ts` respectively — import them, do not redefine the state list in a downstream feature.
