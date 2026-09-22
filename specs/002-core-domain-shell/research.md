# Phase 0 Research: Core Domain & Shell

All Technical Context fields in [plan.md](./plan.md) were resolvable from the constitution, the
PRD, and the existing scaffold — no `NEEDS CLARIFICATION` markers remain. This document records
the engineering decisions made while resolving them and while designing the state machine, so the
reasoning is visible to Fady and to future features that consume these contracts.

## 1. Prisma schema organization

**Decision**: Split the single `prisma/schema.prisma` into `prisma/schema/*.prisma` using
Prisma's multi-file schema support (`prismaSchemaFolder` preview feature on Prisma 6), per PRD/
issue requirement. `schema.prisma` keeps only `generator`/`datasource`; `core.prisma` holds this
feature's models; `identity.prisma` holds the existing Better Auth models moved as-is. The T3
sample `Post` model is deleted.

**Rationale**: Constitution's Track A/B split and the issue brief both call for one file per
module so two engineers can edit schema concurrently without merge conflicts on a single file.
Prisma natively supports this since 6.7; no custom tooling needed.

**Alternatives considered**: Keep one file (rejected — guaranteed merge conflicts as 010/050/etc.
land their own models); split by generating separate Prisma Client instances per module (rejected
— defeats the point of one relational database and one source of truth, contradicts principle I).

## 2. State machine & transition function

**Decision**: The 15 states and their allowed edges are a plain, statically-defined lookup table
(`Record<WorkItemState, WorkItemState[]>`) in `src/server/core/workflow/edges.ts`, checked with an
O(1) lookup inside `transitionWorkItem()`. The full table is finalized in
[data-model.md](./data-model.md), incorporating the two rules fixed in `/speckit-clarify`:
any non-terminal state (all but DELIVERED/COMPLETED/CANCELLED) may go to CANCELLED, and
REWORK_REQUIRED's landing state is chosen by the caller from an allow-listed subset
(`{IN_DESIGN, ASSIGNED}`) based on rejection category, not hardcoded to one edge.

**Rationale**: A static table is the simplest thing that satisfies "any transition not on that
table MUST be rejected" (spec FR-003) and makes the required table-driven 15×15 test trivial to
write. No workflow engine or DSL is justified at this scale (principle: don't introduce complexity
the constitution's Technology section doesn't already sanction).

**Alternatives considered**: A general-purpose state-machine library (e.g. XState) — rejected as
an unjustified new dependency for a fixed, small, well-understood table; encoding transitions as
Prisma-level check constraints — rejected because guards (FR-007) need application-level context
(actor, payload) that SQL constraints can't express.

## 3. Where the pricing gate lives relative to WAITING_PRICING

**Decision**: `APPROVED` has two outgoing edges: `APPROVED → WAITING_PRICING` and
`APPROVED → READY_FOR_PRODUCTION`. This feature does not hardcode which one a given Work Item
takes — that decision belongs to a guard registered by the pricing feature (024–028, Track B)
against the `APPROVED → READY_FOR_PRODUCTION` edge. This feature ships with no guards registered
on that edge, so until 024–028 lands, every Work Item takes the direct edge.

**Rationale**: Constitution II is explicit that "Production MAY proceed while pricing is pending"
and that "pricing status MUST be tracked independently of production status" — so pricing cannot
be a hard blocking predecessor of `READY_FOR_PRODUCTION` in the core state machine. The issue
brief's own guard-registry example ("051 blocks → DELIVERED when unpriced") confirms the intended
enforcement point is the delivery gate, not production entry. Keeping both edges open and
unopinionated here, and letting 024–028/051 register the actual policy as a guard, is exactly what
FR-007 (guard registry) and constitution VI (configuration over hard-coding) are for.

**Alternatives considered**: Hardcode `WAITING_PRICING` as a mandatory stop before
`READY_FOR_PRODUCTION` — rejected, contradicts constitution II directly. Drop `WAITING_PRICING`
from the state machine entirely and track pricing status as a separate field — rejected as an
undocumented deviation from the PRD's explicit 15-state list (§8) without a clarification round to
justify removing a named state.

## 4. Guard registry pattern

**Decision**: `registerGuard({ from?, to }, guard)` appends to an in-process array keyed by
destination state (and optionally source state); `transitionWorkItem()` runs every guard matching
the attempted edge, in registration order, and fails the whole transition on the first `{ ok:
false }` or thrown error. Registration happens at module-import time (each feature's server
module calls `registerGuard` at the top level), so guards are live as soon as the feature's code
is imported by the Next.js server bundle.

