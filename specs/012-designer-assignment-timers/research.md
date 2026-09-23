# Research: Designer Assignment & Timers

Phase 0 output. Every "unknown" below was resolved by reading the actual codebase (002's
`src/server/core/**`, 001's `src/server/auth/**`, 011's `src/server/orders/**`), not by guessing —
each decision cites the file it's grounded in.

## 1. Assignment/reassignment permission: reuse `workitem.assign_designer`, no new permission

**Decision**: Gate both `assignDesigner()` (initial) and `assignDesigner()` (reassignment — same
function, different starting state) behind the existing `workitem.assign_designer` Permission key
(`src/server/auth/permissions.ts`).

**Rationale**: This key already exists in 001's fixed 22-key vocabulary and is already seeded onto
`RECEPTION` and `ADMIN_OWNER` (`prisma/seed.ts`'s `ROLE_SEED_DATA`), not `DESIGNER` or
`HEAD_DESIGNER`. The spec's Clarifications session (2026-09-23) resolved "who may reassign" as
"reception, or a head designer if the shop configures it" — constitution VI already makes role →
permission assignment admin-configurable data, not code, so extending `HEAD_DESIGNER`'s seed row
with `workitem.assign_designer` (a one-line `prisma/seed.ts` change, not a schema change) is the
correct mechanism if/when that's wanted. No new `Permission` key is needed.

**Alternatives considered**: Inventing a new `design.manage` permission (rejected — duplicates
`workitem.assign_designer`'s exact purpose; would leave two permission keys doing the same job).
Gating on `design.review` (HEAD_DESIGNER's actual seeded permission) instead (rejected — conflates
"may approve/reject design work" with "may reassign who's doing it," two different responsibilities
per constitution II's Head-Designer-approval gate).

## 2. Timers: reuse 002's `PhaseTiming` primitives directly, no new timer table

**Decision**: `startTimer`/`pauseTimer` call `closeOpenSegment`/`openSegment`
(`src/server/core/workflow/timing.ts`) directly for the `ACTIVE` timeline, and
`calculatePhaseDurationMs` for display. No new Prisma model.

**Rationale**: `PhaseTiming` (`kind: "QUEUE" | "ACTIVE"`), `openSegment`, `closeOpenSegment`, and
`calculatePhaseDurationMs` already exist, fully match FR-009–FR-015's needs, and their own doc
comment states the exact re-derive-from-timestamps guarantee FR-015 requires (constitution III:
"Durations MUST be computed from persisted timestamps... so timers survive refreshes and
restarts"). Re-implementing this would violate "reuse over reinvention" (011's plan.md §5.2) and
constitution I ("Features MUST NOT invent parallel workflows").

**Gap found**: `openSegment`/`closeOpenSegment`/`calculatePhaseDurationMs` are not currently
re-exported from `src/server/core/index.ts`'s public barrel (only `notify`, `transitionWorkItem`,
`deriveOrderStatus`, etc. are). This feature's Foundational phase must add those three exports (and
`PhaseTimingKind`/`PhaseTimingSegment` types) to the barrel — a small, additive change to an
existing file, not new logic.

**Alternatives considered**: A dedicated `DesignTimer` table with `status: RUNNING | PAUSED`
(rejected — exactly the "in-memory-ish accumulator" constitution III explicitly warns against;
`PhaseTiming`'s segment model already gives the same answer without extra state to keep in sync).

**Addendum — `QUEUE` segments are already fully automatic**: `transitionWorkItem`'s own step 5
(`src/server/core/workflow/transition.ts`) closes the outgoing phase's open `QUEUE` (and `ACTIVE`)
segment and opens a fresh `QUEUE` segment for the destination phase on *every* transition,
unconditionally — this predates 012 and needs no change. Consequence: `startTimer`'s
`transitionWorkItem(tx, { to: "IN_DESIGN" })` call alone already closes the `ASSIGNED`- or
`REWORK_REQUIRED`-phase `QUEUE` segment that IS the Work Item's queue time (FR-014); this feature
must NOT also call `closeOpenSegment(tx, { kind: "QUEUE" })` itself before that call — doing so
would be redundant at best and, since `closeOpenSegment` is a no-op on an already-closed segment,
harmless but confusing to a future reader. `startTimer` only ever needs to add its own `openSegment`
call for the `ACTIVE` timeline (data-model.md's `PhaseDurations`).

## 3. Reassignment does not go through `transitionWorkItem`

**Decision**: When reassigning a Work Item that keeps the same `state` (e.g., `IN_DESIGN` stays
`IN_DESIGN`, only `assigneeId` changes), write `WorkItem.assigneeId` directly inside the
transaction and record an `audit.record` event — do not call `transitionWorkItem`.

**Rationale**: `transitionWorkItem`'s `TransitionInput` (`src/server/core/workflow/transition.ts`)
has no `assigneeId` field, and `ALLOWED_EDGES` (`src/server/core/workflow/edges.ts`) has no
self-loop edges (e.g., `IN_DESIGN → IN_DESIGN`) — a same-state reassignment isn't a workflow edge
at all, it's an ownership change. This exactly mirrors how 011's `changeOrderPriority`
(`src/server/orders/cancelOrder.ts`) changes `Order.priority` via a direct `tx.order.update` +
`audit.record`, not through `transitionWorkItem`, because priority isn't a `WorkItem.state` either.
**Initial** assignment (`NEW → ASSIGNED`, no prior assignee) IS a real state transition and DOES go
through `transitionWorkItem`, with `assigneeId` set in the same `tx.workItem.update` immediately
before/after it (both writes share the transaction, so they commit or roll back together —
constitution V).

**Alternatives considered**: Extending `TransitionInput` with an optional `assigneeId` field
(rejected without discussion with the 002 owner — `transitionWorkItem` is a frozen, heavily
contract-tested shared function; broadening its contract for one caller's convenience is exactly
the kind of scope creep constitution V's "single, centralized transition function" warns against,
and it isn't necessary since reassignment-with-no-state-change needs no transition at all).

## 4. Design Version storage: new metadata model on top of 002's `StorageAdapter` port

**Decision**: Define a new `DesignVersion` Prisma model (this feature's own, in `core.prisma`
alongside `WorkItem`) storing metadata (version number, uploader, note, checksum, size, timestamp,
an opaque `storageKey`); actual bytes go through the already-existing `StorageAdapter` port
(`src/server/core/storage/adapter.ts`, implemented today by `LocalDiskStorageAdapter`).

**Rationale**: 002 already built the low-level byte-storage port constitution IV requires
("Binary content MUST go through a storage abstraction... with metadata in the database"), but no
feature has yet built the metadata table — that's nominally 050's job, which is unbuilt. Building a
small, versioned metadata table now (rather than a throwaway stub) is the correct amount of work:
it satisfies constitution IV completely for this feature's own need, and its shape (version number,
checksum, uploader, note, immutable — never overwritten) is intentionally generic enough that 050
can either reuse this exact table for other file categories or migrate this feature onto its own
shared table later without a data-loss migration (same category of forward-compatibility 011 used
for the not-yet-existing `Customer.phone` field).

**Alternatives considered**: Blocking this feature on 050 shipping first (rejected — 050 isn't
scheduled before 012 in the roadmap, and PRI-9 explicitly lists "Upload design version" as in
scope). Storing the file as a plain unversioned column on `WorkItem` (rejected — directly violates
constitution IV's "immutable, private versions").

## 5. "Mark design complete" is two chained `transitionWorkItem` calls, not one

**Decision**: `markDesignComplete()` calls `transitionWorkItem(tx, { to: "DESIGN_COMPLETED" })`
then immediately `transitionWorkItem(tx, { to: workItem.requiresReview ? "WAITING_REVIEW" :
"APPROVED" })`, both inside the same `db.$transaction`.

**Rationale**: `ALLOWED_EDGES` (`src/server/core/workflow/edges.ts`) only allows `IN_DESIGN →
DESIGN_COMPLETED` directly; `DESIGN_COMPLETED → WAITING_REVIEW` and `DESIGN_COMPLETED → APPROVED`
are separate, subsequent edges. There is no single `IN_DESIGN → WAITING_REVIEW` edge. Chaining two
`transitionWorkItem` calls in one `tx` is the only way to reach the spec's FR-018 outcome without
modifying the shared `ALLOWED_EDGES` table (which 002 owns and which every other feature also
depends on staying stable).

**Alternatives considered**: Adding a direct `IN_DESIGN → WAITING_REVIEW`/`IN_DESIGN → APPROVED`
edge to skip the intermediate state (rejected — `DESIGN_COMPLETED` is a real, meaningful state
other features may read; removing it as an observable state would be a breaking change to 002's
shared edge table, out of scope for this feature to make unilaterally).

## 6. Eligible-designer list and "lightest" suggestion: plain query, no new caching layer

**Decision**: `getEligibleDesigners()` queries active `User`s holding `design.work` (via
`UserRole`/`RolePermission`, same join shape `getActor()` already uses), then for each, counts
non-terminal assigned `WorkItem`s (`state NOT IN (DELIVERED, COMPLETED, CANCELLED)`) and past
completed `WorkItem`s for the target Work Item's `Order.customerId`. No caching, no background job.

**Rationale**: Matches 011's plan.md §5.5 performance approach (single indexed queries, no N+1) and
the shop's V1 scale (tens of staff, not thousands) — a live COUNT query per eligible designer on
dialog open is well within budget, and per constitution VIII, the suggestion is advisory only
(never authoritative), so staleness-by-milliseconds is not a correctness concern.

**Alternatives considered**: Precomputing/caching workload on `User` (rejected — premature
optimization at this scale, and a cached counter is exactly the kind of "in-memory accumulator"
this codebase's timer design already rejects for a stronger reason: correctness over convenience).

