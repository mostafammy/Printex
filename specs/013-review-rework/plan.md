# Implementation Plan: Head Designer Review & Rework Loop

**Branch**: `013-review-rework` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-review-rework/spec.md`

## Summary

Gives the Head Designer a queue of everything waiting on their decision and a single review screen
to approve or reject it. Approval marks the current `DesignVersion` (012) approved and advances the
Work Item toward `READY_FOR_PRODUCTION` via the existing `WAITING_REVIEW → APPROVED` edge; a
self-review guard (`registerGuard`) blocks a reviewer from approving a version they uploaded
themselves. Rejection requires a category, origin department, and explanation, creates a generic
`Return` record (reusable later by 014/051), notifies the assigned designer in the same
transaction, and lands the Work Item in `REWORK_REQUIRED` via the existing edge (both already
present in 002's `edges.ts`/`transition.ts` — `rejectionCategory` is already a required field on
that edge). The rework counter (FR-013) is a derived count of `Return` rows per Work Item, not a
stored/incremented field, matching the project's append-only philosophy and avoiding a race
between concurrent rejections. Attachments (voice note, image, file) on a `Return` reuse 002's
existing `StorageAdapter` port, the same pattern 012 used for `DesignVersion` bytes, since 050's
own attachment layer does not exist yet. No new `Permission` key: both actions reuse 001's already-
seeded `design.review`.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 (matches CI)

**Primary Dependencies**: Next.js 15 (App Router, RSC + Server Actions), Prisma ORM (PostgreSQL),
Zod, Tailwind CSS (RTL logical properties), Better Auth session (via 001's `getActor()`)

**Storage**: PostgreSQL via `prisma/schema/core.prisma` (two new models, `Return` and
`ReturnAttachment`; two new nullable columns on 012's `DesignVersion` — `approvedAt`,
`approvedById`). File bytes for attachments via 002's existing `StorageAdapter` port — no new
storage backend.

**Testing**: Vitest — unit tests for pure logic (rework-count derivation, queue ordering
tie-break), integration tests against the real Postgres test DB (`tests/helpers/testDb.ts`),
contract tests for this feature's new contracts (`contracts/review-rework.md`); 002's
`transitionWorkItem`/`registerGuard` contract tests are reused unmodified.

**Target Platform**: Server-rendered web app, local LAN deployment (constitution VII)

**Project Type**: Web application (single Next.js project — Option 1, matching 001/002/011/012)

**Performance Goals**: Review screen load (SC-001: no navigation away for spec/history) — one
Work Item + its versions + its Return history per screen load, V1 staff/volume scale, no
specialized performance engineering needed.

**Constraints**: Arabic-first RTL UI (constitution IX). Every state change goes through
`transitionWorkItem` (constitution V) — this feature never writes `WorkItem.state` directly.
Approval marks `DesignVersion.approvedAt`/`approvedById` in the same transaction as the
`WAITING_REVIEW → APPROVED` transition; rejection writes the `Return` row, the
`WAITING_REVIEW → REWORK_REQUIRED` transition (which itself writes `WorkItemTransition` with
`rejectionCategory`), and the notification, all in one transaction (constitution III, V).

**Scale/Scope**: Single print shop, one or a few Head Designers, hundreds of Work Items/day — no
sharding/pagination-at-scale concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design in "Post-Design
Constitution Check" below.*

| Principle | Check | Result |
|---|---|---|
| I. Order → Work Item Is the Canonical Model | Review/reject operate on the existing Work Item and its 012 `DesignVersion`s; `Return` belongs to a Work Item, no parallel object | PASS |
| II. Business Gates Are Inviolable | `WAITING_REVIEW` is mandatory when `requiresReview` (011/002); self-review guard blocks same-person approve (FR-005); urgent priority never skips the queue (FR-016) | PASS |
| III. History Is Append-Only | `Return` rows are never edited/deleted (FR-010); rework counter is a derived count, not a mutable field, so nothing to drift; approval/rejection both write `audit.record` + `WorkItemTransition` in the same transaction | PASS |
| IV. Files Are Immutable, Private Versions | `DesignVersion.approvedAt` is set once and never cleared; approving never overwrites file bytes; `ReturnAttachment` bytes via `StorageAdapter`, private by construction | PASS |
| V. The Server Is the Only Authority | `approveDesign`/`rejectDesign` both `authorize(actor, "design.review")`; state changes exclusively via `transitionWorkItem`; self-review enforced server-side via `registerGuard`, not a UI check | PASS |
| VI. Configuration Over Hard-Coding | Origin department is one of the Admin-configured `Department` rows (existing model), not a hardcoded enum; rejection category reuses 002's already-configurable `RejectionCategory` | PASS |
| VII. Local-First, Isolated Integrations | No external integration; `notify()` writes to the local outbox only | PASS (N/A) |
| VIII. AI Is Optional and Assistive | No AI/automation surface in this feature | PASS (N/A) |
| IX. Arabic-First, Task-Oriented UX | Review queue is the Head Designer's primary screen, urgent-first ordering, single-screen review (no cross-navigation for spec/history, SC-001) | PASS |

No violations — Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/013-review-rework/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── review-rework.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
src/
├── server/
│   └── review/                       # NEW — this feature's own module
│       ├── index.ts                  # barrel (only legal import surface)
│       ├── errors.ts                 # DomainReviewError
│       ├── queue.ts                  # getReviewQueue
│       ├── review.ts                 # getReviewDetail, approveDesign, rejectDesign
│       ├── returns.ts                # createReturn (generic, consumable by 014/051 later)
│       ├── timeline.ts               # getVersionTimeline
│       └── guards.ts                 # registerGuard(no-self-review) — registered at boot
├── app/
│   └── (shell)/
│       └── review/
│           ├── page.tsx              # Head Designer review queue
│           └── [workItemId]/page.tsx # review screen (versions, spec, approve/reject)
└── messages/
    └── ar.json                       # + this feature's Arabic keys

prisma/
└── schema/
    └── core.prisma                  # + Return, ReturnAttachment models; DesignVersion.approvedAt/approvedById

tests/
├── unit/review-rework.test.ts
├── contract/review/review-rework.test.ts
└── integration/review/
    ├── approve.test.ts
    ├── reject.test.ts
    └── timeline.test.ts
```

**Structure Decision**: Single Next.js project (matching 001/002/010/011/012). New
`src/server/review/**` module, barrel-only import surface enforced by an `eslint.config.js`
`no-restricted-imports` rule mirroring `src/server/orders/**` and `src/server/designers/**`. No
new top-level project or package.

## Complexity Tracking

*No violations — table intentionally empty.*
