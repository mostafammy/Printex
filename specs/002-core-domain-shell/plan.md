# Implementation Plan: Core Domain & Shell

**Branch**: `002-core-domain-shell` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-core-domain-shell/spec.md`

## Summary

Build the shared skeleton both Track A (order/workflow) and Track B (customers/files/pricing/
notifications) build on: the Prisma domain model (Customer, Order, WorkItem, WorkItemTransition,
PhaseTiming, Department, NotificationEvent), the single Work Item state machine (15 states, a
15-node allowed-edges table, skip paths, cancellation and rework-routing rules resolved in
`/speckit-clarify`), `transitionWorkItem()` as the sole state mutator with a pluggable guard
registry, `deriveOrderStatus()` as a pure bucket function, a `StorageAdapter` interface with a
local-disk stub, an outbox-based `notify()`, one typed server-action error pattern, an Arabic RTL
app shell, and the test/CI harness. Everything here is infrastructure — no real business screen —
so Track A (Mostafa, 011 next) and Track B (Fady, 001/010/050/053) can build against a frozen
contract instead of each other's internals.

## Technical Context

**Language/Version**: TypeScript 5.8, strict mode, Node.js (via Next.js 15 runtime)

**Primary Dependencies**: Next.js 15 (App Router, Server Actions), React 19, Prisma 6 +
PostgreSQL, Better Auth 1.3 (consumed, not built here), Zod 3, Tailwind CSS 4, shadcn/ui (added by
this feature), pnpm — all already present in the T3 scaffold except shadcn/ui and the test stack

**Storage**: PostgreSQL via Prisma for all domain data; local filesystem behind `StorageAdapter`
for the file-bytes stub (metadata still lives in Postgres)

**Testing**: Vitest (added by this feature) against a separate Postgres test database, with data
factories for Customer/Order/WorkItem; `pnpm check` (lint + typecheck) as a hard gate

**Target Platform**: Local LAN server (Node.js/Next.js), no public Internet exposure (constitution
VII); developed and CI'd on standard Linux/macOS runners

**Project Type**: Web application — single Next.js monolith (App Router serves both UI and server
actions); not a frontend/backend split

**Performance Goals**: Not perf-critical at V1 scale (constitution has no numeric SLA for this
feature); target is "queue and status views feel instant" for a few dozen concurrent internal
staff, not public-scale throughput

**Constraints**: Must run fully offline/local-first (principle VII); UI must be Arabic-first and
RTL with only logical (start/end) spacing (principle IX); no new framework/ORM/datastore/auth
mechanism without a Complexity Tracking justification (Technology constraints); state MUST change
only through the one transition function (principle V)

**Scale/Scope**: Single print shop; tens of staff users; low hundreds of Orders/Work Items per day
at V1 — an internal operational tool, not a multi-tenant SaaS product

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Order → Work Item Is the Canonical Model | This feature *is* that model: Order belongs to Customer/Cash Customer, Work Item belongs to exactly one Order, Order status is derived (never stored) | PASS |
| II. Business Gates Are Inviolable | This feature provides the *mechanism* (guard registry executed inside `transitionWorkItem`) that later features (001, 051) use to enforce gates; it enforces none of the business rules itself, by design | PASS (mechanism only — see Phase 1 research on pricing-gate placement) |
| III. History Is Append-Only | Every transition writes a `WorkItemTransition` + an audit event in the same DB transaction as the state change; no update/delete path exists for either | PASS |
| IV. Files Are Immutable, Private Versions | Out of scope for full versioning (050 owns it); this feature only defines the `StorageAdapter` interface (put/get/exists) so 050 can implement it without touching core code, and the local-disk stub never overwrites a key in place | PASS (interface-only; verified not to foreclose versioning) |
| V. The Server Is the Only Authority | All writes go through Next.js Server Actions with Zod input validation; `transitionWorkItem` is the single centralized transition function; a transition and its audit event commit in one transaction | PASS |
| VI. Configuration Over Hard-Coding | Departments are a `Department` table (Admin-configured), not an enum; Work Item states/edges are fixed by the state machine (a genuine finite protocol, not shop policy) so they remain code, per the same principle's intent (policy data vs. protocol shape) | PASS |
| VII. Local-First, Isolated Integrations | No external service dependency in this feature; `notify()` only writes an outbox row — delivery (WhatsApp, etc.) is 053's separately hosted concern | PASS |
| VIII. AI Is Optional and Assistive | Not applicable — this feature has no AI surface | N/A |
| IX. Arabic-First, Task-Oriented UX | App shell ships `dir="rtl" lang="ar"`, an Arabic font, Tailwind logical properties only, and a permission-filtered "My queue" placeholder | PASS |

No violations requiring Complexity Tracking. Gate: **PASS**.

**Post-Phase-1 re-check**: Reviewed against the finished [data-model.md](./data-model.md) and
[contracts/](./contracts/). The pricing-gate design (research.md §3) was the one place at risk of
violating principle II/VI by hardcoding policy into the core state machine; resolving it as an
open edge plus a guard hook keeps both edges data-driven and policy-free here. No new violations
introduced by the data model or contracts. Gate: **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/002-core-domain-shell/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — the frozen contract with Fady
│   ├── workflow.md
│   ├── orders.md
│   ├── storage.md
│   ├── notifications.md
│   └── errors.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Single Next.js (T3 stack) project — existing scaffold, extended by this feature

prisma/
└── schema/                    # NEW: split from the single schema.prisma (constitution VI/VII refactor)
    ├── schema.prisma          # generator + datasource only
    ├── core.prisma            # Department, Customer, Order, WorkItem, WorkItemTransition,
    │                          # PhaseTiming, NotificationEvent, AuditEvent
    └── identity.prisma        # existing Better Auth models (User/Session/Account/Verification),
                                # moved as-is; owned in practice by 001 going forward
                                # (Post model removed — T3 sample, not part of the domain)

src/
├── app/
│   ├── layout.tsx              # UPDATED: dir="rtl" lang="ar", Arabic font, shadcn/ui provider
│   └── (shell)/
│       ├── layout.tsx          # sidebar shell, permission-filtered nav
│       └── my-queue/
│           └── page.tsx        # placeholder landing page
├── server/
│   ├── db.ts                   # existing Prisma client singleton
│   ├── auth/                   # thin wrapper around 001's getActor/authorize — stubbed here,
│   │                            # implemented by 001; this feature only defines the call shape
│   └── core/                   # THIS FEATURE's domain module — the "shared skeleton"
│       ├── errors.ts           # typed error model (UNAUTHENTICATED | FORBIDDEN | ...)
│       ├── workflow/
│       │   ├── states.ts       # the 15 WorkItemState values
│       │   ├── edges.ts        # the allowed-edges table (data-model.md is the source of truth)
│       │   ├── guards.ts       # registerGuard() + the in-memory guard registry
│       │   └── transition.ts   # transitionWorkItem()
│       ├── orders/
│       │   └── deriveOrderStatus.ts
│       ├── storage/
│       │   ├── adapter.ts      # StorageAdapter interface
│       │   └── local-disk.ts   # dev-only implementation
│       └── notifications/
│           └── notify.ts       # writes to the NotificationEvent outbox table
├── styles/
│   └── globals.css             # UPDATED: logical-property utility check, Arabic font import
└── env.js                      # existing T3 env validation, extended for new config (STORAGE_ROOT)

tests/
├── unit/                       # deriveOrderStatus, edge-table lookups, guard registry
├── integration/                # transitionWorkItem against the test DB (transaction/rollback,
│                                # atomicity, forbidden-edge table-driven test)
└── factories/                  # Customer/Order/WorkItem test data builders

.github/workflows/
└── ci.yml                      # NEW: pnpm check + pnpm test on every PR

prisma/seed.ts                  # NEW: dev seed (admin user, departments, sample customers/orders)
```