**Rationale**: Matches FR-007 exactly ("let other features register guards... without modifying
the core transition function") with the least machinery — no plugin loader, no config file,
just imports. This is a single-process Next.js server, so an in-memory registry is sufficient;
there is no multi-instance coordination problem to solve in V1.

**Alternatives considered**: A database-backed rule table — rejected as over-engineering for
guards that are inherently code (they call other services, e.g. `audit.record`), not data; a
pub/sub event system — rejected, guards must be able to *block* the transition synchronously,
which a fire-and-forget event bus can't do.

## 5. Derived Order status

**Decision**: `deriveOrderStatus(workItems)` is a pure function with no I/O, taking only
`{ state: WorkItemState }[]` and returning one of the six buckets fixed in `/speckit-clarify`
(Not started, In production, Partially ready, Delivered, Completed, Cancelled). It is called on
read (in the Order query layer), never stored, satisfying FR-008.

**Rationale**: Purity makes it trivially unit-testable (SC-003's six-bucket coverage) and
guarantees principle I's "never stored as an independently editable value" by construction — there
is no column to write to.

**Alternatives considered**: A denormalized `Order.status` column updated by a trigger or by
`transitionWorkItem` — rejected, reintroduces exactly the "two sources of truth" failure mode
principle I exists to prevent, and would need its own invalidation logic on every Work Item change.

## 6. Storage adapter

**Decision**: `StorageAdapter` is a three-method interface (`put`, `get`, `exists`) keyed by an
opaque string key, with `local-disk.ts` implementing it under a configurable `STORAGE_ROOT`
directory for development. Keys are generated by callers (this feature does not define a key
scheme — that's 050's concern), and `put` is append-only: writing an existing key is not defined as
an update in this interface's contract, leaving "new version = new key" to whoever calls it.

**Rationale**: Matches FR-010 and keeps the interface exactly as small as 050 needs to build the
real (versioned, checksum-tracked) implementation without this feature guessing at requirements
outside its scope.

**Alternatives considered**: Building versioning into this interface now — rejected as scope creep
into 050 (explicitly out of scope per the issue brief); using a third-party storage abstraction
library — rejected, three methods don't justify a dependency.

## 7. Notification outbox

**Decision**: `notify(tx, event)` writes one row to a `NotificationEvent` table inside the caller's
existing Prisma transaction; it does not itself deliver anything. Table has `type`, `entityType`/
`entityId`, `recipients` (JSON: `userIds?`, `roles?`, `departmentIds?`), `payload` (JSON), 
`createdAt`, and a `deliveredAt`/`deliveryStatus` pair left `null` for 053 to fill in.

**Rationale**: Matches FR-011 and constitution VII ("an integration outage MUST NOT block any core
workflow, and failed outbound actions MUST be queued/retried, not lost") — writing to the same DB
transaction as the triggering event guarantees the notification is never lost even if delivery
infrastructure is down or not yet built.

**Alternatives considered**: An external message queue (e.g. Redis/RabbitMQ) — rejected, adds an
operational dependency principle VII explicitly wants to avoid for the local-first core; calling a
delivery webhook synchronously from `notify()` — rejected, directly violates "failed outbound
actions MUST be queued/retried, not lost" if the webhook is down.

## 8. Typed error model transport

**Decision**: Every Server Action returns a discriminated union
`{ ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }` where
`ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_TRANSITION" | "GUARD_FAILED" |
"VALIDATION"`, rather than throwing. Zod validation failures are caught at the action boundary and
mapped to `VALIDATION`.

**Rationale**: Server Actions crossing the server/client boundary lose stack traces and error
identity on thrown exceptions in Next.js; a plain returned object is what the client can pattern-
match on to show the right UI message, and it's what FR-012 specifies literally.

**Alternatives considered**: Throwing typed error classes and catching them in a Next.js error
boundary — rejected, awkward for Server Actions specifically (the client only sees a generic
"Server Action error" once serialization strips the class); HTTP-status-coded API routes —
rejected, this project uses Server Actions, not a separate REST API, per the existing scaffold.

## 9. Testing strategy

**Decision**: Vitest, added as a new devDependency, running against a second Postgres database
(`DATABASE_URL_TEST`, same instance, separate name) reset via Prisma migrate before each run.
Data factories live in `tests/factories/` and build minimal valid Customer/Order/WorkItem graphs.
The required table-driven test iterates all 15×15 (state, state) pairs against the edges table
from `data-model.md` and asserts allowed pairs succeed and all others throw `INVALID_TRANSITION`.

**Rationale**: Matches FR-015, constitution's testing requirements, and SC-001/SC-002's 100%
coverage bars. A real Postgres test database (not an in-memory mock) is required because the
audit-rollback acceptance scenario (User Story 2) depends on real transaction semantics.

**Alternatives considered**: Mocking Prisma — rejected per this project's own past-incident-shaped
preference for hitting a real database in tests, and specifically because the rollback-on-audit-
failure scenario is a transaction-semantics test that a mock cannot faithfully reproduce.

## 10. RTL / Arabic shell

**Decision**: `shadcn/ui` is added and initialized with Tailwind's logical-property utilities
(`ms-*`/`me-*`/`ps-*`/`pe-*`); `src/app/layout.tsx` sets `<html dir="rtl" lang="ar">` and loads
IBM Plex Sans Arabic (or Cairo) via `next/font/google`; a `messages/ar.json` file holds shell
strings (no i18n library needed yet since V1 is Arabic-only — a library is added only if/when a
second locale is actually required); an ESLint rule (`eslint-plugin-tailwindcss` config or a
custom rule) flags any `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` Tailwind class to satisfy SC-007.

**Rationale**: Matches FR-013 and constitution IX directly; deferring a full i18n library avoids
an unjustified dependency for a single-locale V1 while still isolating strings in one file for a
future locale.

**Alternatives considered**: `next-intl`/`react-i18next` now — rejected as premature for a
V1 that PRD scope confirms is Arabic-only; hardcoding `dir="rtl"` per-page instead of at the root
`<html>` — rejected, risks a flash of LTR content and per-page drift.

## 11. CI pipeline

**Decision**: A single GitHub Actions workflow (`.github/workflows/ci.yml`) triggered on pull
request, running `pnpm install`, `pnpm check` (lint + typecheck), and `pnpm test` (Vitest against a
Postgres service container) as required status checks on `main`.

**Rationale**: Matches FR-015/SC-006 and the "Development Workflow & Quality Gates" section's
`pnpm check` requirement.

**Alternatives considered**: A separate lint-only and test-only workflow — rejected as
unnecessary split for a project this size; a self-hosted runner — rejected, no such requirement
exists and GitHub-hosted runners are simpler to maintain.
