# Feature Specification: Order Production Workflow

**Feature Branch**: `093-order-production-workflow`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Expand order-management and production workflow: reception enters customer width/height/price/finishing, system rounds width UP to fixed production widths [80,110,150,210,260,270,320cm], validates height (max 50m), prices by production area × base price (80–120 EGP/m²) + extensible finishing (Sulfan 90 EGP/m²), enforces strict state-driven pipeline RECEPTION→DESIGNER→ACCOUNTANT→PRINTER with designer assignment gate, design-file-upload gate, accountant-approval gate, backend-enforced transitions, role scoping, audit, and full edge-case handling."

**PRD References**: Printex PRD V1 (§§ 2, 6, 12, 15–18, 24–28, 39–46, 52–56, 58); Constitution I–IX.
**Related Specs**: 001-identity-access-audit, 002-core-domain-shell, 010-customers, 011-orders-reception, 012-designer-assignment-timers, 013-review-rework, 014-production, 015-collection-delivery, 016-change-control, 050-files, 051-pricing, 052-finance, 053-notifications.

## Clarifications

### Session 2026-09-30

- Q1 storage backend → B: Supabase is primary file storage for this workflow. Requires Constitution VII amendment (local-first) + 050 revision (which excludes S3/Supabase in V1) and backup/auth rework. 050 file contracts (immutable versions, checksum, private access, signed previews, no hard delete) still apply; only the StorageAdapter backend changes.
- Q2 branding/content → A: No new Branding role. Branding/content review reuses the existing 013 Head Designer approval (a designer MUST NOT approve their own work) and the shared Return model.
- Q3 width/height exceptions → A with correction: widths > 320 cm are rejected + audited manager-exception ticket (never silently clamped); height maximum is 50 m (configurable, not hard-coded), replacing the earlier 3 m statement.
- Follow-up 2026-09-30: no Branding/Content stage exists. For the ROLL product class in scope, accountant approval routes directly to printer/production (READY_FOR_PRODUCTION). The 013 Head Designer review is bypassed for this class only, which requires `requiresReview = false` on those items — otherwise it would violate Constitution II (see Assumptions).

## Current System Understanding (analysis input, not new behavior)

Architecture: TypeScript strict, Next.js App Router, React, Prisma + PostgreSQL, Better Auth, Tailwind, Zod, pnpm. Server is the only authority (Constitution V); transitions go through one centralized function with audit in the same transaction; money uses Prisma Decimal; files via local-first StorageAdapter abstraction (050) with immutable versions, checksums, private access.

Canonical model: Order → Work Item (Constitution I). Order status is derived from Work Items, never stored independently. Work Items are the unit of design, review, pricing, production, timing.

Existing workflow (002/011/012/013/014/015/016): reception creates Order + Work Items (011, Quick Create); designer assignment + phase timing (012); Head Designer review/approval with Returns/rework (013); production routing to configurable departments with timers and approved-file-only downloads (014); collection/delivery gated on pricing resolved (015, 051); spec changes via change control (016). Pricing (051) is an independent status (PENDING/PRICED/DISPUTED) with price lists, customer rules, tiers, quote breakdown, and a delivery gate — production MAY proceed while pricing is pending. Files (050) are local-first, versioned, private, signed-preview 5 min, archive/void never delete.

Conflicts with the request that this spec resolves by extension rather than duplication:
- Requested linear Order statuses (RECEPTION_PENDING→…→PRINTER_PENDING) MUST NOT become a second status system. They map onto existing Work Item states + a production-pipeline milestone derived from them.
- Requested reception price 80–120 EGP/m² and Sulfan 90 EGP/m² MUST NOT hard-code a competing pricing engine. They become configured price-list/finishing data consumed through 051's quote path.
- Requested "Supabase storage" is a DECIDED primary backend (Session 2026-09-30, Q1=B). It requires amending Constitution VII (local-first) and revising 050 (which excludes Supabase in V1) before plan: implement a Supabase StorageAdapter backend behind the existing 050 contract, preserve version/checksum/private/signed-URL/audit semantics, and extend backup scope (091) to cover Supabase objects + metadata.
- Requested "Branding/Content" is REMOVED (follow-up 2026-09-30): no such stage exists. For the ROLL class, the pipeline is RECEPTION → DESIGNER → ACCOUNTANT → PRINTER. No Head Designer approval, no extra review queue for this class.
- Requested fixed width table + 50 m height max are new ProductType constraints (Session 2026-09-30, Q3); heights above 50 m are rejected, widths above 320 cm go to audited manager exception.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reception creates a priced, designer-assigned job (Priority: P1)

