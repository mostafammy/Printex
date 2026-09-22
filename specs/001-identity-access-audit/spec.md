# Feature Specification: Identity, Access & Audit

**Feature Branch**: `001-identity-access-audit`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "The security + traceability spine of Printex: who can log in, what each person is allowed to do, and an audit log that nobody can edit. Every other feature calls into this one's 3 functions (getActor, authorize, audit.record)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff log in and get exactly the access their role allows (Priority: P1)

A shop employee (e.g. a Designer) opens the app on a shared LAN workstation, signs in with the username and password an Admin issued them, and can then only see and use the screens/actions their role permits — attempting anything outside that role is blocked even if they try to call it directly.

**Why this priority**: Without login + enforced permission checks nothing else in the system is safe to build; every other feature (002's Order/WorkItem actions, future pricing/production/delivery features) depends on `getActor()`/`authorize()` existing and being trustworthy.

**Independent Test**: Seed one user per role, log in as each, and confirm each can perform their role's permitted actions and is rejected (FORBIDDEN) for actions outside it — testable with no other feature's UI built yet, purely against server actions.

**Acceptance Scenarios**:

1. **Given** an Admin-created account with username `designer1` and role Designer, **When** `designer1` logs in with the correct password, **Then** a session is created and `getActor()` resolves to an Actor with role `DESIGNER` and the `design.work`/`design.review`-scoped permission set from the seeded matrix.
2. **Given** a logged-in Designer actor, **When** a server action calls `authorize(actor, "pricing.set_variable")` directly (bypassing any UI), **Then** the call throws/rejects with a `FORBIDDEN` error and nothing is written.
3. **Given** no session cookie or an expired session, **When** `getActor()` is called, **Then** it throws/rejects `UNAUTHENTICATED`.
4. **Given** a user enters the wrong password 1-4 times, **When** they then enter the correct password, **Then** login succeeds normally (lockout threshold is 5, see FR-004).

---

### User Story 2 - Admin manages who has access without touching the database (Priority: P1)

An Admin/Owner creates new staff accounts, assigns roles and departments, deactivates people who leave, resets forgotten passwords, and can immediately kill an active session (e.g. a terminated employee) — all from in-app screens, never a raw SQL console.

**Why this priority**: Printex has no self-signup and no email-based recovery (LAN, no internet) — the Admin screens are the *only* way accounts get created or fixed, so the shop is unusable on day one without them.

**Independent Test**: As a seeded Admin user, create a new account, assign it a role and a department, deactivate it, and confirm the deactivated user's active session is rejected on their very next request — testable end-to-end against the admin screens alone.

**Acceptance Scenarios**:

1. **Given** an Admin on the Users screen, **When** they create a user with a username, initial password, one or more roles, and department(s), **Then** the new user can log in with that username/password and `getActor()` reflects the assigned roles/departments.
2. **Given** an Admin deactivates an active user who currently has an open session, **When** that user's browser makes its next request, **Then** the request is rejected as `UNAUTHENTICATED` (session revoked, not merely "will expire eventually").
3. **Given** an Admin force-logs-out a user (without deactivating them), **When** that user's browser makes its next request, **Then** it is rejected as `UNAUTHENTICATED`, but the account itself remains active and they can log in again.
4. **Given** an Admin attempts to delete a user, **When** they look at the Users screen, **Then** no delete action exists — only deactivate/reactivate (users are never hard-deleted, PRD §55 Rule 8).
5. **Given** an Admin attempts to delete a department that has users or history attached to it, **When** they look at the Departments screen, **Then** no delete action exists — only add/rename/deactivate (departments are never deleted).

---

### User Story 3 - Every sensitive change leaves a tamper-proof trail Admin can review (Priority: P2)

An Admin reviewing a dispute ("who changed this order's price?") opens the Audit Log, filters by entity/actor/action/date range, and inspects one event to see exactly what changed (before/after) and why — with confidence that nobody, including another Admin working directly in the database, could have altered or deleted that record after the fact.

**Why this priority**: This is the traceability half of the feature's mandate and what makes every other feature's writes legally/operationally defensible, but it is less immediately blocking than login/authorization (P1) — the shop can open with login+roles working and audit viewing added right after, though the underlying `audit.record()` write path and the database-level append-only enforcement must exist from day one since other features call into it.

**Independent Test**: Perform a handful of actions (create user, deactivate user, change a role), then open the Audit Log, filter to just those events, open one, and confirm the before/after diff matches what actually happened — and separately, attempt a raw `UPDATE`/`DELETE` against the audit table and confirm the database itself rejects it.

**Acceptance Scenarios**:

1. **Given** an Admin creates a new user, **When** they open the Audit Log and filter by action `user.created`, **Then** they see one event with the correct actor, timestamp, and an `after` snapshot containing the new user's username/roles/departments.
2. **Given** any row in the `AuditEvent` table, **When** a database client issues `UPDATE audit_event SET ... WHERE id = ...` or `DELETE FROM audit_event WHERE id = ...` directly against Postgres (not through the app), **Then** the database rejects the statement — append-only is enforced at the database level, not just in application code.
3. **Given** a failed login attempt, **When** the Admin filters the Audit Log by action `login.failure`, **Then** the attempt appears with the attempted username and timestamp (no password is ever stored).
4. **Given** an Admin uses an override capability (e.g. `admin.override`) to force a change another role couldn't make, **When** the change is applied, **Then** an audit event is written that includes the Admin's supplied reason — an override without a reason is rejected.

---

### Edge Cases

- What happens when two Admins try to deactivate the same user at nearly the same moment? The second deactivation is a no-op (user is already inactive) and both actions are independently audited; no error surfaces to either Admin.
- How does the system handle a role being changed for a user who has an open session? The permission change takes effect on their next `getActor()` call within that session (no forced re-login required, since sessions are resolved server-side per request) — the existing session is not itself revoked by a role change (only deactivation/force-logout revoke sessions).
- What happens when a production operator with no department assigned tries to operate on a work item? They are `FORBIDDEN` for any department-scoped permission check — a user must have at least one department to pass a department-scoped `authorize()` call.
- What happens when a user is deactivated while mid-request (a race between deactivation and an in-flight action)? Whichever transaction commits second wins normally at the database level; the deactivated user's *next* request after their session is revoked is rejected regardless of what completed just before.
- What happens when the audit `before`/`after` payload would contain a password or other secret? Password hashes and any secret fields are never included in `before`/`after` snapshots — callers of `audit.record()` are responsible for excluding sensitive fields before passing them.
- What happens if someone attempts to log in with a username that does not exist? The system returns a generic "invalid username or password" failure (never reveals whether the username exists) and still writes a `login.failure` audit event with the attempted username.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: System MUST let a staff member log in using a username and password (no email, no self-signup — Admin creates every account per FR-010).
- **FR-002**: System MUST NOT offer email verification, OAuth/SSO, or self-service password reset via email (the LAN has no internet access); a forgotten password is reset by an Admin only (FR-013).
- **FR-003**: System MUST create a session on successful login that remains valid for approximately one work shift (12 hours) from login, and MUST reject any request using an expired session as `UNAUTHENTICATED`.
- **FR-004**: System MUST lock an account out of further login attempts for 15 minutes after 5 consecutive failed password attempts, and MUST audit every failed attempt (`login.failure`) and every successful one (`login.success`).
- **FR-005**: System MUST let a logged-in user explicitly log out, immediately invalidating their session server-side.
- **FR-006**: System MUST let an Admin force-logout a specific user (revoking their active session immediately, without deactivating the account) and MUST let an Admin deactivate a user (which also immediately revokes all of that user's active sessions).
- **FR-007**: A revoked or otherwise invalid session MUST be rejected on the very next request that relies on it — not just after some delay or cache expiry.

**Authorization**

- **FR-008**: System MUST expose `getActor(): Promise<Actor>` returning `{ userId, roles, permissions, departmentIds }` for the current session, and MUST reject (`UNAUTHENTICATED`-equivalent) when there is no valid session.
- **FR-009**: System MUST expose `authorize(actor, permission, scope?)` that rejects (`FORBIDDEN`-equivalent) whenever the actor's permission set does not include the requested permission, or — when `scope.departmentId` is given — whenever the actor is not a member of that department. Every business feature's server actions MUST call `authorize()` themselves; a hidden or disabled UI button is never treated as sufficient enforcement (PRD §61 Rule E).
- **FR-010**: System MUST support exactly the following permission keys, matching PRD §26/§48: `order.create`, `order.edit`, `order.cancel`, `customer.manage`, `workitem.assign_designer`, `design.work`, `design.review`, `production.operate`, `collection.receive`, `delivery.record`, `pricing.use_fixed`, `pricing.set_variable`, `pricing.override`, `payment.record`, `payment.void`, `expense.record`, `finance.view`, `files.download_production`, `audit.view`, `admin.users`, `admin.config`, `admin.override`.
- **FR-011**: System MUST seed exactly the 7 roles defined in PRD §48 — Reception, Designer, Head Designer, Production Operator, Print Reception/Delivery, Accounting, Admin/Owner — as named bundles of the FR-010 permission keys, with the role×permission matrix exactly matching PRD §48's table (see Assumptions for the resolution of the "Pricing Officer" naming question).
- **FR-012**: System MUST let a user hold more than one role simultaneously, with their effective permission set being the union of all assigned roles' permissions plus any per-user extra permissions (FR-014).
- **FR-013**: Business logic MUST NOT branch on a user's name or on a hard-coded role identifier (e.g. `if (user.role === "ADMIN")`) — every authorization decision MUST go through `authorize()` checking a permission key (PRD §61 Rule F).
- **FR-014**: System MUST let an Admin grant a specific user permissions beyond what their role(s) already include (e.g. one Accounting user gaining `pricing.set_variable` without making pricing a shop-wide Accounting default) — per PRD §26's requirement that pricing authorization be explicitly configurable per user, not implied by a role name alone.

**Users, Roles & Departments (Admin)**

- **FR-015**: System MUST let an Admin create a user (username, initial password, one or more roles, one or more departments where relevant), list users, deactivate/reactivate a user, and reset a user's password. System MUST NOT provide any way to permanently delete a user record (PRD §55 Rule 8).
- **FR-016**: System MUST model Department as data (a table), not a hard-coded enum, seeded initially with Digital, Banner, Outdoor, Laser, External (already seeded by 002's dev seed script; this feature owns the Department model's definition going forward). Admin MUST be able to add or rename a department and deactivate it, but MUST NOT be able to delete one (PRD §61 Rule G).
- **FR-017**: System MUST scope Production Operator-type permission checks (e.g. `production.operate`) to the departments the acting user is a member of — a user with no department membership fails any department-scoped `authorize()` call.
- **FR-018**: System MUST provide an Admin-only Roles screen showing the role×permission matrix (read-only view of the seeded matrix is sufficient for this feature; editing the matrix itself is out of scope — see Assumptions).

**Audit**

- **FR-019**: System MUST expose `audit.record(tx, event)` accepting `{ action, entityType, entityId, before?, after?, reason?, attachmentIds? }`, callable inside a caller-supplied Prisma transaction (`tx`) exactly like 002's `transitionWorkItem` already assumes for its own audit-equivalent writes.
- **FR-020**: System MUST persist every `audit.record()` call as a row including actor, action, entityType, entityId, `before`/`after` as full JSON snapshots (not diffs — see Assumptions), optional reason, optional attachment ID references (not the files themselves — file storage is 050's concern), timestamp, and the request's IP/user-agent when available.
- **FR-021**: System MUST enforce, at the database level (a Postgres trigger or a `REVOKE UPDATE, DELETE` on the audit table), that no `UPDATE` or `DELETE` against stored audit events can ever succeed — including when issued directly against Postgres outside the application (constitution III).
- **FR-022**: System MUST audit these authentication/administration events in addition to any business-feature events: `login.success`, `login.failure`, `logout`, `user.created`, `user.deactivated`, `user.reactivated`, `role.changed`, `password.reset`.
- **FR-023**: System MUST provide an Admin-only Audit Log viewer that filters by entity type, entity ID, actor, action, and a date range, and that can open a single event to show its `before`/`after` values as a diff.
- **FR-024**: Any use of an override-class permission (`admin.override`, `pricing.override`, `payment.void` when used to reverse another user's entry) MUST require the acting Admin/authorized user to supply a reason, and MUST itself produce an audit event carrying that reason — an override attempted without a reason is rejected before any change is applied.

**Integration with 002**

- **FR-025**: System MUST replace 002's ambient `declare function getActor(): Promise<Actor>` stub in `src/server/auth/index.ts` with a real implementation using the same call shape, so that 002's existing `transitionWorkItem` and shell layout code continue to compile and run unchanged against the real implementation.
- **FR-026**: System MUST implement login using Better Auth's username plugin (Better Auth's default user model requires an email; this feature's login MUST NOT require staff to have an email address).

### Key Entities *(include if feature involves data)*

- **User**: A staff member's account — username (unique), password hash, display name, active/inactive flag, timestamps. Never hard-deleted. Better Auth's `User` model, extended with a username field via its username plugin; already present in `prisma/schema/identity.prisma` from 002's scaffolding.
- **Session**: A logged-in browser's active login — belongs to one User, has an expiry (~12h from creation), can be revoked (force-logout, deactivation, explicit logout). Better Auth's `Session` model.
- **Role**: A named, seeded bundle of permission keys (Reception, Designer, Head Designer, Production Operator, Print Reception/Delivery, Accounting, Admin/Owner). Data, not an enum baked into business logic.
- **UserRole**: Join between User and Role — a user may hold several roles at once.
- **Permission**: One of the 21 fixed keys in FR-010 (a closed set for this feature, not a user-editable table — adding a new key is a code change, not an admin action).
- **UserPermission**: A per-user grant of one extra Permission beyond what their Role(s) already include (FR-014); supports the "pricing users must be explicitly configurable" requirement.
- **Department**: A named organizational scope (Digital, Banner, Outdoor, Laser, External, ...) — data, not an enum; already modeled by 002, whose model definition this feature now owns.
- **UserDepartment**: Join between User and Department — scopes department-sensitive permission checks (e.g. Production Operator work).
- **AuditEvent**: An immutable record of one sensitive action — actor (User), action (string key like `user.created`), entityType, entityId, `before`/`after` JSON snapshots, optional reason, optional attachment ID references, createdAt, IP/user-agent. Append-only enforced at the database level; the only way rows are ever added is via `audit.record()` inside the same transaction as the change it documents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user attempting any server action outside their role's permissions is rejected 100% of the time, verified by an automated test matrix covering every seeded role against every one of the 21 permission keys (the seeded role×permission matrix exactly equals PRD §48's table, verified by a snapshot test).
- **SC-002**: A deactivated or force-logged-out user's very next request after that action is rejected as `UNAUTHENTICATED` — verified with zero tolerance for delay (not "eventually," not "after cache expiry").
- **SC-003**: Zero audit events are ever modifiable or deletable after being written — verified by an automated test that attempts direct SQL `UPDATE`/`DELETE` against the audit table and asserts the database itself rejects it.
- **SC-004**: An Admin can create a new fully-working staff account (login + correct role/department access) in under 1 minute using only the in-app Users screen, with no database access required.
- **SC-005**: 100% of the 8 authentication/administration event types listed in FR-022 produce a corresponding audit event under automated test, with correct actor/action/entity attribution.
- **SC-006**: A production operator scoped only to one department is rejected (`FORBIDDEN`) when a permission check is scoped to a different department, verified by an automated test.

## Assumptions

- **Role naming resolved against PRD, not the original feature brief**: PRD §48 "Role Model" defines exactly 7 roles (Reception, Designer, Head Designer, Production Operator, Print Reception/Delivery, Accounting, Admin/Owner) and contains no separate "Pricing Officer" role. PRD §26 "Pricing Permissions" instead describes pricing authorization as an explicitly configurable *permission*, not a role bucket ("Pricing users should be explicitly configurable rather than assuming that every accountant or manager can modify pricing"). This spec therefore seeds 7 roles (matching PRD §48 exactly) and implements "Pricing Officer"-style access as the `pricing.set_variable`/`pricing.override` permissions granted per-user via `UserPermission` (FR-014) — most naturally to Accounting users who need it, per PRD §26's own framing — rather than inventing an 8th role unsupported by the PRD.
- Editing the role×permission matrix itself (i.e., an Admin UI to add/remove which permissions a role grants) is out of scope for this feature; the matrix is seeded from PRD §48 and changing it is a code change, not a runtime admin action. Only per-user extra permissions (FR-014) are runtime-configurable.
- Login identifier is username (not phone or email) — some staff have no email, and the shop has no internet to email a magic link or verification code.
- Password lockout is 5 failed attempts within a rolling window, followed by a 15-minute lockout — a reasonable default balancing brute-force resistance against a shared shop workstation where staff sometimes mistype.
- Session length is ~12 hours (one work shift) with no separate idle timeout tracked in this feature — simplest model that matches how the shop actually works (one login per shift).
- A user may hold multiple roles simultaneously, with permissions taking the union — matches real shop staffing where e.g. one person may cover both Reception and Print Reception/Delivery duties.
- Audit `before`/`after` are stored as full JSON snapshots (not diffs), and audit rows are retained forever (no automated purge/retention policy) — simplest and most defensible for a traceability feature; storage volume is not a concern at this shop's scale.
- Attachment files referenced by an audit event's `attachmentIds` are stored by feature 050 (file storage); this feature only stores the ID references, never the files themselves.
- Department deactivation (not deletion) is sufficient for departments that stop being used; no feature currently needs to reassign users away from a deactivated department automatically, so that reassignment (if ever needed) is a manual Admin action outside this spec's scope.
