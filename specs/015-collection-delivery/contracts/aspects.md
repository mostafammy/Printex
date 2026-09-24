# Contract: Shared Command/Query Aspects (`src/server/core/aspects/`)

**Status**: canonical definition. It is authored in 015 and referenced by 016 (change control) and by any later
module. **Ownership**: the first feature to implement this (015 or 016) creates the files, and every later feature
reuses them unchanged. Changing this contract requires updating this file and notifying every consumer
feature.

## 1. Why the layer is split in two

There are two existing, enforced rules in `eslint.config.js`:

- **Rule (a)**: `src/server/core/**` must not import `~/server/<feature>/**`. That includes
  `~/server/auth` (`authorize`, `audit`) and `~/server/db`. `src/server/auth/index.ts` restates this in its header
  comment ("core must not import from auth").
- **Rule (c)**: `src/server/core/**` must not contain a `throw` statement. The one exemption is
  `src/server/core/storage/**`, which holds port implementations.

For an interactive transaction to roll back, the callback passed to `db.$transaction` has to reject. The engine
therefore has to throw, and it also needs `authorize`, `audit` and `db`. The layer is split as follows:

| Part | Path | Imports | Purpose |
|---|---|---|---|
| **Generic engine** | `src/server/core/aspects/{types,engine,errors,transition}.ts`, exported from `src/server/core/index.ts` | `zod`, core internals, generated Prisma **types** only | `createAspects(deps)`, `transitionOrThrow`, the error classes, the result/error types. It knows nothing about auth, db, or any feature |
| **Composition root** (one file, shared) | `src/server/aspects.ts` (sits next to `src/server/db.ts`) | `~/server/core`, `~/server/auth`, `~/server/db` | Calls `createAspects` **once**, binding 001's `authorize`/`audit`, `db.$transaction` and 001's `Actor`/`Permission`. It exports `aspects` |
| **Per-module binding** | e.g. `src/server/collection/aspect.ts`, `src/server/changes/aspect.ts` | `~/server/aspects` | `aspects.forModule<ModuleError>({ … })`. It supplies the module's error union and guard-code mapping, and exports that module's `defineCommand`/`defineQuery` |

A rule-(c) exemption is required. `eslint.config.js` rule (c) adds `"src/server/core/aspects/**"` to its
`ignores`, next to `src/server/core/storage/**`, with this comment: "transaction-boundary adapter: must reject
to roll back; public entry points still return a Result". This is the only lint change the layer needs.
Rule (a) stays as it is.

## 2. Types (`src/server/core/aspects/types.ts`)

```ts
import type { Prisma } from "../../../../generated/prisma";
import type { z } from "zod";
import type { Actor as CoreActor, WorkItemState } from "~/server/core";

export type Tx = Prisma.TransactionClient;

/** Codes every module inherits. A module's own union is added on top of these. */
export type AspectBaseError =
  | { readonly code: "VALIDATION"; readonly issues: readonly { path: string; message: string }[] }
  | { readonly code: "FORBIDDEN" }
  | { readonly code: "NOT_FOUND"; readonly entity: string; readonly id: string }
  | { readonly code: "CONFLICT"; readonly entity: string; readonly id: string }
  | { readonly code: "INVALID_STATE"; readonly workItemIds: readonly string[];
      readonly expected: readonly WorkItemState[] }
  | { readonly code: "GUARD_FAILED"; readonly guardCode: string; readonly message: string };

export type ModuleErrorShape = { readonly code: string };

export type AspectResult<T, E extends ModuleErrorShape> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: AspectBaseError | E };

/** A single key, a non-empty any-of list, or a PURE function of the validated input (no I/O). */
export type PermissionSpec<P extends string, I> =
  | P
  | readonly [P, ...P[]]
  | ((input: I) => P | readonly [P, ...P[]]);

export interface AuditEntry {
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string;
  readonly attachmentIds?: readonly string[];
}

export type RunOutcome<O> =
  | { readonly value: O; readonly audit: readonly [AuditEntry, ...AuditEntry[]] }
  | { readonly value: O; readonly noChange: true };   // type-checked: only when allowNoChange: true

export interface TxScope {
  readonly tx: Tx;
  /** Registers a hook that runs after the OUTERMOST transaction commits. */
  readonly afterCommit: (hook: () => Promise<void>) => void;
}

export interface CommandCtx<A, P extends string, I, Prep> extends TxScope {
  readonly actor: A;
  readonly coreActor: CoreActor;         // branded UserId, built once via asUserId
  readonly input: I;
  readonly prepared: Prep;               // value returned by `prepare`, or undefined
  /** Scoped permission check, for example a department scope, after an entity is loaded. Throws Forbidden. */
  readonly check: (permission: P, scope?: { departmentId?: string }) => void;
  /** transitionOrThrow with tx and actor pre-bound (§3.3). */
  readonly transition: (i: Omit<TransitionOrThrowInput, "actor">) => Promise<TransitionOutcome>;
}

export interface AspectDeps<A extends { userId: string }, P extends string> {
  /** db.$transaction(fn, opts). */
  readonly transaction: <T>(fn: (tx: Tx) => Promise<T>,
    opts?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }) => Promise<T>;
  /** Read client that queries use outside a transaction (the db instance). */
  readonly reader: Tx;
  /** 001 authorize(): returns on success, throws on denial. */
  readonly checkPermission: (actor: A, permission: P, scope?: { departmentId?: string }) => void;
  /** Recognises the denial error. 001 does not export ForbiddenError, so the match is on `name`. */
  readonly isForbidden: (e: unknown) => boolean;
  /** 001 audit.record(). actorId is always taken from the actor, never from the entry. */
  readonly recordAudit: (tx: Tx, entry: AuditEntry & { actorId: string }) => Promise<void>;
  /** An afterCommit hook failed. The data is already committed, so the result stays ok. */
  readonly onAfterCommitError: (e: unknown, meta: { action: string }) => void;
}
```