Receptionist creates an order for a customer (or Cash Customer), adds a work item with customer-requested width, height, base price per m², and finishing services. The system shows requested width → production width (rounded up), production area, base price, finishing cost, and final total before submission. Reception assigns a designer; only then can the item leave reception.

**Why this priority**: Entry is the funnel for everything downstream; wrong dimensions or unassigned work stall the whole shop.

**Independent Test**: Create items with widths 75, 80, 81, 145, 150, 151, 250, 265, 271, 320 cm and confirm production widths 80, 80, 110, 150, 150, 210, 260, 270, 320, 320 cm, both values stored, area uses production width, totals match area × rates, and submission without a designer is refused server-side.

**Acceptance Scenarios**:

1. **Given** a new work item with customer width 145 cm and height 2 m, **When** reception submits dimensions, **Then** the system stores customer_width 145 cm and production_width 150 cm and shows production area 3.00 m².
2. **Given** a valid item without an assigned designer, **When** reception attempts to release it from reception, **Then** the server refuses with a designer-required error and the item stays in reception.
3. **Given** production area 3 m², base price 100 EGP/m² and Sulfan selected, **When** the quote is computed, **Then** base total is 300 EGP, Sulfan total is 270 EGP, final total is 570 EGP, each with its stored per-m² rate.
4. **Given** a direct API call that skips the UI and tries to create an item directly in the designer or accountant queue, **When** the server validates it, **Then** it is refused and audited.

---

### User Story 2 - Designer completes work only by uploading the required file (Priority: P1)

The assigned designer sees the order in their personal queue, opens it, reviews details, performs the work, uploads the completed design file, and submits. The item stays in the designer stage until a valid file version exists.

**Why this priority**: The file gate is the core trust guarantee between design and finance/production.

**Independent Test**: As the assigned designer, attempt submit without a file (refused), upload a file then submit (moves to accountant), attempt submit twice, and attempt a direct DESIGNER→PRINTER call (all refused except the valid single completion).

**Acceptance Scenarios**:

1. **Given** an item in designer stage with no valid design file version, **When** the designer calls complete/submit, **Then** the server refuses with a file-required error and the stage does not change.
2. **Given** a successful upload owned by the assigned designer for that work item, **When** the designer completes the stage, **Then** the item moves to the accountant stage, recording designer, file version, and completion time in one transaction with an audit event.
3. **Given** a failed or partial upload, **When** completion is attempted, **Then** it is refused; no completion state referencing missing bytes is persisted.
4. **Given** the file is deleted or voided after completion but before accountant approval, **When** the accountant opens the item, **Then** the missing-file state is visible and approval is blocked until a valid version is restored.

---

### User Story 3 - Accountant verifies and approves straight to print (Priority: P1)

The accountant opens items waiting for financial review, sees customer info, both dimension sets, area, stored per-m² rates, totals, finishing, and the design file, then approves. Approval moves the item directly to the printer/production queue — there is no branding/content stage for this product class.

The accountant opens items waiting for financial review, sees customer info, both dimension sets, area, stored per-m² rates, totals, finishing, and the design file, then approves. Approval moves the item to branding/content review only.

**Why this priority**: Prevents unpriced or miscalculated work from reaching production/delivery (Constitution II).

**Independent Test**: Approve a complete valid item (→ printer/production queue with correct production data); attempt approval on an item with missing dimensions/pricing/file (refused).

**Acceptance Scenarios**:

1. **Given** a designer-completed item with valid dimensions, stored rates, computed totals, and design file, **When** an authorized accountant approves, **Then** the item moves directly to the printer/production queue with approver, timestamp, and audit event.
2. **Given** an item missing any required field (dimensions, rate, total, file), **When** the accountant attempts approval, **Then** the server refuses with the specific missing requirement.
3. **Given** an item not yet approved by the accountant, **When** the printer requests it, **Then** access is refused.

---

### User Story 4 - Printer receives only accountant-approved work (Priority: P2)

The printer/production department sees only items the accountant has approved, with production dimensions, finishing, and the design file. Items from reception, design, or unapproved stages never appear in the printer queue.