**Structure Decision**: Single Next.js project (existing T3 scaffold) — there is no
frontend/backend split to model. This feature's own code lives entirely under `src/server/core/`
(the domain module Track A and Track B both import) plus the app shell under `src/app/`. Each
downstream feature gets its own subtree under `src/server/<feature>` and imports from
`src/server/core` rather than reaching into another feature's folder; that boundary is exactly
what `contracts/` documents and freezes.

## Architecture & Design Patterns

This section is the technical design a senior engineer would want before touching code: the
architectural style, the concrete patterns used and *why*, the public type surface, and the
performance/scalability/type-safety mechanisms — not full method bodies (that's `tasks.md` +
implementation), but real interfaces and class shapes, not prose.

### 5.1 Architectural style: Hexagonal core, thin framework shell

`src/server/core/` is a **framework-agnostic domain layer** (ports & adapters / hexagonal
architecture): it imports `@prisma/client`'s generated types and Node's `stream`, and nothing
else framework-specific — no `next/server`, no React. Next.js Server Actions are a thin
**adapter layer** (`src/app/**/actions.ts`, built in downstream features) that authenticates,
authorizes, validates with Zod, calls into `core`, and maps the result to `ActionResult<T>`. This
buys two concrete things: (1) `core` is unit-testable with plain Vitest, no Next.js test harness;
(2) if the project ever needs a CLI admin tool or a background worker, it calls the same `core`
functions the web app does, with zero duplication.