## 3. Engine (`src/server/core/aspects/engine.ts`)

```ts
export function createAspects<A extends { userId: string }, P extends string>(
  deps: AspectDeps<A, P>,
): {
  forModule<E extends ModuleErrorShape>(opts: {
    /** Module name, used in misuse errors and logs. */
    readonly module: string;
    /** Maps a transitionWorkItem GUARD_FAILED guardCode to a module error. undefined → base GUARD_FAILED. */
    readonly mapGuardFailure?: (guardCode: string, details: unknown) => E | undefined;
    /** Maps a Prisma P2002 unique violation to a module error. undefined → base CONFLICT. */
    readonly mapUniqueViolation?: (target: readonly string[]) => E | undefined;
  }): {
    defineCommand: DefineCommand<A, P, E>;
    defineQuery: DefineQuery<A, P, E>;
  };
};

type DefineCommand<A, P extends string, E extends ModuleErrorShape> = <
  S extends z.ZodTypeAny, O, Prep = undefined, NoChange extends boolean = false,
>(def: {
  readonly action: string;                                   // audit action prefix, used in logs
  readonly input: S;
  readonly permission: PermissionSpec<P, z.output<S>>;
  readonly prepare?: (c: { actor: A; input: z.output<S> }) => Promise<Prep>;
  readonly authorize?: (c: CommandCtx<A, P, z.output<S>, Prep>) => Promise<void> | void;
  readonly run: (c: CommandCtx<A, P, z.output<S>, Prep>) => Promise<
    NoChange extends true ? RunOutcome<O>
      : { readonly value: O; readonly audit: readonly [AuditEntry, ...AuditEntry[]] }>;
  readonly allowNoChange?: NoChange;
  readonly txOptions?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel };
}) => {
  /** Public entry point. It never throws a domain error. It re-throws only programming or infrastructure errors. */
  (actor: A, raw: z.input<S>): Promise<AspectResult<O, E>>;
  /** Composition inside a caller's transaction. It throws AspectDomainError<E> so the caller rolls back.
   *  Exists only when the command has no `prepare` (conditional type), because pre-transaction I/O cannot run
   *  inside someone else's transaction. */
  inTx: [Prep] extends [undefined] ? (scope: TxScope, actor: A, raw: z.input<S>) => Promise<O> : never;
};

type DefineQuery<A, P extends string, E extends ModuleErrorShape> = <S extends z.ZodTypeAny, O>(def: {
  readonly input: S;
  readonly permission: PermissionSpec<P, z.output<S>>;
  readonly authorize?: (c: { client: Tx; actor: A; input: z.output<S>;
                             check: (p: P, scope?: { departmentId?: string }) => void }) => Promise<void> | void;
  readonly run: (c: { client: Tx; actor: A; coreActor: CoreActor; input: z.output<S> }) => Promise<O>;
  /** true → run inside a read transaction for a consistent snapshot. `consistent: true` runs the query in a REPEATABLE READ read transaction. */
  readonly consistent?: boolean;
}) => (actor: A, raw: z.input<S>) => Promise<AspectResult<O, E>>;
```

