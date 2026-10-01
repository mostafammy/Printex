# Implementation Plan: Order Production Workflow

**Branch**: `093-order-production-workflow` | **Date**: 2026-09-30 | **Spec**: [specs/093-order-production-workflow/spec.md](specs/093-order-production-workflow/spec.md)

**Input**: Feature specification from `/specs/093-order-production-workflow/spec.md`

## Summary

Extend the canonical Order → Work Item model with a four-stage production pipeline (Reception → Designer → Accountant → Printer) enforced by one server transition function. Add a canonical width round-up service over [80,110,150,210,260,270,320] cm, production-area Decimal pricing (base 80–120 EGP/m² + extensible finishing incl. Sulfan 90), a Supabase StorageAdapter backend behind the existing 050 file contract, role-scoped queues, and append-only audit. No duplicate status enum, no hard-coded rates, no client-side authority.

## Technical Context

**Language/Version**: TypeScript 5.8 strict, Next.js 15 App Router, React 19

**Primary Dependencies**: Prisma 6 (schema folder), PostgreSQL + pg, Better Auth + @auth/prisma-adapter, Zod, Tailwind 4, pnpm 12, Supabase storage client (new, server-side only)

**Storage**: PostgreSQL (operational + audit + file metadata) + Supabase Storage private bucket (file bytes, primary per Q1=B decision); opaque storageKeys only, no path semantics

**Testing**: vitest 5 (unit + contract + integration + server-path bypass tests), `pnpm check` (lint + typecheck) required, `pnpm test:pricing` pattern reused for pricing/rounding suites

**Target Platform**: Internal LAN Next.js server + hosted Supabase project; Arabic-first RTL UI

**Project Type**: Web application (backend server modules + frontend queues/cards)

**Performance Goals**: Single-item quote <250 ms p95; pricing queue first page <500 ms p95; queue opens show next action <10 s; reception create→assign <60 s (spec SC-007)

**Constraints**: Server-only authority (all transitions/pricing/auth server-side, Zod at boundary, transition+audit in one tx); Decimal money end-to-end, whole-EGP final rounding; append-only audit; no hard deletes (Void/Archive/Supersede); private files via app routes or ≤5-min signed URLs; 013 Head Designer review skipped for ROLL class via `requiresReview = false` (config flag, not a code branch)

**Scale/Scope**: Single print shop; 5 pipeline stages; one roll-product class for width table + 80–120/Sulfan rates; multi-item orders with per-item progression and derived order status

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] I. Order → Work Item canonical — extended, not duplicated. Pipeline milestone derived from WorkItem.state; no parallel status column. PASS.
- [x] II. Business gates inviolable — designer-assignment gate, file-upload gate, accountant-approval gate, delivery pricing gate preserved. ROLL-class items skip the 013 Head Designer review via the existing `requiresReview=false` per-item flag (owner-decided); that gate still applies to every other ProductType. No bypass path including admin convenience. PASS with recorded exception.
- [x] III. History append-only — transitions, price snapshots, file versions, returns, exceptions all append-only with actor/timestamps/before-after/reason. PASS.
- [x] IV. Files immutable private versions — 050 contract preserved (new version on replace, checksum, private + signed preview). Only backend changes. PASS.
- [x] V. Server only authority — single `transitionWorkItem` extension, Zod validation, auth by role/department/scope, one-tx audit. PASS.
- [x] VI. Configuration over hard-coding — width table, 80–120 range, Sulfan 90, 50 m cap, departments, permissions are seed/config data. PASS (see Complexity Tracking for why a code-level canonical table constant mirrors config).
- [ ] VII. Local-first — VIOLATION (justified, owner-decided Q1=B): Supabase becomes primary byte store. Requires constitution amendment + 050 revision + backup scope update. Recorded in Complexity Tracking.
- [x] VIII. AI optional — no AI in scope. PASS.
- [x] IX. Arabic-first task UX — queues per role, RTL logical properties, Quick Create preserved, rounding explanation (requested → production) prominent. PASS.

Post-design re-check: no new violations introduced; VII amendment remains the single exception, and the ROLL review-skip is recorded under Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/093-order-production-workflow/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── transitions.md
│   ├── pricing-rounding.md
│   ├── files-supabase.md
│   └── queues.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
└── storyboard.md        # Stakeholder-facing walkthrough (plain language)
```

### Source Code (repository root)

```text
src/
├── app/                          # role queues + job cards (RTL)
│   ├── reception/                # order entry, rounding preview, assign designer
│   ├── designer/                 # my queue, upload tied to completion
│   ├── accountant/               # verification + approval → printer
│   └── production/               # printer/department queue, approved-file-only
├── server/
│   ├── core/                     # transitionWorkItem extension + pipeline guards
│   ├── orders/                   # creation + dimension validation + assignment gate
│   ├── pricing/                  # width rounding, area, finishing, quote snapshot
│   ├── files/                    # StorageAdapter + new supabase backend
│   ├── production/               # printer queue scoping + vendor records reuse
│   └── review/                   # 013 review reuse only for non-ROLL classes
├── components/                   # PricingPanel, FilePanel reuse, dimension preview
└── lib/                          # decimal helpers, width table config loader

prisma/
├── schema/                       # additive models (production-spec, finishing, exceptions)
└── migrations/

tests/
├── unit/                         # rounding, area, totals
├── contract/                     # transition + pricing + files contracts
└── integration/                  # full pipeline + bypass attempts
```

**Structure Decision**: Web-application layout reusing existing `src/server/{core,orders,pricing,files,production,review}` modules plus role routes under `src/app`. No new top-level service; Supabase arrives as one new `StorageAdapter` backend file, not a parallel file system.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| VII local-first → Supabase primary (Q1=B, owner-decided) | Owner mandates Supabase as primary byte store for this workflow | Keeping local-only filesystem disobeys the explicit business decision; a dual-write without amendment would silently diverge from the constitution |
| 050 "no S3/Supabase in V1" scope | Same mandate; 050 must be revised to allow a Supabase StorageAdapter backend | Re-implementing a parallel upload path outside the 050 contract would duplicate versioning/checksum/auth and violate Principle IV |
| Code-level canonical width table mirror | Rounding must be deterministic and testable in one pure function; config remains the source of truth and the function loads/validates against it at startup | Scattering the table across UI components guarantees drift between displayed and persisted production widths |
| II design-review gate skipped for ROLL class (owner-decided) | The business confirmed there is no branding/content stage: accountant approval routes directly to print for roll products | Keeping a Head Designer review step the business does not perform would make items wait on a nonexistent role and block production; the existing `requiresReview` flag expresses this as configuration instead of a new code branch |