```text
┌─────────────────────────────────────────────┐
│ src/app/**  (Server Actions — adapter layer) │  ← auth, Zod validation, ActionResult mapping
├─────────────────────────────────────────────┤
│ src/server/core/**  (domain layer — this PR) │  ← pure logic + Prisma calls, zero React/Next
├─────────────────────────────────────────────┤
│ Prisma Client / PostgreSQL                   │  ← persistence
└─────────────────────────────────────────────┘
```

Dependency direction is enforced by an ESLint boundary rule (`eslint-plugin-boundaries` or a
custom `no-restricted-imports` pattern), not just convention: `src/server/core/**` MUST NOT import
from `src/app/**` or from any other feature's `src/server/<feature>/**`. Violating this fails
`pnpm check`, so the contract in `contracts/` is the *only* legal way two features talk to each
other — this is what makes SC-005 (a second engineer integrates via the contract alone) checkable
by CI, not just by code review discipline.

### 5.2 Design patterns applied

| Pattern | Where | Why this pattern, specifically |
|---|---|---|
| **Finite State Machine (State pattern, table-driven)** | `workflow/edges.ts`, `workflow/transition.ts` | The 15 states + fixed edges (data-model.md) are a closed, well-known protocol — a table-driven FSM makes every legal transition enumerable and the 15×15 test exhaustive, and adding a state is a one-line, reviewable diff instead of an `if`-chain change buried in business logic. |
| **Strategy + Chain of Responsibility (guard registry)** | `workflow/guards.ts` | Each guard is an interchangeable strategy (`GuardFn`) run in a chain that short-circuits on first failure — lets 051/024–028 inject policy without `core` knowing they exist (open/closed principle: `transitionWorkItem` is closed for modification, open for extension via `registerGuard`). |
| **Result/Either (no exceptions across the module boundary)** | `errors.ts`, every `core` function's return type | Every fallible `core` operation returns `Result<T, DomainError>` instead of throwing. Callers (Server Actions) are forced by the type system to handle failure before touching `.value` — this is what makes FR-012's typed error model a compile-time guarantee, not a documentation promise. |
| **Adapter (Ports & Adapters)** | `storage/adapter.ts` (`StorageAdapter` port) + `storage/local-disk.ts` (adapter) | `core` depends on the `StorageAdapter` *interface*, never on `fs` directly, so 050 swaps in an S3-compatible adapter with a one-line change at the composition root and zero changes to any caller (constitution IV). |
| **Outbox** | `notifications/notify.ts` + `NotificationEvent` table | Guarantees "recorded" and "delivered" are decoupled and neither is lost if the other's infrastructure is down (constitution VII) — the classic distributed-systems answer to "how do I not lose an event when the transaction that caused it commits but the delivery channel is unavailable." |
| **Registry (module-scope singleton, DI-friendly)** | `workflow/guards.ts`'s in-memory `Map<WorkItemState, GuardFn[]>` | Simplest correct answer for a single-process Next.js server (research.md §4); wrapped behind `registerGuard`/`runGuards` functions, not a raw exported mutable array, so it's replaceable with a real DI container later without touching call sites. |
| **Pure function core / Functional core, imperative shell** | `orders/deriveOrderStatus.ts` | Zero I/O, referentially transparent, trivially fuzz-testable across all 6-bucket combinations (SC-003) — the "imperative shell" (the query layer that fetches Work Items) stays a thin, untested-by-necessity wrapper around a thoroughly-tested pure core. |
| **Test Data Builder (Factory)** | `tests/factories/*.ts` | Fluent builders (`aCustomer().cashCustomer().build()`) over hand-rolled object literals in every test — keeps the 15×15 table-driven test and rollback test readable as the schema grows. |
| **Branded (nominal) types** | `core/ids.ts` | `CustomerId`, `OrderId`, `WorkItemId` are `string & { readonly __brand: "OrderId" }`, not raw `string` — the compiler rejects `transitionWorkItem({ workItemId: someCustomerId, ... })` at the call site instead of failing at runtime against Postgres. |

### 5.3 Core public types (the actual contract, in TypeScript)

These are the literal type declarations `contracts/*.md` describe in prose — reproduced here as
the design artifact implementers copy from. Full bodies are `tasks.md` T014/T020/T022/etc.

