# Phase 0 Research: Production Workflow

## §1. Reuse `PhaseTiming` unmodified for production timing, no new model

**Decision**: Production phase timing uses 002's existing `PhaseTiming` model directly, with
`phase = "IN_PRODUCTION"`, exactly the way 012 uses it for `phase = "IN_DESIGN"`.

**Rationale**: `PhaseTiming` is already generic over `(workItemId, phase, kind)` with no
design-specific fields — it was built to be reused by later phases. Adding a parallel
`ProductionTiming` model would duplicate the derived-duration logic 012 already wrote and tested,
violating the "modules composed, not reinvented" precedent 013 also followed for `Return`.

**Alternatives considered**: A dedicated `ProductionPhaseTiming` model — rejected as pure
duplication with no behavioral difference.

## §2. `IN_PRODUCTION → REWORK_REQUIRED` is a genuinely new edge

**Decision**: Add `REWORK_REQUIRED` to `IN_PRODUCTION`'s allowed-edges list in
`src/server/core/workflow/edges.ts`, the only schema-adjacent change this feature makes to core's
workflow tables (alongside the Prisma diff in data-model.md).

**Rationale**: `ALLOWED_EDGES` today only reaches `REWORK_REQUIRED` from `WAITING_REVIEW` (013's
own path). US5 (operator sends a production-blocking Work Item back to design) has no existing
edge to travel on — `transitionWorkItem` would reject it as `NOT_ALLOWED`. This is additive to a
shared, data-driven table (the same file 013 read but didn't need to change, since its own edge
already existed); no other feature's edges are touched.

**Alternatives considered**: Routing production send-backs through a different landing state (e.g.
straight to `ASSIGNED`) — rejected because it would desynchronize production-originated rework
from design-originated rework, breaking the "one consistent rework history" goal spec.md's US5
states explicitly.

## §3. `createReturn` reused with `originDepartmentId` = the operator's own department

**Decision**: `sendBackToDesign()` calls 013's existing `createReturn(actor, workItemId, {
category: "PRODUCTION_ISSUE", originDepartmentId: <operator's department>, ... })` directly — no
new Return-like model, no Production-specific rejection type.

**Rationale**: 013's `createReturn` was explicitly built generic for this reuse (013's own plan.md
says so verbatim: "reusable later by 014/051"); `RejectionCategory` already includes
`PRODUCTION_ISSUE`. This is exactly the "no Review-specific fields blocking a non-design-review
caller" contract 013's US6 verified.

**Alternatives considered**: A separate `ProductionReturn` model — rejected, defeats the entire
point of 013 building a generic mechanism.

## §4. Revised-file acknowledgment as a plain field, not a `registerGuard`

**Decision**: Add `WorkItem.pendingFileRevisionAt DateTime?` — set when a newer `DesignVersion` is
approved while the Work Item is `IN_PRODUCTION`, cleared to `null` when the operator acknowledges
it. `resumeProduction()` checks this field directly and refuses to resume (a plain domain error,
not a `WorkItemTransitionError`) while it is non-null.

**Rationale**: `registerGuard` (002/013's mechanism) hooks into `transitionWorkItem`'s state
transitions. Resuming a paused timer is not a state transition — the Work Item stays
`IN_PRODUCTION` throughout start/pause/resume — so there is no transition for a guard to attach
to. A plain precondition check inside the production module's own function is the correct-shaped
tool, matching how 011/012 already gate non-transition actions (e.g. `PAST_EDIT_WINDOW`) with a
`DomainXError` thrown from the function itself rather than a guard.

**Alternatives considered**: Modeling "resume" as its own `IN_PRODUCTION → IN_PRODUCTION` self-edge
so a guard could attach — rejected as an artificial workflow-edge just to reuse a mechanism that
doesn't fit; adds edge-table complexity for no real behavioral gain over a direct field check.

## §5. Vendor steps as one new model, not two

**Decision**: One `VendorProductionRecord` model per Work Item's external-production cycle, with
`vendorName`, `sentAt` (required), and `receivedAt` (nullable until the receive step happens) —
not two separate "sent" and "received" event rows.

**Rationale**: The two steps are properties of the same production cycle (spec.md US6's
Independent Test reads "record... then a 'received from vendor' step"), and completion's gate
check (FR-012) needs a single row to test `receivedAt IS NOT NULL` against, not an aggregate query
over a two-row event log. This is the smaller, more directly query-able shape for a gate this
feature actually needs.

**Alternatives considered**: A generic `WorkItemEvent` log — rejected as unnecessary generality;
nothing else in this feature needs an event-log abstraction.

## §6. Queue ordering — same urgent-first, oldest-first rule as 012/013

**Decision**: `getOperatorQueue` sorts urgent-first, then oldest-`enteredQueueAt`-first within each
bucket, deriving `enteredQueueAt` from the most recent `WorkItemTransition` landing in
`READY_FOR_PRODUCTION` (the state a Work Item is in immediately before an operator starts its
timer) — the same comparator 012's `getMyQueue` and 013's `getReviewQueue` both already use,
duplicated here per plan.md's "Structure Decision" (modules composed over shared, prematurely-
abstracted infrastructure).

**Rationale**: Consistency with the two existing queue implementations this project already has;
no new sorting concept to design or review.

**Alternatives considered**: Sorting by `IN_PRODUCTION` entry time instead — rejected; the queue
by definition (spec.md US1) is showing Work Items *waiting* to start, so the relevant age is how
long they've been `READY_FOR_PRODUCTION`, not a timestamp that doesn't exist yet for queued items.

## §7. Multi-department membership — union across an operator's departments

**Decision**: `getOperatorQueue` filters `WHERE departmentId IN (actor.departmentIds)`, returning
the union across every department the operator belongs to, sorted as one combined list (spec.md's
Edge Cases section already documents this — not grouped/re-sorted per department).

**Rationale**: `actor.departmentIds` (001) already models multi-department membership as an array;
no new membership concept needed, matches 012's identical pattern for designer department scoping.

**Alternatives considered**: none — this is simply reading the existing `Actor.departmentIds`
array, no design choice beyond confirming the field already supports it.
