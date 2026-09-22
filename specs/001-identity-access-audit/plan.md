# Implementation Plan: Identity, Access & Audit

**Branch**: `001-identity-access-audit` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-identity-access-audit/spec.md`

## Summary

Build the security and traceability spine every other Printex feature depends on: username/password
login (Better Auth's username plugin, no email/self-signup), server-enforced fine-grained
permissions (21 fixed keys, 7 seeded roles matching PRD §48 exactly, per-user extra grants),
Department lifecycle ownership, Admin screens (users/roles/departments), and a database-level
append-only `AuditEvent` log with an Admin viewer. Technical approach: extend the Better Auth
`User`/`Session` models 002 already scaffolded with lockout/deactivation columns, add `Role`/
`RolePermission`/`UserRole`/`UserPermission`/`UserDepartment`/`AuditEvent` tables, and replace 002's
ambient `getActor()` stub in `src/server/auth` with a real implementation plus a new `authorize()`
and `audit.record()`, both frozen contracts every future feature imports.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js (project's existing Next.js runtime)

**Primary Dependencies**: Next.js (App Router), Better Auth (+ username plugin), Prisma ORM,
PostgreSQL, Zod, Tailwind CSS — all already established by 002, no new framework/ORM/auth mechanism
introduced (constitution Technology constraints).

**Storage**: PostgreSQL via Prisma, multi-file schema (`identity.prisma` for new identity/RBAC
tables + `AuditEvent`; `core.prisma`'s existing `Department` unchanged — see research.md).

**Testing**: Vitest (unit + integration + contract), matching 002's existing suite structure —
`tests/unit`, `tests/integration`, `tests/contract`.

**Target Platform**: Local LAN Next.js server (constitution VII: no internet dependency).

**Project Type**: Web application (single Next.js repo, existing `src/app`/`src/server` layout).

**Performance Goals**: `authorize()` and `getActor()` are called on every authenticated request —
both MUST resolve from already-loaded session/user data with no additional query beyond the one
session+user(+roles+permissions) load per request; no N+1 permission lookups.

**Constraints**: LAN-only, no internet-dependent auth flow (no OAuth/SSO/email verification/email
password reset — spec Out of Scope). Session length ~12h. Lockout after 5 failed attempts / 15 min.

**Scale/Scope**: Single shop, tens of staff accounts, not hundreds — permission/role tables are
small, fully cacheable per-request without needing a dedicated cache layer.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Compliance |
|---|---|
| I. Order → Work Item canonical model | N/A to this feature — no Order/WorkItem changes. |
| II. Business gates are inviolable | N/A directly, but this feature is the mechanism every gate's permission check depends on. |
| III. History is append-only | Core requirement of this feature — `AuditEvent` is append-only at the DB level (FR-021), and every sensitive mutation this feature introduces (user create/deactivate, role change, login events) writes an audit event (FR-022). |
| IV. Files are immutable, private versions | N/A — no file storage in this feature (attachment IDs only, by reference). |
| V. The server is the only authority | Core requirement — `authorize()` is the server-side gate every feature must call (FR-009); `getActor()` re-validates `isActive` per-request, not just at login. |
| VI. Configuration over hard-coding | Roles/departments are data (`Role`/`RolePermission` tables), never a code branch on role name (FR-013). Permission *keys* remain a fixed code-level union — justified in research.md as matching 002's `WorkItemState` precedent (a fixed vocabulary every feature imports, not admin-editable data). |
| VII. Local-first, isolated integrations | Login/session/audit all run fully on the local server; no external dependency introduced. |
| VIII. AI is optional and assistive | N/A — no AI surface in this feature. |
| IX. Arabic-first, task-oriented UX | Admin screens (users/roles/departments/audit) and the login page follow the existing RTL shell 002 established (`dir="rtl"`, logical Tailwind properties, IBM Plex Sans Arabic). |

**Gate result**: PASS. No principle violations; Complexity Tracking table below is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-identity-access-audit/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── auth.md          # Actor, getActor, authorize
│   └── audit.md         # audit.record
└── tasks.md             # Phase 2 output (/speckit-tasks — not this command)
```

### Source Code (repository root)

```text
prisma/schema/
├── identity.prisma      # EXTENDED: User (+ username/isActive/lockout columns), Session (unchanged),
│                         #           Account/Verification (unchanged); NEW: Role, RolePermission,
│                         #           UserRole, UserPermission, UserDepartment, AuditEvent
└── core.prisma           # UNCHANGED (Department stays here — research.md)

prisma/
└── seed.ts               # EXTENDED: seed the 7 roles × permission matrix (data-model.md), one
                           #           Admin/Owner dev user

src/server/
├── auth/
│   ├── index.ts           # REPLACES 002's ambient getActor() stub — real getActor, authorize,
│   │                       # audit.record (barrel export, same pattern as core/index.ts)
│   ├── permissions.ts      # Permission union (21 keys), RoleKey union (7 keys)
│   ├── getActor.ts         # Session/user/role/permission resolution
│   ├── authorize.ts        # Permission + department scope check
│   ├── audit.ts             # audit.record(tx, event)
│   ├── lockout.ts           # Failed-attempt counter + lockedUntil check, called from the
│   │                        # Better Auth credential hook
│   └── better-auth.config.ts  # EXTENDED: username plugin, session expiresIn=12h, credential hook
│                               # wiring lockout.ts
└── admin/
    ├── users.ts             # Server actions: create/deactivate/reactivate/reset-password/assign
    ├── roles.ts             # Server action: read-only role×permission matrix view
    └── departments.ts       # Server actions: add/rename/deactivate department

src/app/(shell)/admin/
├── users/page.tsx
├── roles/page.tsx
├── departments/page.tsx
└── audit/page.tsx

src/app/(auth)/login/page.tsx   # Login screen (outside the authenticated shell)

tests/
├── unit/{permissions,lockout}.test.ts
├── integration/{getActor,authorize,audit-record,session-revocation}.test.ts
└── contract/{role-permission-matrix,audit-append-only}.test.ts
```

