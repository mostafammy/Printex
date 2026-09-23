# Implementation Plan: Designer Assignment & Timers

**Branch**: `012-designer-assignment-timers` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-designer-assignment-timers/spec.md`

## Summary

Puts a specific designer's name on every design job and measures exactly how long design work
takes. Reception (or, if a shop configures it, a Head Designer) assigns a `NEW` Work Item to one of
the eligible designers via a dialog that shows workload and customer history, with a
lightest-loaded suggestion that is never auto-confirmed (constitution VIII). The same dialog handles
reassignment, which requires a reason and preserves the previous designer's recorded time.
Designers work from a personal "My queue" (replacing 002's placeholder `/my-queue` page) with a
start/pause/resume timer whose durations are always re-derived from persisted timestamps, never a
client-side stopwatch (constitution III). Technical approach: this feature is almost entirely
composition over 002's existing primitives — `WorkItem.assigneeId`, `PhaseTiming`/`openSegment`/
`closeOpenSegment`, `transitionWorkItem`, `notify` — plus one genuinely new piece, a
`DesignVersion` metadata table on top of 002's already-existing `StorageAdapter` port (050's
file-metadata layer doesn't exist yet). No new `Permission` key: assignment/reassignment reuses
001's existing `workitem.assign_designer`, already seeded to `RECEPTION`/`ADMIN_OWNER`.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 (matches CI)

**Primary Dependencies**: Next.js 15 (App Router, RSC + Server Actions), Prisma ORM (PostgreSQL),
Zod, Tailwind CSS (RTL logical properties), Better Auth session (via 001's `getActor()`)

**Storage**: PostgreSQL via `prisma/schema/core.prisma` (one new model, `DesignVersion`; no new
schema file). File bytes via 002's existing `StorageAdapter` port (`LocalDiskStorageAdapter` for
dev) — no new storage backend.

**Testing**: Vitest — unit tests for pure logic (suggested-designer tie-break, duration
aggregation helpers), integration tests against the real Postgres test DB
(`tests/helpers/testDb.ts`), contract tests for this feature's own new contracts
(`contracts/designer-assignment.md`); 002's existing `transitionWorkItem`/`timing.ts` contract
tests are reused unmodified, not re-authored.

**Target Platform**: Server-rendered web app, local LAN deployment (constitution VII)

**Project Type**: Web application (single Next.js project — Option 1, matching 001/002/011)

**Performance Goals**: Assignment dialog load (SC-001: under 15s of interaction, including the
workload query) — one query per eligible designer at V1 staff scale (tens, not thousands) is well
within budget (research.md §6); no specialized performance engineering needed.

**Constraints**: Arabic-first RTL UI (constitution IX). Every state change goes through
`transitionWorkItem` (constitution V) — this feature never writes `WorkItem.state` directly.
Reassignment (no state change) writes `assigneeId` directly plus `audit.record`, deliberately NOT
through `transitionWorkItem`, since a same-state assignee change isn't a workflow edge
(research.md §3). Every duration displayed is re-derived from `PhaseTiming` timestamps at read
time, never accumulated client-side or cached (constitution III, FR-015).

**Scale/Scope**: Single print shop, low tens of designers, hundreds of Work Items/day — no
sharding/pagination-at-scale concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design in "Post-Design
Constitution Check" below.*

| Principle | Check | Result |
|---|---|---|
| I. Order → Work Item Is the Canonical Model | `assigneeId` is an existing `WorkItem` column (002); assignment/reassignment/timers all operate on the existing Work Item, no parallel object | PASS |
| II. Business Gates Are Inviolable | `markDesignComplete` never bypasses `requiresReview`; review approval itself stays 013's job (this feature only produces `WAITING_REVIEW`/`APPROVED`, never sets an approved status itself) | PASS |
| III. History Is Append-Only | Every assign/reassign/timer/upload/complete action writes `audit.record` and/or `WorkItemTransition` (contracts/designer-assignment.md); all durations re-derived from persisted `PhaseTiming` timestamps (FR-015) | PASS |
| IV. Files Are Immutable, Private Versions | New `DesignVersion` model: no update/delete path, unique `(workItemId, version)`, bytes via the existing `StorageAdapter` port, private by construction (no public URL) | PASS |
| V. The Server Is the Only Authority | Every mutating function `authorize()`-gated (Authorization table, contracts/designer-assignment.md); state changes exclusively via `transitionWorkItem` | PASS |
| VI. Configuration Over Hard-Coding | Reassignment authority is role→permission seed data (`workitem.assign_designer`), not a code branch checking a role name (research.md §1) | PASS |
| VII. Local-First, Isolated Integrations | No external integration; `notify()` writes to the local outbox only | PASS (N/A) |
| VIII. AI Is Optional and Assistive | Suggested designer is a plain deterministic rule (fewest active items), never auto-assigns (FR-003); explicitly satisfies "Designers MUST NOT be auto-assigned in V1" | PASS |
| IX. Arabic-First, Task-Oriented UX | "My queue" is the primary designer screen (already reserved in nav.ts), urgent-first ordering, minimal-click assignment dialog | PASS |

No violations — Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/012-designer-assignment-timers/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── designer-assignment.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
prisma/schema/
└── core.prisma                          # MODIFIED — data-model.md's exact diff:
                                          #   + DesignVersion model
                                          #   + WorkItem.designVersions back-relation
                                          #   + User.designVersionsUploaded back-relation
                                          #   (WorkItem.assigneeId, PhaseTiming, WorkItemTransition,
                                          #    workitem.assign_designer, HEAD_DESIGNER: all reused
                                          #    unchanged from 001/002 — see data-model.md)

src/server/core/
└── index.ts                             # MODIFIED — barrel addition (research.md §2's gap):
                                          #   + openSegment, closeOpenSegment,
                                          #     calculatePhaseDurationMs
                                          #   + PhaseTimingKind, PhaseTimingSegment types

src/server/designers/                    # NEW — this feature's service layer
├── index.ts                             # barrel — the ONLY legal import surface from outside
│                                         #   (mirrors src/server/orders/index.ts's pattern; add
│                                         #   the matching eslint.config.js module-boundary rule)
├── errors.ts                            # DomainDesignerError
├── assignment.ts                        # getEligibleDesigners(), assignDesigner()
├── queue.ts                             # getMyQueue()
├── timer.ts                             # startTimer(), pauseTimer(), phaseDurations()
├── designVersions.ts                    # uploadDesignVersion(), markDesignComplete()
└── workload.ts                          # getDesignerWorkload() (090's dashboard consumer)

src/app/(shell)/
├── my-queue/
│   └── page.tsx                         # REPLACED — was 002's placeholder; now the real designer
│                                        #   queue (US3) — Server Component, direct db reads via
│                                         #   getMyQueue(), timer Server Actions inline
├── orders/[orderId]/
│   └── page.tsx                         # MODIFIED (011's file) — adds the assignment-dialog entry
│                                         #   point and per-Work-Item assign/reassign affordance;
│                                         #   011's own placeholder note for "050/051/052/054 slots"
│                                         #   did not reserve one for 012 explicitly, so this is a
│                                         #   direct, reviewed edit to that existing page, not a new
│                                         #   route
└── design/
    └── [workItemId]/
        └── page.tsx                     # NEW — a Work Item's design workspace: timer controls,
                                          #   upload form, mark-complete action (nav.ts's existing
                                          #   "design" entry currently has no page behind it)

src/messages/ar.json                     # MODIFIED — new keys for the assignment dialog, queue
                                          #   rows, timer controls, upload form (Arabic, RTL)

tests/
├── unit/
│   └── designers/
│       └── suggestion.test.ts           # pure tie-break logic for "lightest eligible designer"
├── contract/
│   └── designers/
│       └── designer-assignment.test.ts  # frozen shapes from contracts/designer-assignment.md
└── integration/
    └── designers/
        ├── assign.test.ts               # US1 — initial assignment end-to-end
        ├── reassign.test.ts             # US2 — reassignment, reason required, history preserved
        ├── timer.test.ts                # US3 — start/pause/resume, refresh-safe duration, restart-safe duration
        ├── concurrentTimer.test.ts      # US3 Acceptance Scenario 5 — one active timer per designer
        ├── uploadAndComplete.test.ts    # US4 — upload gate, chained transition to WAITING_REVIEW/APPROVED
        └── rework.test.ts               # US5 — REWORK_REQUIRED re-entry, accumulating active time
```