**Why this priority**: The printer is the last human step before committing materials and machine time, and must only ever work from accountant-approved jobs with the correct production data.

**Independent Test**: Approve a valid item and open the printer queue as an operator in that department (item present with production width, height, area, finishing, approved file); open the printer queue while an item is still in reception/design/accountant (item absent) and attempt to fetch it directly by ID (refused).

**Acceptance Scenarios**:

1. **Given** an accountant-approved item, **When** the printer opens their department queue, **Then** the item appears with production width, height, area, finishing, and the approved file.
2. **Given** an item in reception, design, or awaiting accountant approval, **When** the printer requests it by queue or direct ID, **Then** it is refused and no data is disclosed.
3. **Given** a printer job card, **When** the operator looks for a file, **Then** only the approved file version is offered, never a draft.

---

### User Story 5 - Controlled rework instead of silent backward jumps (Priority: P2)

When design, pricing, or content is wrong, authorized staff return the item through the shared Return model (origin + category + reason + actor + assignee + timestamp) rather than free-form status edits. Normal forward progression stays distinct from audited rework.

**Why this priority**: Undocumented backward moves destroy traceability and reintroduce the original failure of lost jobs.

**Independent Test**: Return an accountant-stage item to the designer with reason (Return created, item leaves accountant queue, designer notified); attempt an unauthenticated direct status write backward (refused).

**Acceptance Scenarios**:

1. **Given** an item needing correction, **When** an authorized user returns it with origin, category, explanation, and assignee, **Then** a Return record is created, the item transitions to the designated rework state, and all parties are notified.
2. **Given** a return form without a reason, **When** submitted, **Then** validation fails and the item does not move.

---

### Edge Cases

