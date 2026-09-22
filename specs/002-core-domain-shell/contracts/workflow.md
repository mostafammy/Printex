# Contract: Work Item Workflow

Owner: 002 (this feature). Primary consumer: 011 (order entry/reception screens) and every feature
that needs to move a Work Item forward (024–028 pricing, 050 production, 051 delivery gate).

## `transitionWorkItem`

```ts
function transitionWorkItem(
  tx: Prisma.TransactionClient,
  input: {
    workItemId: WorkItemId;
    to: WorkItemState;
    actor: Actor;                 // from 001's getActor(); { id, roles, departmentIds }
    reason?: string;               // required by validation for edges landing in REWORK_REQUIRED or CANCELLED
    rejectionCategory?: RejectionCategory; // required when `to === "REWORK_REQUIRED"`
    meta?: Record<string, JsonValue>;
  }
): Promise<Result<WorkItemSnapshot, DomainError>>;   // see "Error/rejection behavior" below — this can also reject
```

**Behavior** (all inside the caller-supplied `tx`, so the caller controls the outer transaction
boundary — e.g. 011 wraps Order creation + first transition in one `tx`):

1. Load the Work Item's current state (`from`).
2. Look up `(from, to)` in the allowed-edges table ([data-model.md](../data-model.md#allowed-edges-table-authoritative)).
   Not found → `err({ code: "INVALID_TRANSITION" })`; nothing written.
3. Run every guard registered against this `(from, to)` pair (see `registerGuard` below), in
   registration order. Any guard returning `{ ok: false }` → `err({ code: "GUARD_FAILED" })`;
   nothing written.
4. Apply the state change via an **optimistic-concurrency** write —
   `updateMany({ where: { id, state: from }, data: { state: to } })` and check `count === 1`, not a
   blind `update`. A `count` of 0 means another call already moved this Work Item between step 1's
   read and this write; that resolves to `err({ code: "INVALID_TRANSITION" })` (the frozen
   `ErrorCode` union has no dedicated conflict code — this is a deliberate reuse, not an oversight)
   with nothing written, same as step 2/3's failures.
5. Close the Work Item's currently-open `PhaseTiming` segment(s) and open a new one for the
   destination phase — in the **same** `tx` as every other write in this list.
6. Insert a `WorkItemTransition` row (actor, from, to, reason, rejectionCategory, meta). Until
   001-identity-access-audit ships a real `AuditEvent` table, this immutable, same-`tx` row is what
   satisfies constitution III's audit requirement; once 001 lands, its `audit.record` call slots in
   here as one more write in the same `tx`.
7. Call `notify()` for this transition (same `tx`).
8. Return the updated Work Item as `ok(snapshot)`.

**Error/rejection behavior — read this before calling from a Server Action**: every failure
detected *before* step 4's write (not-found, invalid edge, guard failure, missing
`reason`/`rejectionCategory`) resolves to a normal `err(...)` `Result` — nothing was written, so
there's nothing to roll back. **Once step 4 succeeds, this function stops catching errors.**
Prisma's `$transaction(async (tx) => ...)` only rolls back when its callback's promise *rejects* —
so a failure in steps 5–7 is deliberately left to propagate as a rejection rather than being caught
into a resolved `err(...)`, which is the only way to guarantee "steps 4–7 either all commit or all
roll back together." **Callers must wrap `transitionWorkItem` in `try/catch`, not just check
`.ok`**, to convert this rare post-write failure into their own error handling (a Server Action
adapter already needs a catch-all `try/catch` at its boundary per FR-012 — this is covered by that,
not an extra step).

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
    meta?: Record<string, JsonValue>;
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

## `rejectionCategory` does not auto-route

`REWORK_REQUIRED` has two legal outgoing edges: `IN_DESIGN` (default) and `ASSIGNED`
(reassignment). `transitionWorkItem` does **not** infer which one to use from
`rejectionCategory` — none of the 8 `RejectionCategory` values inherently means "the wrong person
was assigned" (see `src/server/core/workflow/rejectionCategory.ts` for the reasoning). Reassignment
is a separate, explicit human decision: a caller requests `to: "ASSIGNED"` on the *next* transition
out of `REWORK_REQUIRED` when someone decides that's needed, exactly like any other edge. Callers
should not build UI that assumes a category auto-selects a landing state.

## Consuming the state list

`WorkItemState` and the edges table are exported from `src/server/core/workflow/states.ts` and
`edges.ts` respectively — import them, do not redefine the state list in a downstream feature.