**Structure Decision**: Single Next.js project (Option 1), consistent with 001/002/011. New
business logic lives in `src/server/designers/**` (a new top-level module alongside
`src/server/core`, `src/server/auth`, `src/server/orders`), not inside `src/server/core/**` — same
rationale 011 gave for `src/server/orders/**`: this is feature-specific composition over the
workflow engine, not the engine itself. `src/server/designers/**` gets its own
`eslint.config.js` module-boundary rule, matching the existing pattern.

## Architecture & Design Patterns

### 5.1 Architectural style: thin Server Action adapters over a small service layer

Identical shape to `src/server/orders/**` (011's plan.md §5.1) — `authorize()` first, Zod-validate
raw input, do the DB work in `db.$transaction`, return a plain typed value (not `Result` — this
module is outside `src/server/core/**`, so it follows the "let it throw, Server Action boundary
catches" convention, matching `src/server/orders/**`'s own `DomainOrderError` precedent with this
feature's own `DomainDesignerError`).

### 5.2 Design patterns applied

- **Composition over reinvention** (the central decision of this whole plan): every durable
  primitive this feature needs — `WorkItem.assigneeId`, `PhaseTiming`, `transitionWorkItem`,
  `notify`, `workitem.assign_designer` — already exists from 001/002. This feature's own code is
  almost entirely orchestration: deciding *when* to call those primitives, never reimplementing
  what they do (research.md §1–3, §5).
- **Adapter pattern**: every mutating page action is a `"use server"` function calling one
  `src/server/designers/*` function then `revalidatePath(...)`, same as 011.
- **Pure function extraction**: the "lightest eligible designer" tie-break (FR-003) and duration
  aggregation over a segment array (`calculatePhaseDurationMs`, already pure and reused, not
  reimplemented) are this feature's two testable-without-a-database pieces.
- **New metadata-only model, not a new storage backend**: `DesignVersion` adds exactly the
  database-side bookkeeping constitution IV requires on top of the already-existing
  `StorageAdapter` byte-storage port — no new I/O abstraction (research.md §4).

### 5.3 Core public types (the actual contracts, in TypeScript)

Full detail lives in `contracts/designer-assignment.md` — summarized here:

```ts
// src/server/designers/index.ts (barrel)
function getEligibleDesigners(actor: Actor, workItemId: string): Promise<EligibleDesigner[]>;
function assignDesigner(actor: Actor, workItemId: string, designerId: string, reason?: string): Promise<void>;
function getMyQueue(actor: Actor): Promise<MyQueueRow[]>;
function startTimer(actor: Actor, workItemId: string): Promise<void>;   // also "resume"
function pauseTimer(actor: Actor, workItemId: string): Promise<void>;   // also "stop"
function uploadDesignVersion(actor: Actor, workItemId: string, file: {...}, note?: string): Promise<{ designVersionId: string; version: number }>;
function markDesignComplete(actor: Actor, workItemId: string): Promise<void>;
function phaseDurations(actor: Actor, workItemId: string): Promise<PhaseDurations>;
function getDesignerWorkload(actor: Actor): Promise<Array<{ userId: string; name: string; activeWorkItemCount: number }>>;
```

`EligibleDesigner`, `MyQueueRow`, `PhaseDurations` shapes: data-model.md. `DomainDesignerError`
codes: contracts/designer-assignment.md's Authorization table section.

### 5.4 Type safety

- Every public function's parameters/return types written out in full (§5.3/contracts) — no `any`.
- `uploadDesignVersion`'s `file` parameter takes a `NodeJS.ReadableStream` (matching
  `StorageAdapter.put`'s own signature exactly) — the Server Action boundary converts a
  multipart/form-data upload into that stream shape before calling into `src/server/designers/**`,
  keeping the service layer framework-agnostic (same boundary discipline as Zod-parsing `FormData`
  before calling `src/server/orders/**`).
- No new branded ID types needed — `workItemId`/`designerId`/`designVersionId` stay plain `string`
  at this module's public boundary (matching `src/server/orders/**`'s convention; `core`'s branded
  `WorkItemId`/`UserId` remain internal to `core` and to this feature's own calls into
  `transitionWorkItem`).

### 5.5 Performance

- `getEligibleDesigners` runs one query for the eligible-user list plus a bounded number (tens) of
  per-designer count queries — acceptable at V1 scale (research.md §6); if staff count grows
  materially, batching into a single grouped query is a non-breaking internal optimization, not a
  contract change.
- Every mutating function does exactly one `db.$transaction` — no sequential round trips beyond
  what `transitionWorkItem`'s own internal steps already do.
- File upload streams directly to `StorageAdapter.put` without buffering the whole file in memory
  (`LocalDiskStorageAdapter`'s own existing contract, reused unchanged).

### 5.6 Scalability & maintainability

- `DesignVersion` is additive to `core.prisma` — no breaking change to any 001/002/011 model or
  contract; those features' own tests continue to pass unmodified.
- `src/server/designers/**`'s barrel + ESLint module-boundary rule lets 013 (review, which reads
  `WorkItem.assigneeId` and produces `REWORK_REQUIRED`), 090 (dashboard, via
  `getDesignerWorkload`/`phaseDurations`), and 014 (production timers, which reuses the exact same
  `PhaseTiming`/`openSegment`/`closeOpenSegment` pattern this feature establishes) depend on this
  feature's public shape without coupling to its internals.
- The `/my-queue` page this feature replaces was deliberately left as a thin placeholder by 002
  specifically so a later feature (this one) could fill it in — no migration or redirect needed,
  just a content swap at the same route.

## Post-Design Constitution Check

*Re-checked after Phase 1 (data-model.md, contracts/designer-assignment.md, quickstart.md).*

| Principle | Re-check after design | Result |
|---|---|---|
| I | `DesignVersion` and `assigneeId` writes are additive to the existing Order→WorkItem model; data-model.md confirms no new "status" column | PASS |
| III | contracts/designer-assignment.md confirms every mutating function pairs with `audit.record` and/or `transitionWorkItem`'s own `WorkItemTransition` write; `phaseDurations` confirms pure re-derivation, no cached total | PASS |
| IV | data-model.md's `DesignVersion` has no update/delete path and a `(workItemId, version)` uniqueness constraint preventing silent overwrite | PASS |
| V | contracts/designer-assignment.md's Authorization table confirms every mutating function is `authorize()`-gated; reassignment's `workitem.assign_designer` reuse (not a new ad hoc check) confirmed in research.md §1 | PASS |
| VI | Reassignment-authority extension to `HEAD_DESIGNER` is a documented seed-data change (data-model.md, quickstart.md Scenario 7), not code | PASS |

No new violations introduced by the detailed design — Complexity Tracking remains empty.

## Complexity Tracking

*No violations — table intentionally empty.*

