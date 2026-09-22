<!--
Sync Impact Report
==================
Version change: (unversioned template) → 1.0.0
Bump rationale: Initial ratification — all placeholders replaced with project-specific governance.

Principles defined (template slots → new titles):
  [PRINCIPLE_1_NAME] → I. Order → Work Item Is the Canonical Model
  [PRINCIPLE_2_NAME] → II. Business Gates Are Inviolable
  [PRINCIPLE_3_NAME] → III. History Is Append-Only
  [PRINCIPLE_4_NAME] → IV. Files Are Immutable, Private Versions
  [PRINCIPLE_5_NAME] → V. The Server Is the Only Authority
  Added             → VI. Configuration Over Hard-Coding
  Added             → VII. Local-First, Isolated Integrations
  Added             → VIII. AI Is Optional and Assistive
  Added             → IX. Arabic-First, Task-Oriented UX

Sections:
  [SECTION_2_NAME] → Technology, Data & Security Constraints
  [SECTION_3_NAME] → Development Workflow & Quality Gates
  Governance       → filled

Removed sections: none

Source: "Printex Print Shop Management System — Product Requirements Document V1.md"
(§§ 2, 6, 12, 15, 40–46, 52–56, 58, 60, 61).

Templates: not modified (scope guard). plan-template.md's "Constitution Check" reads this
file at runtime; no template edits required.

Deferred TODOs: none.
-->

# Printex Constitution

## Core Principles

### I. Order → Work Item Is the Canonical Model

- Every customer request, whatever its channel (walk-in, WhatsApp, phone, returning customer,
  direct-to-designer, urgent), MUST exist in the system as an Order before production work begins.
- Every Order MUST belong to a Customer or to the built-in Cash Customer record.
- Every Work Item MUST belong to exactly one Order. Work Items are the unit of design, review,
  pricing, production, timing, and discrepancy tracking.
- Order status MUST be derived from its Work Items' states, never stored as an independently
  editable value.
- Grouped and separate modes MUST share one workflow; grouping is a presentation and packaging
  concern and MUST NOT remove per-Work-Item traceability.
- Features MUST NOT invent parallel workflows or alternate "source of truth" objects (folders,
  invoices, chat threads).

**Rationale**: The core business problem is losing sight of a job as it moves between departments.
A single, consistent object model is what makes "Where is this order now?" answerable.

### II. Business Gates Are Inviolable

- Work Items requiring design review MUST pass Head Designer approval before production; a
  Designer MUST NOT approve their own work.
- Delivery MUST NOT be finalized while required pricing is unresolved. Production MAY proceed
  while pricing is pending, and pricing status MUST be tracked independently of production status.
- Every rejection MUST record actor, timestamp, origin category, and explanation, and MUST notify
  the responsible Designer.
- Urgent priority MAY reorder queues but MUST NOT bypass review, pricing-before-delivery,
  permission checks, or audit logging.
- No implementation shortcut, feature flag, seed script, or admin convenience path may bypass a
  gate. Admin overrides MUST be explicit actions that are themselves audited with a reason.

**Rationale**: Today, work is produced and delivered before it is priced or reviewed. The gates
are the product; weakening them for convenience reintroduces the original failure.

### III. History Is Append-Only

- Every significant mutation (status transitions, assignments, priority, specification, pricing,
  payments, expenses, files, discrepancies, cancellations, deliveries) MUST write an audit event
  containing actor, action, entity, entity ID, timestamp, and previous/new values and reason where
  applicable.
- Audit events MUST be append-only; no application code path may update or delete them.
- Normal users MUST NOT hard-delete operational records. Removal MUST be modeled as
  Archive, Void, or Supersede, with an audit event.
- Edits MUST be state-aware: specification changes before production are audited edits; after
  production starts they require a change/rework workflow; after completion they require explicit
  administrative action. The original specification MUST remain retrievable.
- Every payment MUST create a transaction record; every production discrepancy and its
  compensation/resolution MUST be recorded.
- Durations MUST be computed from persisted timestamps (queue, active, total per phase) so timers
  survive refreshes and restarts; client-side stopwatches are display only.

**Rationale**: Untraceable edits and deletions are an explicit pain point, and historical data
(rework origin, waste, phase durations) is what powers future analytics.

### IV. Files Are Immutable, Private Versions

- Uploading a changed file MUST create a new version; existing versions, especially approved ones,
  MUST NEVER be overwritten in place.
- Each version MUST store version number, file name, type, size, checksum, uploader, timestamp,
  and associated note/action. Version history is owned by the application, not the storage backend.
- Binary content MUST go through a storage abstraction (local filesystem first; S3-compatible or
  other backends later) with metadata in the database. Business logic MUST NOT depend on folder
  paths or file names as identifiers.
- Files MUST be private by default and served only through application-authorized access or
  short-lived signed URLs. Permanently public URLs are prohibited. External share links, if
  provided, MUST expire.

**Rationale**: Manual Windows folders and overwritten files are what the system replaces.

### V. The Server Is the Only Authority

- Permissions, pricing calculation, state transitions, payment rules, gate enforcement, and audit
  writing MUST execute on the server. The frontend MAY mirror rules for UX but MUST NOT be trusted.
- Every server entry point (route handler, server action, API procedure) MUST authenticate the
  caller and authorize by role, department, and record scope before acting.
- All external and client input MUST be validated with a schema (Zod) at the server boundary.
- A state transition and its audit event MUST commit in the same database transaction.
- Work Item transitions MUST go through a single, centralized transition function that validates
  the allowed from→to edge and required preconditions; ad hoc status writes are prohibited.