```ts
// src/server/core/ids.ts — branded IDs (nominal typing over Prisma's plain `string` PKs)
type Brand<T, B extends string> = T & { readonly __brand: B };
export type CustomerId  = Brand<string, "CustomerId">;
export type OrderId     = Brand<string, "OrderId">;
export type WorkItemId  = Brand<string, "WorkItemId">;
export type UserId      = Brand<string, "UserId">;

// src/server/core/result.ts — Result/Either, no `core` function ever throws a DomainError
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// src/server/core/errors.ts
export type ErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_TRANSITION" | "GUARD_FAILED" | "VALIDATION";

export interface DomainError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

// src/server/core/workflow/states.ts — literal union, not a plain `enum`
// (a `const` object + `as const` keeps this tree-shakeable and gives exhaustive
// `switch` checking via `never`, which TypeScript `enum` does not)
export const WORK_ITEM_STATES = [
  "NEW", "ASSIGNED", "IN_DESIGN", "DESIGN_COMPLETED", "WAITING_REVIEW", "REWORK_REQUIRED",
  "APPROVED", "WAITING_PRICING", "READY_FOR_PRODUCTION", "IN_PRODUCTION",
  "PRODUCTION_COMPLETED", "READY_FOR_COLLECTION", "DELIVERED", "COMPLETED", "CANCELLED",
] as const;
export type WorkItemState = (typeof WORK_ITEM_STATES)[number];

// src/server/core/workflow/edges.ts
export const ALLOWED_EDGES: Readonly<Record<WorkItemState, readonly WorkItemState[]>> = {
  NEW: ["ASSIGNED", "READY_FOR_PRODUCTION", "CANCELLED"],
  // …full table per data-model.md, one literal array per state, checked by the 15×15 test
} as const;

// src/server/core/workflow/guards.ts — Strategy + Chain of Responsibility
export interface GuardContext {
  readonly workItem: WorkItemSnapshot;      // read-only projection, not a live Prisma entity
  readonly actor: Actor;
  readonly reason?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}
export type GuardResult = Result<true, { code: string; message: string }>;
export type GuardFn = (ctx: GuardContext) => Promise<GuardResult>;

export interface GuardRegistry {
  register(match: { from?: WorkItemState; to: WorkItemState }, guard: GuardFn): void;
  run(from: WorkItemState, to: WorkItemState, ctx: GuardContext): Promise<GuardResult>;
}

// src/server/core/workflow/transition.ts
export interface TransitionInput {
  readonly workItemId: WorkItemId;
  readonly to: WorkItemState;
  readonly actor: Actor;
  readonly reason?: string;
  readonly rejectionCategory?: RejectionCategory;
  readonly meta?: Readonly<Record<string, unknown>>;
}
export type TransitionWorkItem = (
  tx: Prisma.TransactionClient,
  input: TransitionInput,
) => Promise<Result<WorkItemSnapshot, DomainError>>;

// src/server/core/storage/adapter.ts — Port (Adapter pattern)
export interface StorageAdapter {
  put(key: string, body: NodeJS.ReadableStream): Promise<{ size: number; sha256: string }>;
  get(key: string): Promise<NodeJS.ReadableStream>;
  exists(key: string): Promise<boolean>;
}

// src/server/core/orders/deriveOrderStatus.ts — pure function, no `tx`, no `async`
export type OrderStatusBucket =
  | "NOT_STARTED" | "IN_PRODUCTION" | "PARTIALLY_READY" | "DELIVERED" | "COMPLETED" | "CANCELLED";
export type DeriveOrderStatus = (
  workItems: readonly Readonly<Pick<WorkItemSnapshot, "state">>[],
) => OrderStatusBucket;
```

`Result<T, DomainError>` is `core`'s *internal* return type — distinct from, but mapped 1:1 at the
Server Action boundary into, the `ActionResult<T>` shape `contracts/errors.md` publishes to other
features (`{ ok: true; value }` → `{ ok: true; data }`; `{ ok: false; error }` passes through
unchanged). Keeping two names is deliberate: `core` never imports anything from the action layer,
so it cannot import `ActionResult` either — the adapter layer does the one-line translation.

