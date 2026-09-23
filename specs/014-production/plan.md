# Implementation Plan: Production Workflow

**Branch**: `014-production` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-production/spec.md`

## Summary

Gives Production Operators a department-scoped queue of Work Items ready for production, a
read-only job card that only ever offers the Head-Designer-approved file for download, a
timer reusing 002's generic `PhaseTiming` module (phase = `IN_PRODUCTION`, same pattern as 012's
design timing), and a completion step that records produced quantity + notes and moves the item
to `PRODUCTION_COMPLETED` for 015's collection queue to pick up. Sending a Work Item back to
design reuses 013's generic `createReturn(origin: "PRODUCTION")` unmodified. External-vendor
departments get two dated steps (sent/received) that gate completion. A mid-production revised
approved file blocks the timer from resuming until the operator acknowledges it — enforced as a
plain domain check inside the production module (not a `registerGuard` state-transition guard,
since resuming a paused timer is not itself a state transition). Authorization reuses 001's
already-seeded `production.operate` permission with its already-built department-scope parameter
(`authorize(actor, "production.operate", { departmentId })`) — no new permission key needed.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 (matches CI)

**Primary Dependencies**: Next.js 15 (App Router, RSC + Server Actions), Prisma ORM (PostgreSQL),
Zod, Tailwind CSS (RTL logical properties), Better Auth session (via 001's `getActor()`)

**Storage**: PostgreSQL via `prisma/schema/core.prisma` — new `producedQuantity`, `productionNotes`,
`pendingFileRevisionAt` columns on `WorkItem`; new `isExternalProduction` boolean on `Department`;
new `VendorProductionRecord` model; one new allowed edge in `src/server/core/workflow/edges.ts`
(`IN_PRODUCTION → REWORK_REQUIRED`, for US5's send-back). File bytes for approved design versions
are already on disk via 012's `StorageAdapter`-backed `DesignVersion` — this feature only reads
that existing data, it does not write file bytes.

**Testing**: Vitest — unit tests for pure logic (revised-file-ack gating, vendor-receipt
completion gate), integration tests against the real Postgres test DB
(`tests/helpers/testDb.ts`), contract tests for this feature's new contracts
(`contracts/production.md`); 002's `transitionWorkItem`/`PhaseTiming` contract tests are reused
unmodified.

**Target Platform**: Server-rendered web app, local LAN deployment (constitution VII)

**Project Type**: Web application (single Next.js project — Option 1, matching 001/002/011/012/013)

**Performance Goals**: Operator queue load (SC-001: job card reachable in under 10s) — one
department-scoped query plus per-row derived badges, V1 staff/volume scale, no specialized
performance engineering needed.

**Constraints**: Arabic-first RTL UI (constitution IX). Every state change goes through
`transitionWorkItem` (constitution V) — this feature never writes `WorkItem.state` directly.
Department scoping is enforced both in the queue query and via `authorize()`'s existing
`{ departmentId }` scope parameter on every job-card/action entry point (FR-003, mirrors the
`authorize.ts` doc-comment's own worked example). Completion and the vendor-receipt gate are
plain precondition checks inside `completeProduction()`, not new workflow-edge machinery.

**Scale/Scope**: Single print shop, several production departments, hundreds of Work Items/day —
no sharding/pagination-at-scale concerns.

**Cross-feature dependency note**: this feature reads 012's `DesignVersion` (for the approved-file
download, US2) and 013's `approvedAt`/`approvedById` marker plus `createReturn` (US5). Neither is
merged to `main` as of this writing (013-review-rework-impl, PR #43, is based on
012-designer-assignment-timers-impl, PR #42 — both awaiting review). Per 013's own tasks.md
prerequisite pattern: if 013 is not yet merged to `main` when this feature's implementation phase
starts, base the implementation branch on `013-review-rework-impl` instead of `main`, and rebase
once #42/#43 land.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design in "Post-Design
Constitution Check" below.*

| Principle | Check | Result |
|---|---|---|
| I. Order → Work Item Is the Canonical Model | Production timing, completion, and vendor steps all attach to the existing Work Item; `VendorProductionRecord` belongs to a Work Item, no parallel object | PASS |
| II. Business Gates Are Inviolable | Only Approved/Production-stage files are downloadable (FR-004); vendor-receipt gates completion (FR-012); urgent priority reorders the queue but never skips department scoping or the vendor-receipt gate | PASS |
| III. History Is Append-Only | `PhaseTiming` segments are start/pause/resume timestamps, never a live counter (FR-005, reuses 002's model unmodified); completion records completing operator + timestamp; `VendorProductionRecord`'s sent/received dates are set once each, never edited after the fact | PASS |
| IV. Files Are Immutable, Private Versions | This feature only reads existing `DesignVersion` bytes via the existing `StorageAdapter`-backed download path; it writes no file bytes of its own | PASS (N/A — no new file writes) |
| V. The Server Is the Only Authority | Every job-card/action entry point calls `authorize(actor, "production.operate", { departmentId })`; state changes exclusively via `transitionWorkItem`; revised-file-ack and vendor-receipt gates are enforced server-side inside the production module, not as UI-only checks | PASS |
| VI. Configuration Over Hard-Coding | Department routing reads the existing, Admin-configured `Department` model (001); `isExternalProduction` is a per-department configured flag, not a hardcoded department-name check | PASS |
| VII. Local-First, Isolated Integrations | No external integration; vendor name/dates are plain recorded fields, not a live integration with any vendor system | PASS (N/A) |
| VIII. AI Is Optional and Assistive | No AI/automation surface in this feature | PASS (N/A) |
| IX. Arabic-First, Task-Oriented UX | Operator queue is the production floor's primary screen, urgent-first ordering, single-screen job card (no cross-navigation for spec/timer/download, mirrors 013's SC-001 pattern) | PASS |

No violations — Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/014-production/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── production.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
src/
├── server/
│   └── production/                   # NEW — this feature's own module
│       ├── index.ts                  # barrel (only legal import surface)
│       ├── errors.ts                 # DomainProductionError
│       ├── queue.ts                  # getOperatorQueue
│       ├── jobCard.ts                # getJobCard (spec + approved-file pointer)
│       ├── timer.ts                  # startProduction, pauseProduction, resumeProduction
│       ├── completion.ts             # completeProduction
│       ├── sendBack.ts               # sendBackToDesign (thin wrapper over 013's createReturn)
│       ├── vendor.ts                 # recordSentToVendor, recordReceivedFromVendor
│       └── workload.ts               # getDepartmentWorkload (090 consumes)
├── app/
│   └── (shell)/
│       └── production/
│           ├── page.tsx              # Operator production queue
│           └── [workItemId]/page.tsx # job card (spec, download, timer, complete, send-back)
└── messages/
    └── ar.json                       # + this feature's Arabic keys

prisma/
└── schema/
    └── core.prisma                  # + WorkItem.producedQuantity/productionNotes/pendingFileRevisionAt,
                                      #   Department.isExternalProduction, VendorProductionRecord model

src/server/core/workflow/
└── edges.ts                          # + IN_PRODUCTION → REWORK_REQUIRED edge

tests/
├── unit/production.test.ts
├── contract/production/production.test.ts
└── integration/production/
    ├── queue.test.ts
    ├── timer.test.ts
    ├── completion.test.ts
    ├── sendBack.test.ts
    ├── vendor.test.ts
    └── revisedFileAck.test.ts
```

**Structure Decision**: Single Next.js project (matching 001/002/010/011/012/013). New
`src/server/production/**` module, barrel-only import surface enforced by an `eslint.config.js`
`no-restricted-imports` rule mirroring the existing per-module rules. No new top-level project or
package.

## Complexity Tracking

*No violations — table intentionally empty.*