- Width exactly on a supported value (80→80, 150→150, 320→320) uses that value.
- Width between supported values rounds UP to the next value (81→110, 151→210).
- Width above 320 cm is rejected with an audited manager-exception ticket, never silently clamped to 320.
- Zero, negative, or non-numeric width is rejected at the server boundary.
- Missing, zero, negative, or non-numeric height is rejected; height above 50 m is rejected (configurable cap; see Assumptions).
- Base price below 80 or above 120 EGP/m² is rejected for this product class; stored per-item rate never changes retroactively when lists change.
- Missing designer blocks release from reception; unassigned items never appear as executable designer tasks.
- Designer submit with no file, failed/partial upload, double submit, or bypass attempt is refused server-side.
- File deleted/voided after upload blocks accountant approval; replacement creates a new version (never overwrites), re-stamps completion, and re-notifies.
- Designer or reception attempts to route an item to printer via UI or direct API are refused; only accountant approval reaches printer for this class.
- An item whose accountant approval is later revoked/returned follows the same rework path as any other correction.
- Order edited after accountant approval follows change control (016): audited edit before production, rework Return after production starts, admin action after completion; pricing resets to PENDING per 051 FR-020.
- Price changed after calculation creates a new append-only price record with reason; history is never mutated.
- Existing historical orders keep their stored rates/totals; migration assigns sensible states without recomputation.
- Multiple work items per order progress independently; order status derives from items; grouping never removes per-item traceability.
- Cancellation is modeled as Void/Cancel with reason + audit, never hard delete; reopening requires explicit authorized action with audit.
- Unauthorized role attempting any transition receives a permission refusal with no state change and no audit-event write for the refused pricing/mutation path per 051 conventions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store both `customer_width_cm` and `production_width_cm` on the work item; the customer value MUST never be overwritten by rounding.
- **FR-002**: System MUST compute `production_width_cm` server-side via one canonical rounding function over the fixed set [80, 110, 150, 210, 260, 270, 320] using round-up-to-nearest-equal-or-above semantics; frontends MUST display its result, never reimplement it.
- **FR-003**: System MUST reject customer widths ≤ 0, non-numeric, or above 320 cm with a validation error; above-maximum MUST create an audited manager-exception ticket, never silent clamping.
- **FR-004**: System MUST validate height server-side (positive, numeric, consistent unit in metres); height above the configured 50 m maximum MUST be rejected.
- **FR-005**: System MUST store dimensions in one documented canonical unit convention (cm for widths, m for heights, area in m²) and normalize consistently before area math.
- **FR-006**: System MUST compute billable production area as `production_width_m × height_m × quantity` using server-side Decimal arithmetic; customer width MUST NOT feed the area calculation.
- **FR-007**: System MUST store the selected `base_price_per_m2` (allowed 80–120 EGP/m² for this product class) on the work item at quote time so later list changes never rewrite history.
- **FR-008**: System MUST compute `base_total = area × base_price_per_m2` server-side and round only the final total per 051 (nearest whole EGP, Decimal intermediates).
- **FR-009**: System MUST model finishing/additional services as extensible configured data (code, label, per-m² Decimal rate, effective dates), not hard-coded branches; Sulfan ships as one seeded entry at 90 EGP/m².
- **FR-010**: System MUST compute each selected finishing as `area × finishing_rate`, sum `final_total = base_total + Σ finishing_totals`, and persist the breakdown snapshot with the price record.
- **FR-011**: System MUST require a designer assignment before any release from reception; unassigned items MUST NOT appear as executable designer tasks and any direct-queue-insertion attempt MUST fail server-side.
- **FR-012**: System MUST keep the item in designer stage until at least one valid design file version owned by that work item exists; completion without it MUST fail.
- **FR-013**: System MUST route designer completion exclusively to the accountant stage; DESIGNER→PRINTER or DESIGNER→BRANDING direct edges MUST NOT exist.
- **FR-014**: System MUST require accountant approval to come from an authorized accountant role, verify all required fields + file presence, and — for the ROLL product class in scope — route the item directly to printer/production; there MUST NOT be a branding/content stage for this class.
- **FR-015**: System MUST make only accountant-approved items visible and accessible in the printer/production queue; earlier-stage items MUST be invisible and refused by direct ID, and only the approved file version MUST be downloadable.
- **FR-016**: All stage transitions MUST execute through one authoritative server transition function that validates from→to edge, caller role/scope, required data, required file, and writes the transition + audit event in the same DB transaction; scattered status writes are prohibited.
- **FR-017**: System MUST scope visibility and actions per role (reception / designer-assigned-only / accountant / branding / printer-department-only) at query and single-record authorization layers, not only in UI.
- **FR-018**: File upload/completion MUST use the existing file contracts (immutable versions, checksum, uploader, timestamp, category) backed by the Supabase StorageAdapter; replacement MUST create a new version; void/archive require reason and never delete bytes.
- **FR-019**: System MUST emit append-only audit events for order created, designer assigned, file uploaded/versioned, designer completed, accountant approved, branding completed, sent-to-printer, file replaced, price set/changed, returns, cancellation, and exceptions, with actor/action/entity/timestamps/before-after/reason.
- **FR-020**: Post-accountant-approval edits MUST follow change-control/rework rules (audited edit vs. Return vs. admin action) and reset pricing to PENDING per 051 on accepted spec changes.
- **FR-021**: Cancellation/reopen MUST be explicit, authorized, reasoned, audited Void/Cancel actions, never hard deletes or silent backward jumps.
- **FR-022**: Rework/returns MUST use the shared Return model with origin, category, explanation, actor, assignee, timestamp, and notification to the responsible designer.
- **FR-023**: System MUST migrate existing orders additively with sensible mapped states and preserved rates/totals; destructive migrations on operational/audit tables are prohibited without explicit approval + preservation plan.
- **FR-024**: All money MUST use Decimal end-to-end; no JavaScript float may persist or authoritatively compute a total.
- **FR-025**: Pricing status MUST remain independent of production stage per 051/Constitution II; unresolved pricing MUST NOT block production but MUST preserve the 015 delivery gate.

### Key Entities