### 3.1 Command pipeline (fixed order, not configurable)

1. **Validate** `raw` with `input` (Zod). Failure → `VALIDATION { issues }`. No I/O has happened yet.
2. **Permission** (no I/O). Resolve the `PermissionSpec`: a function is called with the parsed input, and an array
   means any-of. The step passes if `checkPermission` succeeds for at least one key. Otherwise → `FORBIDDEN`.
3. **Prepare** (optional, pre-transaction I/O such as file staging or batched port reads). It runs **only after**
   step 2, so an unauthorised caller can never trigger I/O or learn anything from it.
4. **`deps.transaction`** opens the transaction with `txOptions`.
5. **Authorize** (optional, entity-scoped). This hook loads the entity inside the same `tx` and calls
   `ctx.check(p, { departmentId })`. Because the check and the write share one transaction, there is no
   TOCTOU gap between them.
6. **Run**. It receives `tx`, `actor`, `coreActor`, `input`, `prepared`, `check`, `transition` and `afterCommit`.
7. **Audit**. Each returned `AuditEntry` is written through `deps.recordAudit` in the same `tx`, with
   `actorId = actor.userId`. If an outcome has no entries and no `noChange`, the engine raises
   `AspectMisuseError` (a runtime check that backs up the type system). `noChange` is accepted only when
   `allowNoChange: true`.
8. **Commit**.
9. **afterCommit hooks** run in registration order, sequentially. A hook failure goes to
   `deps.onAfterCommitError`, and the command still returns `ok`. Hooks registered by nested `.inTx`
   calls go to the outermost command's queue.
10. **Map errors** (below). Unknown errors are re-thrown and never swallowed.

`inTx(scope, actor, raw)` runs steps 1, 2, 5, 6 and 7 in `scope.tx` and forwards hooks to `scope.afterCommit`.
Failures throw `AspectDomainError<E>`. A `CommandCtx` can be passed straight in as the `TxScope`.

A **query** runs step 1, then step 2, then `authorize`, then `run` on `deps.reader`, or inside a transaction when
`consistent: true`, then maps errors. Queries write no audit entries.

### 3.2 Error mapping (`src/server/core/aspects/errors.ts`), the only place errors are converted

| Caught | Public `error` |
|---|---|
| `ZodError` | `VALIDATION { issues }` |
| `deps.isForbidden(e)` | `FORBIDDEN` |
| `AspectDomainError<E>` (module-raised, via `fail(e)`) | `e.error` |
| `TransitionFailure` whose `error.code` is `VALIDATION` | `VALIDATION { issues: [{ path: "", message }] }` |
| `TransitionFailure` with `INVALID_TRANSITION` and `details.expectedFrom` (optimistic-concurrency miss) | `CONFLICT { entity: "WorkItem", id }` |
| `TransitionFailure` with `INVALID_TRANSITION` and no `expectedFrom` | `INVALID_STATE { workItemIds: [id], expected: [] }` |
| `TransitionFailure` with `GUARD_FAILED` and `details.guardCode = g` | `mapGuardFailure(g, details) ?? GUARD_FAILED { guardCode: g, message }` |
| Prisma error with `code === "P2002"` (checked structurally) | `mapUniqueViolation(meta.target) ?? CONFLICT { entity: modelName, id: "" }` |
| `AspectMisuseError`, anything else | re-thrown |

```ts
export class AspectDomainError<E extends ModuleErrorShape> extends Error {
  constructor(readonly error: AspectBaseError | E) { super(error.code); this.name = "AspectDomainError"; }
}
export const fail = <E extends ModuleErrorShape>(error: AspectBaseError | E): never => {
  throw new AspectDomainError(error);
};
export class TransitionFailure extends Error {
  constructor(readonly workItemId: string, readonly error: DomainError) { super(error.code); }
}
export class AspectMisuseError extends Error {}
```

### 3.3 `transitionOrThrow` (`src/server/core/aspects/transition.ts`)

