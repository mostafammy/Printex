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

## Complexity Tracking

*No Constitution Check violations — table intentionally left empty.*
