# Phase 0 Research: Head Designer Review & Rework Loop

## §1. Rework counter — derived count, not a stored field

**Decision**: `getReviewQueue`/any Work Item summary computes the rework count as
`count(Return WHERE workItemId = ...)` at read time. No `WorkItem.reworkCount` column.

**Rationale**: A stored/incremented counter can drift from the actual `Return` history under
concurrent writes or a bug, and constitution III already establishes the pattern of deriving
durations from persisted timestamps rather than trusting a mutable accumulator (`PhaseTiming` +
`calculatePhaseDurationMs`, not a stopwatch field). A `Return` row already exists per rejection
(FR-010); counting it is the same append-only-source-of-truth approach applied to a second metric.

**Alternatives considered**: A denormalized `WorkItem.reworkCount` incremented inside the rejection
transaction — rejected because it introduces a second source of truth that could disagree with the
`Return` rows it is supposed to summarize, for a query that is cheap to compute on demand at V1
scale (hundreds of Work Items, single-digit rejections each).

## §2. Approval marks the `DesignVersion` row directly, no separate outcome table

**Decision**: `DesignVersion` (012) gains two nullable columns — `approvedAt: DateTime?`,
`approvedById: String?` — set once by `approveDesign`, never cleared. No separate
`DesignVersionReview` join table.

**Rationale**: 012's `DesignVersion` already has a stable, unique `(workItemId, version)` identity
and is already the thing being reviewed; a version's outcome is 1:1 with the version, not a
many-to-many relationship needing its own table. "Rejected" is represented implicitly: a version
with `approvedAt: null` whose Work Item is now `REWORK_REQUIRED` was the version that triggered the
most recent `Return`. The timeline (User Story 4) reconstructs full history by joining
`DesignVersion` (ordered by `version`) with `Return` (ordered by `createdAt`) per Work Item — no
new join table needed to answer "what happened to each version."

**Alternatives considered**: A separate `DesignVersionReview` entity (approved | rejected,
reviewer, reason) — rejected as redundant: it would duplicate `approvedAt`/`approvedById` for the
approved case and duplicate `Return`'s reviewer/reason/category for the rejected case, for no
query `DesignVersion` + `Return` can't already answer together.

## §3. `Return` attachments reuse 002's `StorageAdapter` port, not 050

**Decision**: A new `ReturnAttachment` model (storageKey, fileName, mimeType, sizeBytes, kind)
stores bytes via the existing `StorageAdapter` port (`LocalDiskStorageAdapter` for dev) — the same
pattern 012 used for `DesignVersion` when 050's file-metadata layer didn't exist yet.

**Rationale**: 050 (files/attachments) is still Backlog (PRI-30, PRI-14 in progress) as of this
feature's spec. Blocking 013 on 050 would stall the review gate — the single most important gate in
the whole system (constitution II) — on an unrelated feature's schedule. 012 already established
the precedent of building directly on `StorageAdapter` and being migrated to 050's layer later if
050 ever introduces a genuinely different contract; 013 follows the same precedent for consistency
and to avoid inventing a second file-storage pattern.

**Migration note**: if/when 050 ships `attachments.attach`, both 012's `DesignVersion` and 013's
`ReturnAttachment` are candidates for a follow-up migration onto it — out of scope here.

## §4. Self-review guard — compares reviewer to the version's uploader, not the Work Item's assignee

**Decision**: The guard registered for `(from: "WAITING_REVIEW", to: "APPROVED")` compares
`actor.userId` to the *current `DesignVersion`'s* `uploadedById`, not `WorkItem.assigneeId`.

**Rationale**: `assigneeId` can change via reassignment (012) between when a version was uploaded
and when it's reviewed; the guard's job (constitution II: "a Designer MUST NOT approve their own
work") is about who *made* the specific version under review, which `DesignVersion.uploadedById`
already records immutably. Comparing against `assigneeId` would both under-protect (a reassigned-
away designer could still review their own old version if later granted `design.review`) and
over-protect (a currently-assigned designer who didn't upload the version in question would be
blocked from reviewing someone else's earlier version, which the spec's edge case doesn't require).

**Alternatives considered**: Comparing against `WorkItem.assigneeId` — rejected per above. A
role-level rule ("nobody with `design.work` may hold `design.review`") — rejected as out of scope;
the spec (Assumptions) explicitly allows a single person to hold both permissions and relies on the
per-version guard, not a permission-exclusivity rule, to prevent the actual bad outcome.

## §5. Origin department — existing `Department` model, no new enum

**Decision**: `Return.originDepartmentId` references the existing `Department` model (001/002),
same as `WorkItem.departmentId`. No new hardcoded department enum.

**Rationale**: Constitution VI already requires departments to be Admin-configured data, not code
branches; `Department` already exists and is exactly this. Re-declaring a parallel
"origin department" enum for rejections would violate VI for no benefit.

## §6. Review queue ordering — same urgent-first/oldest-first rule as 012's "My queue"

**Decision**: `getReviewQueue` sorts urgent Work Items first, then oldest-`WAITING_REVIEW`-entry
first within each priority bucket — the identical rule 012's `getMyQueue` already applies (FR-008
there), read from the same `WorkItemTransition` history (most recent transition landing in
`WAITING_REVIEW`).

**Rationale**: Consistency — the shop should not learn two different queue-ordering conventions for
its two review-adjacent screens. No new design work needed; the ordering comparator is duplicated
(not shared as an abstraction) into `src/server/review/queue.ts`, matching how 012 itself was built
as a sibling module rather than a shared "queue" library (plan.md's "Structure Decision" pattern
across all features: modules composed over shared, prematurely-abstracted infrastructure).
