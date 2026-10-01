# Research: Order Production Workflow (Phase 0)

All NEEDS CLARIFICATION items from the spec were resolved by owner decision on 2026-09-30 (see spec Clarifications). This document records the resulting technical decisions.

## R-01 Canonical width rounding

- **Decision**: One pure server function `resolveProductionWidth(customerWidthCm)` over the ordered configured set [80,110,150,210,260,270,320]; returns the first value ≥ input; inputs ≤0 / non-numeric / >320 rejected with typed errors (`INVALID_WIDTH` / `WIDTH_ABOVE_MAXIMUM`). Frontend never reimplements; it calls the server quote preview.
- **Rationale**: Deterministic, single-tested, satisfies every example in the spec (75→80 … 271→320, 320→320).
- **Alternatives considered**: DB check-constraint-only enforcement (rejected: error UX poor, logic still duplicated in app); per-ProductType table from day one (rejected: only one roll class needs it now — table is config keyed by product class so it generalizes without code change).

## R-02 Height cap 50 m

- **Decision**: Configurable `maxHeightM = 50` for the roll product class; server Zod validation `0 < heightM ≤ 50`; units canonical metres for height, cm for widths, m² for area.
- **Rationale**: Owner correction of the 3 m statement; 50 m covers banner rolls while still bounding absurd input. Configurable per Constitution VI.
- **Alternatives considered**: No cap (rejected: unbounded area → unbounded totals); hard-coded 3 m (rejected: contradicted by owner).

## R-03 Above-maximum width exception

- **Decision**: Width >320 cm → `WIDTH_ABOVE_MAXIMUM` + creation of an audited `WidthExceptionTicket` (workItemId, requestedWidth, reason, requestedBy, status PENDING/APPROVED/REJECTED, decidedBy/decidedAt). The work item stays in reception until a manager approves; approval does not auto-pick 320.
- **Rationale**: Satisfies "never silently clamp" + traceability; reuses Return/audit patterns.
- **Alternatives considered**: Silent clamp to 320 (rejected by spec); freeform custom width without approval (rejected: breaks production-width guarantees).

## R-04 Pricing as 051 extension, not a fork

- **Decision**: Base 80–120 EGP/m² range enforced as a validation rule on the roll product class; Sulfan 90 EGP/m² seeded as one `FinishingService` row; quote math `area = prodWidthM × heightM × qty`, `base = area × baseRate`, `finishing_i = area × rate_i`, `total = base + Σ` in Decimal with whole-EGP final rounding; every accepted quote persists a `WorkItemPrice` + JSON breakdown snapshot (rates frozen per item).
- **Rationale**: Reuses 051 quote/history/delivery-gate semantics; historical orders immune to list changes; finishing table generalizes to future services.
- **Alternatives considered**: Separate totals columns recomputed from live lists (rejected: rewrites history); hard-coded `if (sulfan)` branches (rejected: violates VI and blocks extension).

## R-05 Pipeline mapped onto WorkItemState (no new enum)

- **Decision**: Milestone mapping — Reception: NEW→ASSIGNED (assignment gate); Designer: ASSIGNED→IN_DESIGN→DESIGN_COMPLETED (file gate); Accountant: DESIGN_COMPLETED→WAITING_PRICING→(APPROVED-priced); Printer: READY_FOR_PRODUCTION→IN_PRODUCTION→PRODUCTION_COMPLETED. There is **no branding/content stage**. ROLL-class items are created with the existing `requiresReview = false` flag so 013's WAITING_REVIEW step is skipped; every other ProductType keeps Head Designer review unchanged. Forbidden edges (DESIGNER→PRINTER, RECEPTION→PRINTER) do not exist in the transition table.
- **Rationale**: Satisfies "no duplicate status system", reuses 012/013/014/015/051 guards, timers, and queues, and expresses the review skip as configuration rather than a new code path.
- **Alternatives considered**: New `PipelineStage` enum column (rejected: dual source of truth, violates Constitution I); deleting 013 review entirely (rejected: other product classes still need it); hard-coding "skip review for banners" in the transition function (rejected: violates Constitution VI).

## R-06 Single transition function

- **Decision**: Extend existing `transitionWorkItem(tx, {workItemId, to, actor, reason, meta})` with pipeline guards (assignment present, file version present, pricing/approval present, role/scope check) + audit write in the same transaction. All UI/server entry points call it; direct `update({state})` on WorkItem is banned (code review + test asserting no other writer).
- **Rationale**: Constitution V compliance; makes bypass attempts structurally impossible rather than UI-hidden.
- **Alternatives considered**: Per-stage server actions each writing state (rejected: scattered authority, bypass-prone).

## R-07 Supabase as StorageAdapter backend

- **Decision**: New `SupabaseStorageAdapter implements StorageAdapter` (put/get/exists/stream + signed preview via Supabase signed URLs capped at 300 s, private bucket, RLS deny-all + service-role server access). 050 FileObject/FileVersion/Attachment semantics unchanged; checksum still computed server-side on stream; temp-object sweeper retained. Secrets via env validated at startup; backup scope (091) extended to Supabase objects + metadata export.
- **Rationale**: Honors Q1=B while preserving Principle IV guarantees and the 050 contract surface (`files.upload/listVersions/markApproved/getDownloadUrl/void/archive`).
- **Alternatives considered**: Direct Supabase client calls from UI/components (rejected: breaks server authority + RLS); parallel Supabase-only file tables (rejected: duplicates 050).

## R-08 No branding/content stage

- **Decision**: Removed entirely per owner follow-up 2026-09-30. Accountant approval routes the item directly to printer/production for the ROLL class; `requiresReview = false` is set at item creation. Returns still use the shared Return model (origin + ACCOUNTING_ISSUE/DESIGN_ISSUE categories as appropriate), and 013's review remains intact for non-ROLL ProductTypes.
- **Rationale**: Matches how the shop actually operates; no phantom stage, no invented role, no code branch.
- **Alternatives considered**: Reusing Head Designer as branding (rejected — business confirmed the stage does not exist); new branding role (rejected — same reason).

## R-09 Role/queue scoping matrix

- **Decision**: Reception sees all-new + own-created; Designer sees assigned-only; Accountant sees DESIGN_COMPLETED with file; Head Designer sees WAITING_REVIEW; Printer sees READY_FOR_PRODUCTION+ in own department only. Enforced in both list queries and single-record `authorize` checks.
- **Rationale**: Mirrors 012/014 scoping precedents; UI hiding is presentation only.

## R-10 Decimal + audit + migration safety

- **Decision**: Prisma Decimal(10,2) dimensions / Decimal(12,2) money; Zod decimal-string coercion at boundary; area/totals computed server-side only. Additive Prisma migration: new nullable/spec columns + new tables; backfill maps existing states onto milestones and freezes current computed totals as snapshots; no destructive DDL on operational/audit tables.
- **Rationale**: Constitution money/time/history rules + zero-downtime migration.