Every exported function above returns `Result<T, DomainError>` or a plain value — **never**
`Promise<T> | never (throws)`. This is the actual enforcement mechanism behind FR-012, checked by
`pnpm check`'s `noImplicitAny`/`strict` plus an ESLint rule banning `throw` inside
`src/server/core/**`, with one deliberate carve-out: `StorageAdapter` *implementations*
(e.g. `storage/local-disk.ts`) are Ports per §5.2 and reject/throw as their own contract
(`contracts/storage.md`'s "`get` on a missing key rejects"), not as domain logic. The
catch-and-convert-to-`Result` step happens where `core` *calls* the adapter (e.g. inside
`transitionWorkItem` or wherever a caller invokes `put`/`get`/`exists`), not inside the adapter
itself — so the lint rule's scope excludes adapter implementation files, and everything else in
`core` stays exception-free.

### 5.4 Type safety

- **`strict: true` + `noUncheckedIndexedAccess: true`** (already in `tsconfig.json`) means
  `ALLOWED_EDGES[state]` types as possibly-`undefined` — `transitionWorkItem` is forced to handle
  "unknown state" rather than assume the table is total.
- **No bare `enum`.** `WorkItemState` and every other domain enum is a `readonly` string-literal
  union derived from an `as const` array (5.3), so a `switch (state)` with a `default: assertNever(state)`
  helper is a compile error the moment a state is added to `WORK_ITEM_STATES` but a switch
  elsewhere isn't updated — this is the mechanism, not just a convention, behind "every state is
  handled everywhere."
- **Branded IDs** (5.2/5.3) eliminate an entire class of bugs (passing a `CustomerId` where an
  `OrderId` is expected) at compile time; Prisma's generated `string` PKs are branded at the
  `core` boundary via a single cast, not sprinkled through the codebase.
- **Zod is the single source of truth for input shapes.** Server Action input schemas live next to
  the action; `core` function parameter types are `z.infer<typeof Schema>` (or a structural
  subset), so the runtime validator and the compile-time type can never drift apart.
- **`readonly` by default** on every interface field and array in `core`'s public types (5.3) —
  domain objects are treated as immutable snapshots; a transition produces a *new* snapshot, it
  never mutates one in place, which also makes the audit-rollback test (T018) easier to reason
  about (nothing to "undo" in memory, only in the DB transaction).

### 5.5 Performance

- **Indexes** (added in `prisma/schema/core.prisma`, verified in T006): `Order.number` unique
  index (lookup by human-readable order number); composite `WorkItem(orderId, state)` (the
  Order-status derivation and "queue" screens filter by both); `WorkItemTransition(workItemId, at)`
  (history-in-order reads); `PhaseTiming(workItemId, phase, kind)` (duration roll-ups);
  `NotificationEvent(entityType, entityId)` (outbox lookups).
- **No N+1 by construction**: `deriveOrderStatus` takes an already-fetched `WorkItem[]` slice —
  callers fetch an Order's Work Items with one `include`, never one query per Work Item. This is
  enforced by the function signature itself (5.3) — it has no way to lazily fetch more data.
- **O(1) edge lookups**: `ALLOWED_EDGES` is a plain object/`Map` keyed by state, checked once per
  transition — no scanning, no ORM round-trip to validate an edge.
- **Connection pooling**: Prisma's default connection pool is sized via `connection_limit` on
  `DATABASE_URL` for the LAN deployment target (tens of concurrent staff, not public scale, per
  Technical Context Scale/Scope) — no PgBouncer or read replicas justified at V1 (would need its
  own Complexity Tracking entry if a later feature needs it).
- **Optimistic concurrency on `transitionWorkItem`**: the state-update inside the transaction uses
  `updateMany({ where: { id, state: expectedFromState }, data: { state: to } })` and checks
  `count === 1`, not a blind `update` — this is the concrete mechanism resolving the "two
  transitions at once" edge case in spec.md without taking a row lock for the whole request.

### 5.6 Scalability & maintainability

- **Stateless request handling**: no in-process state is read across requests except the guard
  registry, which is populated once at server boot (module import time) and is *read-only*
  thereafter per request — safe under Next.js's multi-instance/serverless deployment models if V1
  ever moves off a single LAN box.
- **Module boundary = deployment boundary**: because `src/server/core/**` has no inbound
  dependency on any feature folder, it could be extracted to a separate package
  (`@printex/core-domain`) later without a rewrite — not planned for V1 (would be premature
  per constitution's Technology constraints), but the layering doesn't foreclose it.
- **Idempotent, additive migrations**: every schema change ships as a new Prisma migration;
  nothing in this feature's design requires a destructive migration later (new states, if ever
  needed, are additive to `WORK_ITEM_STATES` and `ALLOWED_EDGES`).
- **Barrel export as the only public surface**: `src/server/core/index.ts` re-exports exactly the
  functions/types in `contracts/*.md` — anything not re-exported there is a private implementation
  detail, enforced by ESLint's `no-restricted-imports` blocking deep imports like
  `~/server/core/workflow/transition` from outside `core` itself.

## Complexity Tracking

*No Constitution Check violations — table intentionally left empty.*
