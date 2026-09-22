# Research: 001-identity-access-audit

## Decision: Password hashing

**Decision**: Use Better Auth's built-in credential handling (scrypt via `better-auth`'s internal hasher) rather than rolling a custom bcrypt/argon2 integration.

**Rationale**: Better Auth is already the project's auth library (constitution: Technology constraints name it explicitly) and its email/password provider already implements a vetted password hash+verify path. Introducing a second hashing library duplicates a security-sensitive surface for no benefit.

**Alternatives considered**: `bcrypt`/`argon2` directly — rejected as unnecessary duplication; Better Auth already does this correctly and is the mandated stack.

## Decision: Username-only login (no email) via Better Auth's username plugin

**Decision**: Enable Better Auth's `username` plugin. `User.email` remains a required column (Better Auth's core schema assumes it), populated with a synthetic, never-shown placeholder (`{username}@local.invalid`) at account-creation time; `emailVerified` stays `false` permanently and is never surfaced or checked.

**Rationale**: Spec FR-001/FR-002/FR-026 require login with no email and no email verification (LAN has no internet). Better Auth's core `User` model hard-requires an `email` field at the schema level, but the username plugin lets authentication itself run entirely on `username`+`password`, ignoring email. A synthetic placeholder avoids a schema fork while guaranteeing nothing user-facing ever depends on it.

**Alternatives considered**: Forking/patching Better Auth's core schema to drop `email` — rejected, too invasive and fragile against future Better Auth upgrades; storing real staff emails — rejected, not required by spec and adds a data point to maintain for no use.

## Decision: Session length & lockout implementation

**Decision**: Session `expiresAt` set to `now + 12h` at creation (Better Auth's configurable session `expiresIn`). Failed-login lockout (5 attempts → 15 min) is tracked via two new columns on `User`: `failedLoginAttempts Int @default(0)`, `lockedUntil DateTime?`, checked/incremented in the credential-login hook before Better Auth's own verify step.

**Rationale**: Matches FR-003/FR-004 exactly; Better Auth's session config natively supports a fixed `expiresIn`, and lockout state needs to persist across requests so two plain columns on `User` are the simplest correct model (no separate table needed since only the latest attempt count/lock matters, per constitution VI's "don't over-model").

**Alternatives considered**: A separate `LoginAttempt` audit-style table for lockout state — rejected as over-engineering; the audit trail already gets `login.failure` events (FR-022) for history, so lockout only needs current-state counters, not a full log.

## Decision: Force-logout / deactivation session revocation

**Decision**: Force-logout deletes the target user's `Session` rows (or all but keeps a revoked marker — deletion is simpler and matches "kills session," no reason to keep a revoked session row around). Deactivation sets `User.isActive = false` AND deletes all of that user's `Session` rows in the same transaction. `getActor()` additionally re-checks `isActive` on every call (not just at session-creation time), so even a session Better Auth itself considers valid is rejected the instant `isActive` flips, closing the race in Edge Cases.

**Rationale**: Satisfies FR-006/FR-007/SC-002's "next request, not eventually" requirement — relying on Better Auth's own session cache/expiry alone wouldn't guarantee this, since session validity is normally checked only against `expiresAt`. Re-checking `isActive` per-request on the User row is what makes revocation instantaneous.

**Alternatives considered**: A session-side `revokedAt` flag instead of deletion — functionally equivalent but adds a state to keep synchronized for no query benefit here, since nothing ever needs to read a revoked session back.

## Decision: Permission set representation & role storage

**Decision**: `Role` and `RolePermission` are real tables (roles are data — constitution VI), seeded once from the fixed PRD §48 matrix via a Prisma seed script extension, not a runtime-editable UI in this feature (per spec Assumptions: matrix editing is out of scope). `Permission` itself stays a fixed TypeScript union of the 21 keys (FR-010) rather than a DB table, since the *set* of possible permission keys is a code-level contract every feature imports, not admin-configurable data — this mirrors 002's `WorkItemState`/`ALLOWED_EDGES` pattern (fixed code-level enums, but role↔permission *assignment* is DB data).

**Rationale**: Matches constitution VI ("Roles MUST be modeled as permission scopes... not enums or code branches") for the *role→permission mapping*, while keeping the permission *vocabulary* itself a compile-time-checked union so every feature's `authorize(actor, "pricing.override")` call is typo-proof (matches how 002 froze `WorkItemState` for the same typo-safety reason).

**Alternatives considered**: Permission keys also as a DB table — rejected; nothing in this feature or its consumers needs to add a permission key without a code change (a new permission always implies new business logic checking it), so DB-modeling it adds an indirection with no runtime benefit.

## Decision: Database-level append-only enforcement for `AuditEvent`

**Decision**: A Postgres `REVOKE UPDATE, DELETE ON audit_event FROM <app_role>` migration, applied as a raw SQL migration step after the table is created, rather than a trigger.

**Rationale**: `REVOKE` is simpler, has zero runtime overhead, and is exactly as unconditional as a trigger for this use case (this feature has no legitimate "conditional" UPDATE/DELETE path to allow) — a trigger would only add value if some conditional exception were ever needed, which the spec explicitly rules out (FR-021: *no* update/delete, period). The app's Postgres connection role must be a non-superuser role for `REVOKE` to bind (documented as a deployment prerequisite, since a superuser bypasses all grants).

**Alternatives considered**: `BEFORE UPDATE OR DELETE` trigger raising an exception — equivalent protection but more code to maintain and test for no additional guarantee here; kept as a documented fallback if the deployment's Postgres role setup can't guarantee non-superuser app access.

## Decision: `Department` model ownership vs. physical schema-file location

**Decision**: `Department` stays physically defined in `prisma/schema/core.prisma` (where 002 already put it, since `WorkItem.departmentId` references it) rather than being moved to `identity.prisma`. This feature (001) becomes the *feature* that owns Department's admin CRUD (add/rename/deactivate) and the `UserDepartment` join, but does not relocate the model file.

**Rationale**: Prisma's multi-file schema (`prismaSchemaFolder`) makes physical file location a non-issue for relations — `WorkItem.department` and the new `UserDepartment.department` both resolve fine regardless of which file `model Department` lives in. Moving it would be a pure-churn diff (touching 002's already-merged, tested code) for zero functional benefit, and constitution/spec ownership is a *feature-responsibility* concept, not a *file-location* one.

**Alternatives considered**: Moving `Department` into `identity.prisma` to match the original brief's phrasing literally — rejected as unnecessary churn on merged 002 code; the brief's intent (001 owns Department's lifecycle operations) is fully satisfied without a file move.

## Decision: Audit `before`/`after` typing at the `audit.record()` boundary

**Decision**: `audit.record()` accepts `before?: unknown, after?: unknown` (matching the frozen contract in Linear PRI-5 and 002's own precedent for `meta?: Record<string, JsonValue>` on `transitionWorkItem`), and internally narrows/serializes to Prisma `Json` at the write. Callers are responsible for excluding secrets (spec Edge Cases) before calling.

**Rationale**: `audit.record()` is called by every future feature with wildly different entity shapes; a generic `unknown` boundary (same pattern 002 already established for `meta`) keeps the contract stable without needing a shared "auditable shape" type that would couple every consumer to this feature's internals.

**Alternatives considered**: A generic `Record<string, JsonValue>` constraint — rejected as slightly more restrictive than needed and inconsistent with how flexible `before`/`after` snapshots need to be (e.g. arrays of line items), without adding real safety since JSON-serializability is what actually matters and is enforced at the Prisma write, not the TS boundary.