**Structure Decision**: Extends 002's existing hexagonal layout — `src/server/auth/**` is the new
framework-light module (analogous to `src/server/core/**`'s barrel-export pattern) that every other
feature imports from; `src/server/admin/**` holds this feature's own Server Actions (not imported by
other features, unlike `auth/**`); `src/app/(shell)/admin/**` and `src/app/(auth)/login/**` are the
Next.js adapter/UI layer, matching 002's `(shell)` route-group convention.

## §5 Architecture & Design Patterns

### 5.1 Layering

`src/server/auth/**` sits at the same architectural tier as `src/server/core/**`: framework-light,
importable by every feature, exporting exactly what `contracts/auth.md` and `contracts/audit.md`
document (via a barrel `index.ts`, mirroring `core/index.ts`'s module-boundary discipline). Unlike
`core`, `auth` is allowed to depend on Better Auth and Prisma directly (session/credential handling
inherently needs them), but it MUST NOT depend on any other feature's `src/server/<feature>/**`
module — the ESLint module-boundary rule 002 established extends to treat `src/server/auth/**` the
same as `src/server/core/**` for this purpose.

`src/server/admin/**` (the Users/Roles/Departments server actions) is a normal feature module, one
tier above `auth` — it calls `authorize()` like any other feature would, it does not get special
access.

### 5.2 Design patterns

| Pattern | Where | Why |
|---|---|---|
| Strategy | `authorize()`'s permission-set membership check | Same shape as 002's guard registry — a single check function, swappable membership source (role ∪ per-user grants) without callers knowing the union happened. |
| Fixed union + branded IDs | `Permission`, `RoleKey` unions; `UserId` reused from `~/server/core` | Mirrors 002's `WorkItemState`/`ids.ts` precedent — compile-time typo safety for a vocabulary every feature imports. |
| Repository-light data access | `getActor.ts` | One Prisma query (session → user → roles → role-permissions, plus user-permissions) assembled into the `Actor` shape; no separate repository abstraction layer, since this feature has exactly one read shape to serve (consistent with 002's decision not to add a repository layer for a single-consumer query). |
| Outbox-adjacent, not applied here | — | Unlike 002's `NotificationEvent` outbox, audit writes are synchronous inside the caller's `tx` (constitution V: same-transaction requirement) — no outbox/eventual-consistency pattern applies to `audit.record()`. |
| Fail-closed guard | `authorize()`, `getActor()` | Both throw/reject by default on any ambiguous state (missing session, inactive user, missing permission) rather than defaulting to allow — matches 002's `transitionWorkItem`'s "nothing written until proven valid" posture. |

### 5.3 Error handling & the one necessary deviation from `core`'s no-throw rule

`src/server/core/**` never throws (`Result<T, DomainError>` everywhere) with two narrow, documented
exceptions (`StorageAdapter` implementations, and `transitionWorkItem`'s post-write reject path —
see 002's plan.md §5.3). `src/server/auth/**` is a **third**, equally narrow exception, by design
rather than oversight: `getActor()` and `authorize()` are called at the very top of every server
action, before any `Result`-returning `core` call — mirroring 002's own stub, which already declares
`getActor(): Promise<Actor>` as a rejecting promise, not a `Result`-returning one. Forcing these two
functions into `Result` would mean every single server action in the codebase re-implements the same
"check `.ok`, map to the same `UNAUTHENTICATED`/`FORBIDDEN` response" boilerplate that a thrown error
plus one shared `try/catch`-based Server Action wrapper avoids. `audit.record()`, by contrast,
follows the *storage-adapter* exception precedent exactly (a `tx`-scoped write whose rejection
should propagate to abort the transaction, same as `LocalDiskStorageAdapter`'s throwing methods) —
not a new category, the same one.

### 5.4 Type safety

`Actor.permissions` is `ReadonlySet<Permission>`, not `Permission[]` — membership checks are O(1)
and the type system statically forbids passing a raw string. `RoleKey` and `Permission` are separate
unions (a role key is never accidentally compared against a permission key, and vice versa) even
though both happen to be uppercase-with-dots-or-underscores strings — this asymmetry is intentional:
nothing in the codebase should ever need `RoleKey === Permission` structural interchangeability.

### 5.5 Performance & scalability

One query per request for `getActor()` (session join user join roles/role-permissions join
user-permissions — a handful of small joins against tables with at most dozens of rows each, per
Scale/Scope above); no caching layer needed at this scale. `authorize()` itself does zero I/O (pure
`Set.has()` + array `.includes()` against the already-loaded `Actor`).

### 5.6 Barrel export surface (`src/server/auth/index.ts`)

Re-exports exactly: `Actor`, `Permission`, `RoleKey`, `getActor`, `authorize`, `audit` (with
`.record`) — the same disciplined "nothing more than contracts/*.md documents" rule 002's
`core/index.ts` established, enforced by the same ESLint module-boundary pattern extended to this
directory.