- **Work Item (existing, extended)**: gains customer_width_cm, production_width_cm, height + unit, computed area, stored base_price_per_m2, finishing selections + rates snapshot, computed totals, assigned designer, pipeline milestone, designer completion + file version refs, accountant approval, branding review state.
- **ProductionWidthTable**: configured ordered set [80, 110, 150, 210, 260, 270, 320] cm with round-up semantics and above-maximum exception path.
- **FinishingService**: configurable add-on (code e.g. SULFAN, localized label, per-m² Decimal rate, effective dates); Sulfan 90 EGP/m² is seed data.
- **PriceSnapshot**: append-only per-item record of area, rates, breakdown, actor, timestamp, source, reason (extends 051 WorkItemPrice).
- **PipelineTransition**: validated from→to edge with authorized roles, preconditions, audit event.
- **DesignSubmission**: file version link + uploader + timestamp + version history for the designer gate.
- **Review policy flag**: `requiresReview` on the Work Item (existing 011/012 field) decides whether the 013 Head Designer review applies; false for ROLL-class items so accountant approval goes straight to printer.
- **Return (existing, 013)**: origin, category, explanation, actor, assignee, timestamp for controlled rework.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Widths 75/80/81/145/150/151/250/265/271/320 cm resolve to 80/80/110/150/150/210/260/270/320/320 cm respectively, and any width above 320 cm is rejected or routed to manual exception — never clamped.
- **SC-002**: A 145 cm × 2 m item at 100 EGP/m² quotes base 300 EGP; with Sulfan selected the finishing is 270 EGP and final total 570 EGP, reproducibly on every surface.
- **SC-003**: 100% of reception-release attempts without a designer, designer completions without a valid file, any DESIGNER→PRINTER / direct-queue-insertion attempt, and any approval by a non-accountant fail server-side with no state change.
- **SC-004**: Printer queue contains only accountant-approved items; cross-stage direct access is refused 100% of the time, and 0 draft-file downloads are possible.
- **SC-005**: Every forward transition and every return/cancellation/exception produces an append-only audit event with actor, timestamps, before/after, and reason where required.
- **SC-006**: Historical orders retain their stored rates and totals after global list changes; no recomputation from mutable lists occurs.
- **SC-007**: Reception can create, price, and assign a job in under 60 seconds; each role can find its next actionable item in under 10 seconds from opening its queue.
- **SC-008**: All persisted money is Decimal-backed with whole-EGP final rounding; zero float-persisted totals.

## Assumptions

- Height maximum is 50 m per owner decision (Session 2026-09-30), configurable data — not hard-coded. Plan must verify DB constraints and ProductType rules against 50 m.
- Width table, 80–120 base range, and Sulfan 90 rate apply to the banner/roll product class in scope; other ProductTypes keep their 051 lists. All three are configurable seed data, not code constants, per Constitution VI.
- Canonical units: widths in cm, heights in m, area in m²; server normalizes before Decimal math (consistent with 051 cm/m normalization).
- Above-320 cm handling is reject + audited manager-exception ticket assigned to a manager/head role; the exception approval itself is audited with reason and never silently clamps.
- "Accountant" maps to 051/052 pricing/finance permissions; "Printer" maps to a 014 production department routing target. There is no branding/content stage.
- ROLL-class items MUST be created with `requiresReview = false` so the 013 Head Designer review gate is skipped by configuration, not by a special case in code. This is the one place the pipeline departs from Constitution II's design-review gate, and it applies only to this product class; every other ProductType keeps Head Designer review. If the business later wants review back for ROLL, it is a per-item flag change, not a code change.
- Supabase is the primary file backend for this workflow (Q1=B): bytes via Supabase Storage (private bucket, app-authorized access / short-lived signed URLs), metadata/version/audit in Postgres via the existing 050 contract; backup (091), secrets/env, and RLS/policies are reworked accordingly and Constitution VII is amended.
- Single item per story is illustrative; multi-item orders progress per item with derived order status.
- Cancellation/reopen and rework reuse 013/015/016 semantics; no new parallel lifecycle is introduced.

## Dependencies

- Consumes: 001 auth/audit/permissions; 002 transition + storage contracts; 010 customers; 011 order/work-item authoring; 012 assignment/timing; 013 returns/approval; 014 department routing; 015 delivery gate; 016 change control; 050 file versioning; 051 pricing quote/history/gates; 052 finance; 053 notifications.
- Provides: canonical width-rounding + area service, finishing configuration, pipeline transition edges, role-scoped queues, price snapshot breakdown, audit coverage for the five-stage path.
- Cross-contracts: 051 owns quote math/rounding/history; 050 owns bytes/versions/signed access; 013 owns Return; 016 owns post-approval edit policy.

## Notes for Planning

- Plan must include: state machine mapped onto existing Work Item states (no duplicate enum), data-model delta (additive Prisma migration), pricing/finishing config shape, Supabase StorageAdapter backend + RLS/policies + backup coverage, permission matrix (Head Designer owns branding review; designer cannot self-approve), single transition function, migration for existing orders, and server-path tests for every forbidden edge.
- Constitution Check (Principles I–IX) is required before and after design; the Supabase-primary decision (VII) and 050 revision MUST be recorded as an amendment + Complexity Tracking entry.