**Rationale**: Production operators and reception must be controlled, and bugs in scattered
client-side checks would silently undermine every gate above.

### VI. Configuration Over Hard-Coding

- Roles MUST be modeled as permission scopes. Business logic MUST NOT reference individual
  employees by name or ID.
- Production departments (Digital, Banner, Outdoor, Laser, External, …) MUST be data configured by
  Admin, not enums or code branches.
- Price lists, customer-specific rules, quantity tiers, effective dates, pricing-authorized users,
  delay thresholds, notification recipients, rejection categories, and message templates MUST be
  configurable data.

**Rationale**: The business will add departments and change staff, pricing, and policies without
code changes.

### VII. Local-First, Isolated Integrations

- The core system (orders, workflow, files, customers, payments, accounting entry, reports,
  timers) MUST run fully on a local LAN server with no Internet dependency.
- The local server MUST NOT be exposed to the public Internet. WhatsApp and any other external
  service MUST connect through a separately hosted integration gateway that syncs with the local
  application over a secured channel.
- External integrations MUST NOT be tightly coupled to core state: an integration outage MUST NOT
  block any core workflow, and failed outbound actions MUST be queued/retried, not lost.
- The local application remains the source of truth for Orders, Customers, Staff, and history.
- Client-side database replication or eventual-consistency sync MUST NOT be introduced in V1
  unless operational testing proves it necessary and the constitution is amended.

**Rationale**: The shop must keep working when the Internet is down, and the internal server holds
sensitive operational data.

### VIII. AI Is Optional and Assistive

- The system MUST remain fully operational with all AI services disabled.
- AI output (designer suggestions, pricing estimates, delay predictions, anomaly flags) MUST be
  clearly labeled, editable, and explainable, and MUST NOT become authoritative without an
  explicit human action. AI pricing MUST be labeled "AI Estimate".
- Designers MUST NOT be auto-assigned in V1 unless explicitly enabled by configuration.

**Rationale**: AI is a Phase 2 enhancement, not a hidden dependency of the core workflow.

### IX. Arabic-First, Task-Oriented UX

- The UI MUST be Arabic-first and fully RTL; layouts MUST use logical (start/end) properties so
  direction is never hard-coded.
- Screens MUST be organized around "What do I need to do next?" — queues, clear ownership, and
  large obvious status indicators — rather than raw database entities.
- Order creation MUST support a Quick Create path that records a job in seconds; secondary data
  MAY be completed later.
- Features SHOULD minimize clicks and avoid ERP-style complexity; any added step MUST be justified
  in the feature spec.

**Rationale**: This is an internal operational tool used under time pressure by non-technical staff.

## Technology, Data & Security Constraints

- **Stack**: TypeScript (strict), Next.js (App Router), React, Prisma ORM with PostgreSQL,
  Better Auth, Tailwind CSS, Zod, pnpm. Introducing a new framework, ORM, datastore, or auth
  mechanism requires justification in the plan's Complexity Tracking table.
- **Money**: Monetary values MUST use exact decimal types (Prisma `Decimal`), never floating
  point. Currency defaults to EGP.
- **Time**: Timestamps MUST be stored in UTC and rendered in the shop's local timezone.
- **Secrets**: Secrets MUST live in environment configuration validated at startup, never in source
  control.
- **Security**: Authentication, session management, role- and department-based access control,
  and private file access are mandatory for every feature.
- **Backups**: Database, file objects, file metadata, audit logs, and configuration MUST be backed
  up to a location other than the primary server. Any feature adding a new persistent store MUST
  include it in the backup scope.
- **Scope**: V1 builds the MVP scope in PRD §58. Phase 2 items (inventory, customer portal/QR
  tracking, payroll, advanced accounting, AI features, multi-branch) MUST NOT be built in V1 unless
  a spec explicitly pulls them in; V1 data models SHOULD NOT preclude them.

## Development Workflow & Quality Gates

- Features follow the Spec Kit flow: specify → clarify → plan → tasks → implement. The PRD is the
  product source of truth; specs MUST cite the PRD sections they implement.
- Every `plan.md` MUST pass the Constitution Check against Principles I–IX before design and again
  after design; violations MUST be justified in Complexity Tracking or removed.
- `pnpm check` (lint + typecheck) MUST pass before a change is considered done.
- Automated tests are REQUIRED for: Work Item state transitions and forbidden transitions,
  business gates (review, pricing-before-delivery, urgent-no-bypass), permission checks per role,
  pricing rule resolution, audit event emission, and file versioning. Tests for gates and
  permissions MUST exercise the server path, not only UI logic.
- Database schema changes MUST ship as Prisma migrations; destructive migrations on operational or
  audit tables require explicit approval and a data-preservation plan.
- Code review MUST verify no hard deletes, no ungated transitions, and no client-side authority.

## Governance

- This constitution supersedes conflicting practices, conventions, and task instructions. Where it
  conflicts with the PRD, the conflict MUST be raised and resolved by amending one of them — never
  by silently diverging in code.
- Amendments are made via `/speckit-constitution`, MUST include a Sync Impact Report, and MUST be
  approved by the project owner.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle, MINOR for
  adding a principle or materially expanding guidance, PATCH for clarifications and wording.
- Compliance is reviewed at every plan's Constitution Check, during `/speckit-analyze`, and in code
  review. Any justified exception MUST be documented in the relevant plan's Complexity Tracking.

**Version**: 1.0.0 | **Ratified**: 2026-09-22 | **Last Amended**: 2026-09-22