```ts
export interface TransitionOrThrowInput {
  workItemId: string; to: WorkItemState; actor: { userId: string };
  reason?: string; rejectionCategory?: RejectionCategory; meta?: JsonValue;
}
export interface TransitionOutcome { from: WorkItemState; to: WorkItemState }
export async function transitionOrThrow(tx: Tx, input: TransitionOrThrowInput): Promise<TransitionOutcome>;
```

It converts the actor with `asUserId`, calls core's `transitionWorkItem`, and on `{ ok: false }` throws
`TransitionFailure(workItemId, error)`. This replaces the `toCoreActor` + `WorkItemTransitionError` pair that is
copy-pasted in `orders/cancelOrder.ts`, `designers/assignment.ts`, `review/review.ts`, `production/timer.ts`
and `production/sendBack.ts`. Refactoring those files is **not** part of 015 or 016. It is a later, separate
refactor.

## 4. Composition root (`src/server/aspects.ts`, created once)

```ts
import { createAspects } from "~/server/core";
import { authorize, audit, type Actor, type Permission } from "~/server/auth";
import { db } from "~/server/db";

export const aspects = createAspects<Actor, Permission>({
  transaction: (fn, opts) => db.$transaction(fn, opts),
  reader: db,
  checkPermission: (actor, p, scope) => authorize(actor, p, scope),
  isForbidden: (e) => e instanceof Error && e.name === "ForbiddenError",
  recordAudit: (tx, e) => audit.record(tx, { ...e, attachmentIds: e.attachmentIds ? [...e.attachmentIds] : undefined }),
  onAfterCommitError: (e, meta) => console.error("[aspects] afterCommit failed", meta.action, e),
});
```

## 5. Per-module binding (example: 015)

```ts
// src/server/collection/aspect.ts
import { aspects } from "~/server/aspects";
import type { CollectionError } from "./errors";
export const { defineCommand, defineQuery } = aspects.forModule<CollectionError>({
  module: "collection",
  mapGuardFailure: (g) =>
    g === "PRICING_UNRESOLVED" ? { code: "PRICING_UNRESOLVED", items: [] }
    : g === "CLOSURE_CONDITIONS_UNMET" ? { code: "CLOSURE_NOT_READY", unmet: [] }
    : undefined,
});
export type CollectionResult<T> = import("~/server/core").AspectResult<T, CollectionError>;
```

Mapping from 016's module-local draft (016 research §11): `auditAction` → `action`; `scope(tx, input)` → the
`authorize` hook calling `ctx.check(p, { departmentId })`; `ctx.transition` → the same name here;
`toChangeActionResult` → not needed, because the public call already returns `AspectResult`.

## 6. Barrel additions (`src/server/core/index.ts`)

```ts
// contracts: shared aspects (specs/015-collection-delivery/contracts/aspects.md)
export type { Tx, AspectBaseError, AspectResult, ModuleErrorShape, PermissionSpec, AuditEntry,
  RunOutcome, TxScope, CommandCtx, AspectDeps } from "./aspects/types";
export { createAspects } from "./aspects/engine";
export { AspectDomainError, TransitionFailure, AspectMisuseError, fail } from "./aspects/errors";
export { transitionOrThrow } from "./aspects/transition";
export type { TransitionOrThrowInput, TransitionOutcome } from "./aspects/transition";
```

## 7. Required tests (`tests/unit/core/aspects.test.ts`, created by whichever feature implements first)

These use in-memory fake `deps`:

- Order of steps: validation runs before permission, permission before `prepare`, and `prepare` before the transaction. A
  denied actor never reaches `prepare`, `transaction` or `run`.
- A function-form `PermissionSpec` receives the parsed input. Any-of passes when at least one key is allowed.
- The `authorize` hook runs inside the same `tx` as `run`.
- Every audit entry is written in that `tx` with `actorId = actor.userId`. An empty audit list raises
  `AspectMisuseError`. `noChange` is rejected unless `allowNoChange`.
- `afterCommit` runs only after commit, and not at all on rollback. A hook failure still returns `ok` and calls
  `onAfterCommitError`. Nested `.inTx` hooks run once, after the outer commit.
- `.inTx` throws `AspectDomainError`, so the outer fake transaction rolls back.
- Every row of the §3.2 mapping table is covered. Unknown errors are re-thrown.
- The engine files under `src/server/core/aspects/**` contain no import of `~/server/*` outside core (rule (a)).
