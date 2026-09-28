# Implementation Plan: Order Change Control

**Branch**: `016-change-control` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-change-control/spec.md`

## Summary

This feature makes a Work Item's specification (product type, description, quantity, dimensions,
material, finish notes) a sequence of immutable, numbered **Specification Versions**:

- **Versioning**: v1 is created with the Work Item, or backfilled for existing ones. Every later
  change appends v2, v3, and so on. The Work Item's existing columns stay as a mirror of the
  current version, so 011–014 readers are unchanged.
- **Single write path**: every specification write goes through one function
  (`applySpecChangeInTx`). A pure, exhaustive state policy decides which entry point may call
  it:
  - direct edit (`NEW` … `READY_FOR_PRODUCTION`)
  - change request (`IN_PRODUCTION`)
  - Admin override (after production)
  - nothing (`CANCELLED`)
- **Change requests**: a change request during production freezes the job. It pauses the timer
  and blocks resume/complete/send-back through `registerGuard` guards plus one check in 014's
  resume. It is decided by holders of a new `change.approve` permission, with an explicit outcome:
  - "continue production": the operator must acknowledge.
  - "send back to design": `REWORK_REQUIRED` plus 013's `createReturnInTx` with
    `CUSTOMER_CHANGE`.
- **`SPEC_CHANGED` event**: every new version emits it to in-transaction listeners (051 registers
  its pricing reset there) and to the notification outbox.
- **Late cancellation**: cancelling after production started goes only through a
  late-cancellation action. It requires a reason and an explicit EGP cost, is stored permanently,
  and is handed to finance (052) through a `DirectCostPort`. A guard on `→ CANCELLED` from
  production states makes every other cancel path refuse.
- **Diff**: a pure typed diff function and a `<SpecDiff>` component show "before → after" in
  history, on the change request screen, and on the job card.
- **Shared aspect layer**: all eight commands and four queries are built on the **shared** aspect
  layer defined jointly with 015 ([contracts/aspects.md](./contracts/aspects.md), a canonical
  copy). `createAspects(deps).forModule<ChangeError>()` → `defineCommand`/`defineQuery`, bound in
  `src/server/changes/aspect.ts`. Validation, permission, transaction, scoped authorization,
  audit, and error mapping each happen in one place. Commands return `AspectResult` (research
  §11).

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 (matches CI)

**Primary Dependencies**: Next.js 15 (App Router, RSC + Server Actions), Prisma ORM (PostgreSQL),
Zod, Tailwind CSS (RTL logical properties), Better Auth session (via 001's `getActor()`). There is
**no tRPC** in this codebase. Mutations are inline Server Actions calling `src/server/**` services
(research §11).

**Storage**: PostgreSQL.

- New file `prisma/schema/change-control.prisma`: enums `SpecVersionOrigin`,
  `ChangeRequestStatus`, `ChangeRequestOutcome`, and models `SpecVersion`, `ChangeRequest`,
  `LateCancellation`.
- One new nullable column `WorkItem.currentSpecVersionId` (unique), plus back-relations in
  `core.prisma`/`identity.prisma`.
- Three new edges in `src/server/core/workflow/edges.ts`: `APPROVED | WAITING_PRICING |
  READY_FOR_PRODUCTION → REWORK_REQUIRED`.
- Two new manual SQL files: backfill, and constraints/append-only.
- No new persistent store: everything is in the existing database, which is already in backup
  scope.

**Testing**: Vitest. Only `tests/**/*.test.ts` is collected (`vitest.config.ts`), so the
`<SpecDiff>` render test is a `.ts` file using `react-dom/server`'s `renderToStaticMarkup`. The
existing `tests/components/customers/*.test.tsx` files are not collected, and 016 does not copy
that.

- Unit tests: the policy, diff, patch schema, and hold derivation, all pure.
- Integration tests against the real Postgres test DB (`tests/helpers/testDb.ts`): every gate,
  forbidden transition, and permission, run through the **server entry points**.
- Contract tests: `contracts/*.md` (event payload, guard registration, port invocation, append-only
  revocation).

002's `workflow-edges.test.ts` matrix adapts automatically to the new edges.

**Target Platform**: Server-rendered web app, local LAN deployment (constitution VII)

**Project Type**: Web application (single Next.js project, Option 1, matching 001/002/010–014)

**Performance Goals**: SC-005 (approver decides in under 30 seconds) needs one paginated
approver-queue query with constant-count includes and one detail query. The hold check is a single
indexed `findFirst`. There are no per-row queries (research §17).

**Constraints**:

- Arabic-first RTL UI (constitution IX).
- Every state change goes through `transitionWorkItem` (constitution V). This feature never writes
  `WorkItem.state`.
- Every specification write goes through `applySpecChangeInTx` (FR-010), and every refusal is
  server-side.
- `SpecVersion` and `LateCancellation` are append-only at the database level (REVOKE, plus an update-blocking trigger on the FK target `SpecVersion`; mirroring
  `audit-event-append-only.sql`). `ChangeRequest` rows are updated only by the single guarded
  `PENDING → terminal` transition and the one-time acknowledgment. They are never deleted.
- No `any`: Zod at every input boundary, and discriminated unions for results, holds, diffs, and
  errors.

**Scale/Scope**: Single print shop, hundreds of Work Items per day, a handful of changes per day.
Version count per Work Item is small (each is a deliberate human action), so history is not
paginated. The approver queue is (FR-017).

**Cross-feature dependency note**:

- **Code**: this feature consumes code from 002 (`transitionWorkItem`, `registerGuard`,
  `closeOpenSegment`, `notify`, `assertNever`), 001 (`authorize`, `audit`, permissions), 011
  (creation paths, `editWorkItem`, `cancelWorkItem`/`cancelOrder`), 013 (`createReturnInTx`), and
  014 (`resumeProduction`, `getJobCard`). All of these are on `main` (see `git log`: 014 merged in
  #46).
- **Contracts only**: it provides contracts to **051** (pricing listener), **052** (direct-cost
  port) and **054** (future WhatsApp-recorded change requests). None of these exist yet, and 016
  must work without them (FR-023).
- **001**: the `change.approve` key is added to 001's permission list. 001 is Fady's feature, so
  this is a cross-team item (see "Cross-team contracts" below).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design in "Post-Design
Constitution Check" below.*

| Principle | Check | Result |
|---|---|---|
| I. Order → Work Item Is the Canonical Model | Versions, change requests, and late-cancellation records all belong to one Work Item. There is no parallel "job" object. Adding Work Items mid-production stays per-Work-Item (FR-030) | PASS |
| II. Business Gates Are Inviolable | In-production edits require a change request plus approval (FR-011–013). Completion is blocked while a change is pending or unacknowledged (FR-012/014). The pricing gate is protected by resetting pricing on every change (FR-021–023). Admin override is explicit, reasoned, and audited (FR-027/028) | PASS |
| III. History Is Append-Only | Every change appends a version, and the original stays readable (FR-004, PRD §47). `SpecVersion` (REVOKE DELETE + BEFORE UPDATE trigger) and `LateCancellation` (REVOKE UPDATE, DELETE) are append-only at the DB level. Change-request decisions are recorded, never erased. Every step is audited (FR-029) | PASS |
| IV. Files Are Immutable, Private Versions | No file bytes are written. Customer-change returns reuse 013's `Return` (no attachments required) | PASS (N/A) |
| V. The Server Is the Only Authority | All policy is enforced server-side: `specEditPolicy`, guards inside `transitionWorkItem`, and `authorize` in each command. Direct `editSpec` on `IN_PRODUCTION` is refused whatever the client (FR-010). State changes go only through `transitionWorkItem` | PASS |
| VI. Configuration Over Hard-Coding | The approver set is a permission assigned to roles as DB data, not a role name in code. Recipients are resolved from permissions, assignee, and department (research §19). No product-specific logic | PASS |
| VII. Local-First, Isolated Integrations | No external integration. Finance and pricing are reached through in-process port/listener contracts, so 016 works with neither installed | PASS (N/A) |
| VIII. AI Is Optional and Assistive | No AI surface | PASS (N/A) |
| IX. Arabic-First, Task-Oriented UX | Diff shows only the changed fields as "before → after" in Arabic. Hold banner and acknowledgment sit on the job card. Approver queue is urgent-first | PASS |
| Quality gate: schema changes | Additive-only schema with an idempotent backfill and a data-preservation/rollback plan (research §14, data-model.md "Migration & backfill"). Delivered via `db push` plus manual SQL instead of a Prisma migration, per project practice (see Complexity Tracking) | PASS with justified deviation |
| Quality gate: tests on server path | Every gate, forbidden transition, and permission has an integration task calling the server entry point (tasks.md) | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/016-change-control/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (incl. migration & backfill plan)
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── change-control.md    # service functions, errors, authorization table
│   ├── events-and-ports.md  # SPEC_CHANGED, listener registry, DirectCostPort, guards (cross-team)
│   ├── spec-diff.md         # diffSpecSnapshots + <SpecDiff>
│   └── aspects.md           # CANONICAL COPY of 015's shared aspect contract (keep in sync)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── server/
│   └── changes/                          # NEW — this feature's module
│       ├── index.ts                      # barrel (only legal import surface); side-effect import "./guards"
│       ├── errors.ts                     # ChangeError object union (raised via fail(), returned in AspectResult)
│       ├── aspect.ts                     # aspects.forModule<ChangeError>({ mapGuardFailure, mapUniqueViolation })
│       ├── specFields.ts                 # SPEC_FIELDS, SpecSnapshot, specPatchSchema, toSnapshot()
│       ├── policy.ts                     # specEditPolicy(state), redesignChoice(state, requiresDesign)
│       ├── diff.ts                       # diffSpecSnapshots (pure)
│       ├── events.ts                     # SPEC_CHANGED, SpecChangedEvent, registerSpecChangeListener, emitSpecChangedInTx
│       ├── ports.ts                      # DirectCostPort, noopDirectCostPort, setDirectCostPort
│       ├── recipients.ts                 # usersWithPermission(tx, permission)
│       ├── versions.ts                   # createInitialSpecVersionInTx, ensureCurrentSpecVersionInTx,
│       │                                 #   applySpecChangeInTx, getSpecHistory, getSpecVersionDiff,
│       │                                 #   getProductionStartSpecDiff
│       ├── effects.ts                    # sendBackForCustomerChangeInTx (transition + createReturnInTx + notify)
│       ├── editSpec.ts                   # editSpec (US2)
│       ├── changeRequests.ts             # createChangeRequest, approveChangeRequest, rejectChangeRequest,
│       │                                 #   withdrawChangeRequest, listPendingChangeRequests, getChangeRequestDetail
│       ├── productionHold.ts             # getProductionHold, acknowledgeSpecRevision
│       ├── guards.ts                     # CHANGE_HOLD + LATE_CANCELLATION_REQUIRED guards
│       ├── lateCancellation.ts           # cancelAfterProductionStarted (US6)
│       └── adminOverride.ts              # adminOverrideSpec (US7)
│   ├── orders/                           # 011 — touched
│   │   ├── create.ts                     # + createInitialSpecVersionInTx after each tx.workItem.create
│   │   ├── workItems.ts                  # addWorkItem → v1; editWorkItem → applySpecChangeInTx for spec fields
│   │   └── cancelOrder.ts                # cancelOrder return + requiresLateCancellation (additive)
│   ├── production/                       # 014 — touched
│   │   ├── errors.ts                     # + "CHANGE_HOLD" code
│   │   ├── timer.ts                      # resumeProduction: refuse while getProductionHold() ≠ null
│   │   └── jobCard.ts                    # + hold, currentSpecVersion, productionStartDiff
│   ├── auth/permissions.ts               # 001 — + "change.approve" (cross-team, Fady)
│   └── core/workflow/edges.ts            # 002 — + 3 edges into REWORK_REQUIRED
├── components/
│   └── changes/
│       ├── index.ts
│       ├── spec-diff.tsx                 # <SpecDiff changes={…} />
│       └── spec-history.tsx              # version list + pairwise <SpecDiff>
├── app/
│   └── (shell)/
│       ├── changes/
│       │   ├── page.tsx                  # approver queue (change.approve)
│       │   └── [changeRequestId]/page.tsx# detail: diff current vs proposed, approve/reject
│       ├── orders/[orderId]/…            # + edit-spec form, request-change form, history, late-cancel form,
│       │                                 #   Admin override form (rendered only for admin.override holders)
│       ├── production/[workItemId]/page.tsx # + hold banner, diff, acknowledge action
│       └── nav.ts                        # + "طلبات التعديل" entry gated by change.approve holders
└── messages/
    └── ar.json                           # + this feature's Arabic keys

src/server/core/aspects/                  # SHARED (contracts/aspects.md) — create if absent, else reuse unchanged
│   ├── types.ts  engine.ts  errors.ts  transition.ts
src/server/core/index.ts                  # SHARED — + aspects exports (contracts/aspects.md §6), if absent
src/server/aspects.ts                     # SHARED composition root — create if absent, else reuse unchanged
src/instrumentation.ts                    # SHARED — create if absent; add the `changes` block
                                          #   (await import barrel → registerChangeGuards()) (research §18)

prisma/
├── schema/
│   ├── change-control.prisma             # NEW — 3 enums, 3 models
│   ├── core.prisma                       # + WorkItem.currentSpecVersionId & back-relations; Return back-relation
│   └── identity.prisma                   # + User back-relations
├── seed.ts                               # + change.approve → HEAD_DESIGNER, ADMIN_OWNER
└── manual-sql/
    ├── 016-spec-version-backfill.sql     # idempotent v1 backfill + pointer + verification
    └── 016-change-control-constraints.sql# partial unique index + append-only guards

eslint.config.js                          # + barrel-only rule for ~/server/changes/**;
                                          #   SHARED rule (c) exemption for src/server/core/aspects/** (if absent; owner-confirmed 2026-09-24)

tests/
├── unit/core/aspects.test.ts             # SHARED engine tests (contracts/aspects.md §7) — create if absent
├── unit/changes/
│   ├── policy.test.ts                    # all 15 states, exhaustive
│   ├── diff.test.ts
│   ├── specPatchSchema.test.ts
│   ├── edges.test.ts                     # 3 new edges
│   └── spec-diff-render.test.ts          # renderToStaticMarkup (.ts, per vitest include)
├── contract/changes/
│   ├── events.test.ts                    # SPEC_CHANGED payload, exactly-once
│   ├── guards.test.ts                    # registration via barrel side effect; changeControl grep
│   ├── directCostPort.test.ts
│   └── append-only.test.ts               # SpecVersion/LateCancellation UPDATE/DELETE refused
└── integration/changes/
    ├── aspect-binding.test.ts            # changes binding: guardCode/P2002 mapping, SPEC_CHANGE_VETOED
    ├── versioning.test.ts                # v1 on every creation path, history, ensure-v1 self-heal
    ├── backfill.test.ts                  # SQL idempotency + verification query
    ├── editWorkItemDelegation.test.ts    # 011 editWorkItem → versioned; dueDate not versioned
    ├── editSpec.test.ts                  # policy per state (15), stale, no-op, redesign/keep, permission
    ├── changeRequest.test.ts             # record/freeze/approve/reject/withdraw, permissions, concurrency
    ├── productionHold.test.ts            # resume/complete/send-back refused; ack; department scope
    ├── approverQueue.test.ts             # ordering, pagination, no N+1
    ├── diff.test.ts                      # version diff, CR diff, production-start diff, permission
    ├── pricingReset.test.ts              # stand-in listener → PENDING in same tx; failure rolls back
    ├── lateCancellation.test.ts          # reason/cost, port, pending CR closed, permission
    ├── cancelPaths.test.ts               # 011 cancelWorkItem/cancelOrder guarded
    ├── adminOverride.test.ts
    └── audit.test.ts                     # every FR-029 step writes an AuditEvent
```

**Structure Decision**: Single Next.js project (matching 001/002/010–014). A new
`src/server/changes/**` module mirrors `src/server/production/**`: one file per responsibility, a
barrel as the only import surface enforced by a new `eslint.config.js` `no-restricted-imports`
rule, and guards registered as a barrel side effect as in 013's `review/index.ts`. Dependency
direction:

- `changes` imports only the `core`, `auth`, `db`, and `review` barrels, plus the shared
  `~/server/aspects` composition root.
- `orders` and `production` import the `changes` barrel.
- `changes` never imports `orders` or `production`. The one needed helper (effective department)
  is duplicated as a one-liner (research §8), which avoids a cycle.
- 051, 052, and 054 depend on `changes`' published contracts, never the reverse.

## Post-Design Constitution Check

*Re-evaluated after research.md, data-model.md, and contracts/ were written.*

| Principle | Design evidence | Result |
|---|---|---|
| I | `SpecVersion.workItemId`, `ChangeRequest.workItemId`, and `LateCancellation.workItemId @unique` are all FKs to `WorkItem`. There is no order-level spec (data-model.md) | PASS |
| II | Hold guards on `IN_PRODUCTION → PRODUCTION_COMPLETED | REWORK_REQUIRED`, plus the resume check (research §5). The approval `updateMany where status=PENDING` makes a request decidable exactly once (§13). `JOB_LEFT_PRODUCTION` refusal (§13). Pricing reset atomic via in-tx listeners (§9). The self-exemption is limited to the exact `changeRequestId` in `meta` | PASS |
| III | Append-only guards on `SpecVersion` (REVOKE DELETE + trigger) and `LateCancellation` (REVOKE). `ChangeRequest` has no delete path and decided fields are written only once (guarded `updateMany`). Backfill never updates `WorkItem.updatedAt` or existing audit rows. The mirror columns are written only together with a new version | PASS |
| IV | No file writes. `Return` is created with no attachments | PASS (N/A) |
| V | contracts/change-control.md authorization table: every command has permission plus scope, checked inside the transaction after loading state. `editSpec` in `IN_PRODUCTION` → `CHANGE_REQUEST_REQUIRED` (integration test T034 in tasks.md). Guards protect 011's cancel paths and 014's complete/send-back without trusting callers | PASS |
| VI | `change.approve` assignment is seed data, editable in 001's Admin. Recipients via `usersWithPermission`. Currency is a `LateCancellation.currency` column defaulting to `"EGP"`, not a UI constant | PASS |
| VII | `DirectCostPort` has a default no-op. The listener registry is empty by default. Neither blocks 016 | PASS (N/A) |
| VIII | No AI | PASS (N/A) |
| IX | `<SpecDiff>` shows changed fields only, with Arabic labels from `ar.json` and logical CSS properties. The approver detail page puts the diff above the decision buttons (SC-005) | PASS |
| Quality gate: schema | Additive DDL only. Idempotent backfill with a zero-row verification query and runtime self-heal. Rollback is "redeploy previous build, tables remain". Deviation (`db push`) recorded below | PASS with justified deviation |

No new violations were introduced by the design. The single deviation is the project-wide one
below.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Schema is delivered with `prisma db push` plus `prisma/manual-sql/*.sql`, not a Prisma migration (constitution quality gate: "MUST ship as Prisma migrations") | The project's migrations stop at `20260923160000_orders_reception`. 012, 013, and 014 all applied their schema with `db push`, and `manual-sql/audit-event-append-only.sql` documents that practice. A lone 016 migration on top of a drifted migration history would fail `migrate deploy` against any real database | Writing a migration only for 016 would give a false sense of compliance, since it cannot apply cleanly. Re-baselining all migrations is a project-wide task for the schema owner (Fady/001), not this feature. 016 keeps the constitution's *intent*: additive-only DDL, idempotent SQL checked into the repo, and an explicit data-preservation plan (data-model.md) |

## Cross-team contracts (Track B / Fady must agree)

These are listed in full in [contracts/events-and-ports.md](./contracts/events-and-ports.md):

1. **051 Pricing**: register a `SpecChangeListener` at module load that sets an already-priced Work
   Item's pricing status to `PENDING` using the **provided `tx`** and never opens its own
   transaction. It may veto only with `fail({ code: "SPEC_CHANGE_VETOED", … })`, which rolls back
   the change and returns a typed refusal. Any other throw rolls back as a 500. 051 owns an integration test
   against the real `approveChangeRequest`/`editSpec`/`adminOverrideSpec`.
2. **052 Finance**: implement `DirectCostPort.recordLateCancellationCost(tx, cost)` inside the
   provided `tx`. Source is traced as `{ sourceType: "LATE_CANCELLATION", sourceId }`. 052 must
   backfill from existing `LateCancellation` rows written while the no-op port was active.
3. **001 Identity**: add the `change.approve` key, seed it to `HEAD_DESIGNER` and `ADMIN_OWNER`,
   and update the role-permission matrix test.
4. **054 WhatsApp (future)**: may record change requests only through `createChangeRequest` (with
   an order-edit-holding actor). Customer confirmation over WhatsApp is out of scope for 016.
5. **Shared aspect layer (with 015, Track A)**: `src/server/core/aspects/**`,
   `src/server/aspects.ts`, the ESLint rule (c) exemption, and `src/instrumentation.ts` are shared.
   Whichever of 015 and 016 implements first creates them per contracts/aspects.md, and the other
   reuses them unchanged. Any change to the contract must update both copies.
6. **Schema**: new file `prisma/schema/change-control.prisma` and one nullable `WorkItem` column.
   The `db push` step is blocked on confirmation with the schema owner (tasks T002), as in
   012–014.
