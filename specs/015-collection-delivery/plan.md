# Implementation Plan: Collection, Discrepancies & Delivery

**Branch**: `015-collection-delivery` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-collection-delivery/spec.md`

## Summary

Adds a new `src/server/collection/**` module (barrel `~/server/collection`) that owns the last mile
of the Work Item lifecycle, `PRODUCTION_COMPLETED → READY_FOR_COLLECTION → DELIVERED → COMPLETED`
— all three edges already exist in `src/server/core/workflow/edges.ts`, so **no edge-table change
is needed**. Print Reception/Delivery staff get an order-grouped collection queue, a receive screen
whose four counts (accepted + damaged + missing + waste = expected) are validated server-side and
backed by a DB `CHECK` constraint, append-only receipt revisions, classified discrepancies, and
resolutions (Reprint · Replacement in next order · Credit · Price adjustment · Customer accepts
shortage · Other). A Reprint creates a linked Work Item in the same Order and pushes it
`NEW → READY_FOR_PRODUCTION` (existing edge) into 014's production queue, reusing the original's
approved file through a small lineage fallback in 014's `getJobCard`.

The pricing-before-delivery gate (constitution II, PRD §22/§55 Rule 10) is a guard registered via
002's existing `registerGuard({ from: "READY_FOR_COLLECTION", to: "DELIVERED" }, …)`; the pricing
*decision* is delegated to a consumer-owned `PricingGatePort` that 051 implements. Until 051 binds
it, the default adapter fails closed. The guard's failure (`GUARD_FAILED` with
`details.guardCode = "PRICING_UNRESOLVED"`) is mapped to the public error code
`PRICING_UNRESOLVED`. Financial closure (`DELIVERED → COMPLETED`) is likewise guarded and reads
052's order summary through a consumer-owned `FinanceSummaryPort`. Customer "ready for collection"
messages are recorded in 002's existing `NotificationEvent` outbox via `notify()` for 054 to
deliver — no new outbound mechanism.

Cross-cutting concerns (Zod validation, `authorize()`, `db.$transaction`, mandatory
`audit.record`, `transitionWorkItem` error translation, domain-error → discriminated-union mapping)
are applied once by the **shared** `defineCommand`/`defineQuery` aspect layer. Its generic engine is in
`src/server/core/aspects/`, it is bound once in `src/server/aspects.ts`, and each module binds its own error
union in `src/server/collection/aspect.ts`. The canonical definition is
[contracts/aspects.md](./contracts/aspects.md), which 016 also uses (research.md §1). This replaces the
copy-pasting into every function that 011–014 do today. Whichever of 015 and 016 is implemented first creates
the layer, and the other reuses it.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 (matches CI)

**Primary Dependencies**: Next.js 15 (App Router, RSC + Server Actions — the project has **no
tRPC**; server entry points are Server Actions calling barrel functions, as in 011–014), Prisma ORM
6 (PostgreSQL, multi-file schema under `prisma/schema/`), Zod 3, Tailwind CSS (RTL logical
properties), Better Auth session via 001's `getActor()`

**Storage**: PostgreSQL via `prisma/schema/core.prisma` (the brief's `prisma/schema.prisma` is only
the generator/datasource root — models live in `prisma/schema/*.prisma`). New models:
`ProductionReceipt`, `Discrepancy`, `DiscrepancyCause`, `Compensation`, `Delivery`,
`DeliveryLine`, `CollectionPolicy`; new enums `DiscrepancyType`, `CompensationKind`; new
`WorkItem.reprintOfWorkItemId` self-relation and `@@index([state])`. DB-level `CHECK` constraints
and `REVOKE UPDATE, DELETE` for the append-only tables ship as
`prisma/manual-sql/collection-integrity.sql` (same mechanism as 001's
`audit-event-append-only.sql`). Attachment bytes are **not** stored by this feature — they go
through 050's attachments service behind `DiscrepancyAttachmentPort` (research.md §3).

**Testing**: Vitest — unit tests for pure logic (`quantities.ts`, `readiness.ts`, `closure.ts`
predicate, aspect error mapping), contract tests (`tests/contract/collection/**`) for every entry
point's permission, the two guards called through `transitionWorkItem` directly, and default-port
fail-closed behavior; integration tests against the real Postgres test DB
(`tests/helpers/testDb.ts`, `tests/helpers/seed.ts`) for every user story. Server-path tests for
every gate, forbidden transition and permission (constitution "Development Workflow & Quality
Gates").

**Target Platform**: Server-rendered web app, local LAN deployment (constitution VII)

**Project Type**: Web application (single Next.js project, matching 001/002/010–014)

**Performance Goals**: SC-001 (receive one Work Item in < 60 s end-to-end). Queue page = 3 fixed
queries regardless of page size (one ordered/paginated `$queryRaw` for Order IDs, one `count`,
one `findMany … include`), no per-row query (research.md §6). Delivery sheet = 1 order load + 1
batched pricing-port call + 1 finance-port call + 1 `groupBy` for open-discrepancy quantities.

**Constraints**: Arabic-first RTL UI (constitution IX). Every state change goes through
`transitionWorkItem` (constitution V) — this module never writes `WorkItem.state`. A transition and
its audit event commit in the same `tx`. Order-level decisions (grouped readiness, delivery,
closure, reprint) take a row lock on the Order (`SELECT … FOR UPDATE`) inside the command's
transaction so concurrent receipts on sibling Work Items cannot miss or duplicate the readiness
notification (research.md §7). Guards receive no `tx` (002 `GuardContext` has none), so closure is
evaluated **after** the triggering transaction commits (research.md §5).

**Scale/Scope**: Single print shop, hundreds of Work Items/day; queues paginated (default 25,
max 100 Orders per page); discrepancy facts for 090 keyset-paginated (max 200 rows per page).

**Cross-feature dependency note**: 051 (pricing), 052 (finance), 050 (files/attachments) and 054
(WhatsApp) are **not built**. This feature defines narrow consumer-owned ports for 051/052/050 with
safe default adapters (research.md §3) and uses the existing 002 outbox for 054. The port shapes
are cross-team contracts with the Track B owner (Fady) — see "Cross-team contracts" below.
Feature numbering note: 002's docs still say "024–028 pricing / 050 production / 051 delivery gate /
053 notifications"; this plan uses the current map (050 files, 051 pricing, 052 finance, 053
internal notifications, 054 WhatsApp, 090 dashboard).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design in "Post-Design
Constitution Check" below.*

| Principle | Check | Result |
|---|---|---|
| I. Order → Work Item Is the Canonical Model | Receipts, discrepancies, compensations and delivery lines all hang off an existing Work Item; a hand-over hangs off its Order. A reprint is a new Work Item **in the same Order** (no parallel object). Readiness is derived from Work Item states + existing `Order.mode`, never stored. Grouped/separate share one workflow — mode only changes the readiness predicate and the partial-delivery reason rule | PASS |
| II. Business Gates Are Inviolable | Pricing gate is a `registerGuard` on `READY_FOR_COLLECTION → DELIVERED` inside `transitionWorkItem`, so no caller can skip it; fails closed until 051 binds its port; urgent is never consulted by the guard; closure is a second guard on `DELIVERED → COMPLETED`. Monetary compensations require `admin.override` + reason | PASS |
| III. History Is Append-Only | Receipts are revisioned (`@@unique([workItemId, revision])`), never updated; discrepancies, compensations, deliveries, delivery lines have no update/delete path and DB-level `REVOKE UPDATE, DELETE`; every command must emit ≥1 `audit.record` in its `tx` (enforced by the `defineCommand` aspect); durations derive from existing `PhaseTiming` | PASS |
| IV. Files Are Immutable, Private Versions | Discrepancy attachments go through 050's `attachments.attach` (port); no bytes, paths or public URLs handled here. Reprints **reference** the original's approved `DesignVersion` via lineage — nothing copied or overwritten | PASS |
| V. The Server Is the Only Authority | Every barrel function validates with Zod and calls `authorize()` via the aspect before touching data; count invariant enforced in Zod, in the service, and by a DB `CHECK`; delivered quantity is server-derived, never client-supplied; state changes only via `transitionWorkItem` | PASS |
| VI. Configuration Over Hard-Coding | Discrepancy causes are an Admin-managed table; major-discrepancy % and notification recipient roles live in `CollectionPolicy`; permissions are 001's existing keys (no role-name checks). Discrepancy *types* and compensation *kinds* are fixed PRD §20/§21 vocabularies (same stance as `WorkItemState`) | PASS |
| VII. Local-First, Isolated Integrations | No external call. Customer notification is an outbox row (`notify`) that 054 delivers later; an outage of 054 never blocks receipt or delivery | PASS |
| VIII. AI Is Optional and Assistive | No AI surface | PASS (N/A) |
| IX. Arabic-First, Task-Oriented UX | `/delivery` is a two-tab queue ("waiting to receive" / "ready for customer"); receive and hand-over are single screens; pricing refusal names the blocked items and who to ask; Arabic keys in `src/messages/ar.json`, logical Tailwind properties only. The only added step (classifying non-accepted units) is required by PRD §55 Rule 7 | PASS |

No violations — Complexity Tracking table is empty.

## Post-Design Constitution Check

Re-run after research.md, data-model.md and contracts/ were written:

| Principle | Design artifact that satisfies it | Result |
|---|---|---|
| I | data-model.md: every new model has a required `workItemId` or `orderId` FK; `WorkItem.reprintOfWorkItemId` + `Compensation.reprintWorkItemId @unique` link reprint ↔ original ↔ resolution | PASS |
| II | contracts/collection.md "Guards"; research.md §4 (fail-closed default adapter, no urgent branch); tasks T032 and T055 contract tests call `transitionWorkItem` directly | PASS |
| III | data-model.md "Append-only enforcement" (`collection-integrity.sql`); contracts/aspects.md §3.1 (shared aspect asserts ≥1 audit entry per command) | PASS |
| IV | contracts/ports.md `DiscrepancyAttachmentPort` (two-phase stage/commit, 050-owned bytes); research.md §9 (lineage, not copy) | PASS |
| V | contracts/collection.md authorization table; contracts/aspects.md §3.1 (static permission before any I/O, entity check in-tx); data-model.md validation rules + DB `CHECK` | PASS |
| VI | data-model.md `DiscrepancyCause`, `CollectionPolicy` | PASS |
| VII | contracts/ports.md "Outbox events" — notify only | PASS |
| VIII | — | PASS (N/A) |
| IX | quickstart.md scenarios; tasks UI tasks with Arabic keys | PASS |

There are two deliberate deviations from 011–014's style. Neither is a constitution violation:

- Public functions return a discriminated-union `CollectionResult<T>` (`= AspectResult<T, CollectionError>`)
  instead of throwing a `DomainXError`. This is required by the brief's end-to-end type-safety standard and is
  justified in research.md §2. `.inTx` variants still throw so that a caller's transaction rolls back.
- Cross-cutting concerns live in a shared layer, `src/server/core/aspects/` (contracts/aspects.md), rather than
  inline code. The engine is dependency-injected, so core still imports nothing from auth or db (eslint rule (a)
  is unchanged). Rule (c) ("no throw in core") gets one exemption (CONFIRMED by owner 2026-09-24), `src/server/core/aspects/**`, on the same
  grounds as the existing `core/storage/**` exemption: a transaction callback must reject in order to roll
  back. This is tasks.md T004.

## Cross-team contracts (Track B — Fady: 050/051/052/054)

Full shapes in [contracts/ports.md](./contracts/ports.md). Summary of what must be agreed:

1. **051 → `PricingGatePort.getPricingStatus(workItemIds)`** returning per Work Item
   `RESOLVED | NOT_REQUIRED | PENDING{ waitingSince, responsible }`; 051 binds it once at module load
   via `bindPricingGatePort()` exported from `~/server/collection`. 051 MUST report `PENDING` for a
   Work Item while any `PRICE_ADJUSTMENT` compensation on it has not been applied, and MUST treat
   reprint Work Items (`reprintOfWorkItemId != null`) according to an agreed rule (proposal:
   `NOT_REQUIRED` — no charge — unless a pricing user prices it explicitly).
2. **052 → `FinanceSummaryPort.orderSummary(orderId)`** returning `{ total, paid, remaining,
   creditApproved, currency: "EGP" }` (Prisma `Decimal`) or `UNAVAILABLE`; 052 applies `CREDIT`
   compensations to the balance; 052 calls `tryFinancialClosure(actor, orderId)` **after** its
   payment transaction commits.
3. **050 → `DiscrepancyAttachmentPort`** two-phase `stage(stream…)` (before any tx) +
   `commit(tx, staged, { entityType: "Discrepancy", entityId })`, mapping onto 050's
   `attachments.attach`; 050's contract today streams inside `tx`, which 013/012 avoid — ask 050 to
   expose the two-phase form.
4. **054 → outbox event `customer.ready_for_collection`** (payload shape in contracts/ports.md,
   `templateKey: "ORDER_READY_FOR_COLLECTION"`); 054 owns template choice, Meta policy, retries,
   and writes `deliveredAt`/`deliveryStatus` only.
5. **051/052 read-only integration query** `listCompensationsForOrder(orderId)` from
   `~/server/collection` to discover Credit / Price adjustment compensations to apply.
6. **Guard codes** `PRICING_UNRESOLVED` (on `→ DELIVERED`) and `CLOSURE_CONDITIONS_UNMET` (on
   `→ COMPLETED`) are owned by this module's guards; 051 MUST NOT register a second guard on the
   same edges (it plugs in through the port instead).

## Project Structure

### Documentation (this feature)

```text
specs/015-collection-delivery/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── aspects.md       # CANONICAL shared defineCommand/defineQuery layer (src/server/core/aspects/), referenced by 016
│   ├── collection.md    # barrel functions, errors, authorization table, guards
│   └── ports.md         # consumer-owned ports + outbox events (cross-team contracts)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── instrumentation.ts                 # SHARED — create if absent, else add a line. The single boot-time registration
│                                      #   point: await import each module barrel and call its registerXGuards()
│                                      #   (015: registerCollectionGuards; 016: registerChangeGuards). Provider
│                                      #   barrels (051/052/050) are imported here to bind their ports (research.md §4)
├── server/
│   ├── core/
│   │   ├── index.ts                   # EDIT (shared) — + aspects exports (contracts/aspects.md §6), if absent
│   │   └── aspects/                   # SHARED — create if absent (first of 015/016 to implement), else reuse
│   │       ├── types.ts               # AspectBaseError, AspectResult<T,E>, PermissionSpec, AuditEntry, TxScope, CommandCtx, AspectDeps
│   │       ├── engine.ts              # createAspects(deps).forModule<E>() → { defineCommand, defineQuery }
│   │       ├── errors.ts              # AspectDomainError, TransitionFailure, AspectMisuseError, fail, error mapping
│   │       └── transition.ts          # transitionOrThrow (Actor→CoreActor, Result→throw)
│   ├── aspects.ts                     # SHARED — create if absent: createAspects({ db, authorize, audit, … }) bound once
│   ├── collection/                    # NEW — this feature's module (barrel-only import surface)
│   │   ├── index.ts                   # barrel; calls registerCollectionGuards() at import (idempotent)
│   │   ├── aspect.ts                  # aspects.forModule<CollectionError>({ mapGuardFailure }) → defineCommand/defineQuery
│   │   ├── errors.ts                  # CollectionError union, CollectionResult<T>
│   │   ├── lock.ts                    # lockOrder(tx, orderId) — SELECT … FOR UPDATE
│   │   ├── ports/
│   │   │   ├── pricing.ts             # PricingGatePort + fail-closed default + bind
│   │   │   ├── finance.ts             # FinanceSummaryPort + UNAVAILABLE default + bind
│   │   │   └── attachments.ts         # DiscrepancyAttachmentPort + unavailable default + bind
│   │   ├── quantities.ts              # PURE: bucket map, count invariant, classification, revision math, major threshold
│   │   ├── readiness.ts               # PURE: ready-for-customer predicate + flip detection
│   │   ├── closure.ts                 # PURE predicate + evaluateClosure + tryFinancialClosure
│   │   ├── guards.ts                  # registerCollectionGuards(): idempotent; →DELIVERED pricing, →COMPLETED closure
│   │   ├── policy.ts                  # getCollectionPolicy, updateCollectionPolicy
│   │   ├── causes.ts                  # list/create/rename/setActive DiscrepancyCause
│   │   ├── queue.ts                   # getCollectionQueue, getDeliveryQueue
│   │   ├── receive.ts                 # getReceiveSheet, receiveProduction
│   │   ├── discrepancy.ts             # recordDiscrepancy (+ recordDiscrepancyInTx)
│   │   ├── resolution.ts              # resolveDiscrepancy
│   │   ├── reprint.ts                 # createReprintInTx
│   │   ├── notifications.ts           # notifyReadiness, notifyMajorDiscrepancy, notifyMonetaryCompensation
│   │   ├── delivery.ts                # getDeliverySheet, recordDelivery
│   │   └── reports.ts                 # listDiscrepancyFacts (090), getWorkItemLineage, listCompensationsForOrder
│   └── production/
│       └── jobCard.ts                 # EDIT (014, Track A) — approved-file lineage fallback for reprints
├── app/
│   └── (shell)/
│       ├── delivery/
│       │   ├── page.tsx               # two-tab queue (waiting to receive / ready for customer)
│       │   ├── actions.ts             # "use server" actions returning serialized CollectionResult
│       │   ├── _components/           # client forms using useActionState (receive, discrepancy, resolve, deliver)
│       │   ├── receive/[workItemId]/page.tsx
│       │   └── orders/[orderId]/page.tsx   # delivery sheet: items, discrepancies, pricing blockers, balance, closure status
│       └── admin/collection/page.tsx  # CollectionPolicy + DiscrepancyCause admin
└── messages/
    └── ar.json                        # + collection/delivery keys, one per CollectionError code

prisma/
├── schema/core.prisma                 # + models/enums above, WorkItem.reprintOfWorkItemId, WorkItem @@index([state])
├── schema/identity.prisma             # + User back-relations
├── manual-sql/collection-integrity.sql  # CHECK constraints + REVOKE UPDATE, DELETE
└── seed.ts                            # + DiscrepancyCause defaults, CollectionPolicy "default" row

eslint.config.js                       # + no-restricted-imports rule for src/server/collection/**;
                                       #   rule (c) ignores += src/server/core/aspects/** (if absent)

tests/
├── unit/core/aspects.test.ts          # SHARED — create if absent, else extend (contracts/aspects.md §7)
├── unit/collection/{quantities,readiness,closure}.test.ts
├── contract/collection/{permissions,guards,ports,receive,delivery,discrepancy,resolution}.test.ts
└── integration/collection/
    ├── queue.test.ts
    ├── receive.test.ts
    ├── discrepancy.test.ts
    ├── resolution.test.ts
    ├── reprint.test.ts
    ├── readiness.test.ts
    ├── delivery.test.ts
    ├── closure.test.ts
    ├── reports.test.ts
    ├── config.test.ts
    └── audit.test.ts
tests/integration/production/reprintJobCard.test.ts   # 014 lineage fallback
```

**Structure Decision**: Single Next.js project (matching 001/002/010–014). New
`src/server/collection/**` module mirroring `src/server/production/**` (one file per use case,
barrel-only import surface enforced by an `eslint.config.js` `no-restricted-imports` rule identical
in shape to the production rule; `tests/**` exempted). The `ports/` sub-folder and `aspect.ts` are
module-internal. Nothing outside the module imports them except through the barrel
(`bindPricingGatePort`, `bindFinanceSummaryPort`, `bindDiscrepancyAttachmentPort`, the port types,
`registerCollectionGuards`). There are three shared files, each created by whichever of 015 and 016 is
implemented first and reused by the other:

- `src/server/core/aspects/**`, plus its barrel lines
- `src/server/aspects.ts`
- `src/instrumentation.ts`
Exactly one file outside the module is edited for behavior: `src/server/production/jobCard.ts`
(014, same Track A owner) — coordinated like 014's T038.

## Complexity Tracking

*No violations — table intentionally empty.*
