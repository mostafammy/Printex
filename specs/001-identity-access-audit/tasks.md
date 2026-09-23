---
description: "Task list for Identity, Access & Audit feature implementation"
---

# Tasks: Identity, Access & Audit (001-identity-access-audit)

**Input**: Design documents from `/specs/001-identity-access-audit/` (`plan.md`, `spec.md`, `data-model.md`, `research.md`, `contracts/auth.md`, `contracts/audit.md`, `quickstart.md`)

**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `research.md`, `contracts/auth.md`, `contracts/audit.md`, `quickstart.md`

**Tests**: Required by specification and project constitution (SC-001, SC-002, SC-003, SC-005, SC-006). All tests are placed under their corresponding user story phase and MUST be written to fail before implementation begins.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing in priority order. Tests are mandatory — the constitution requires automated tests for permission checks, audit emission, and session revocation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`; omitted for Setup, Foundational, and Polish)
- Exact file paths from `plan.md` §Project Structure are specified in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Validate the existing project structure, extend environment configuration, and ensure the test harness is ready for identity/audit work before any schema or server code is written

- [x] T001 Verify `prismaSchemaFolder` is active and `prisma/schema/identity.prisma` (already scaffolded by 002) is included in the multi-file schema, confirming Better Auth's `User`/`Session`/`Account`/`Verification` models compile cleanly before extension
- [x] T002 [P] Extend environment variable schema validation in `src/env.js` to confirm `DATABASE_URL_TEST` is present for integration/contract tests and document the deployment prerequisite that the app's Postgres connection role is a non-superuser (required for the `REVOKE UPDATE, DELETE ON audit_event` migration to bind — see research.md)
- [x] T003 [P] Confirm Vitest integration test setup in `vitest.config.ts` supports real-Postgres tests against `DATABASE_URL_TEST`, matching the pattern already established by 002

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema extensions, the append-only migration, the Permission/RoleKey union type file, and the seed script extension — these MUST all be complete before any user story implementation can begin, because every story imports `permissions.ts` and depends on seeded roles

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Extend `prisma/schema/identity.prisma` with all new identity/RBAC/audit models in one migration, adding to the existing Better Auth `User` model the columns `username String @unique`, `displayUsername String?`, `isActive Boolean @default(true)`, `failedLoginAttempts Int @default(0)`, `lockedUntil DateTime?`, and the relations `roles UserRole[]`, `extraPermissions UserPermission[]`, `departments UserDepartment[]`, `auditEvents AuditEvent[]`, `grantedPermissions UserPermission[] @relation("PermissionGrantedBy")`; adding new models `Role` (`id`, `key String @unique`, `name`, `createdAt`, relations `permissions RolePermission[]` / `userRoles UserRole[]`), `RolePermission` (`id`, `roleId → Role`, `permission String`, `@@unique([roleId, permission])`), `UserRole` (`id`, `userId → User`, `roleId → Role`, `@@unique([userId, roleId])`), `UserPermission` (`id`, `userId → User`, `permission String`, `grantedById → User`, `createdAt`, `@@unique([userId, permission])`), `UserDepartment` (`id`, `userId → User`, `departmentId → Department` (cross-file relation from `core.prisma`), `@@unique([userId, departmentId])`), and `AuditEvent` (`id`, `actorId String? → User`, `action String`, `entityType String`, `entityId String`, `before Json?`, `after Json?`, `reason String?`, `attachmentIds String[]`, `ipAddress String?`, `userAgent String?`, `createdAt DateTime @default(now())`, indexes `@@index([entityType, entityId])` / `@@index([actorId, createdAt])` / `@@index([action, createdAt])`); run `pnpm exec prisma migrate dev` to apply (data-model.md, FR-010 through FR-020)
- [x] T005 Apply a raw-SQL migration step (separate from T004) that executes `REVOKE UPDATE, DELETE ON audit_event FROM <app_role>` against the application's Postgres role, enforcing database-level append-only access on `AuditEvent` independently of application code — as decided in research.md ("A Postgres `REVOKE UPDATE, DELETE ON audit_event FROM <app_role>` migration, applied as a raw SQL migration step after the table is created, rather than a trigger") to satisfy FR-021 and SC-003; document the non-superuser deployment prerequisite alongside this migration
- [x] T006 [P] Define the `Permission` union type (all 22 fixed keys from FR-010: `order.create`, `order.edit`, `order.cancel`, `customer.manage`, `workitem.assign_designer`, `design.work`, `design.review`, `production.operate`, `collection.receive`, `delivery.record`, `pricing.use_fixed`, `pricing.set_variable`, `pricing.override`, `payment.record`, `payment.void`, `expense.record`, `finance.view`, `files.download_production`, `audit.view`, `admin.users`, `admin.config`, `admin.override`) and the `RoleKey` union type (7 keys: `RECEPTION`, `DESIGNER`, `HEAD_DESIGNER`, `PRODUCTION_OPERATOR`, `PRINT_RECEPTION_DELIVERY`, `ACCOUNTING`, `ADMIN_OWNER`) in `src/server/auth/permissions.ts`; these are fixed code-level unions (not DB tables), mirroring 002's `WorkItemState` pattern for compile-time typo safety (data-model.md, research.md, plan.md §5.4)
- [x] T007 Extend `prisma/seed.ts` to seed the 7 roles and their exact permission bundles from the role×permission matrix defined in `data-model.md` (the authoritative table: Reception → `order.create`, `order.edit`, `order.cancel`, `customer.manage`, `workitem.assign_designer`, `pricing.use_fixed`, `finance.view`; Designer → `design.work`; Head Designer → `design.review`; Production Operator → `production.operate`, `files.download_production`; Print Reception/Delivery → `collection.receive`, `delivery.record`; Accounting → `payment.record`, `payment.void`, `expense.record`, `finance.view`; Admin/Owner → all 22 keys — note `pricing.set_variable`/`pricing.override` are NOT seeded onto `ACCOUNTING` per PRD §26/data-model.md, they are granted per-user via `UserPermission`), plus one Admin/Owner dev user with a known username/password for local development login (`pnpm run seed`)

**Checkpoint**: Foundation ready — schema migrated, append-only `REVOKE` applied, `Permission`/`RoleKey` unions defined, 7 roles × permission matrix seeded. User story implementation can now begin.

---

## Phase 3: User Story 1 — Staff log in and get exactly the access their role allows (Priority: P1) 🎯 MVP

**Goal**: Username+password login via Better Auth's username plugin, session creation (~12h expiry), lockout after 5 failures, `getActor()` resolving to a fully-typed `Actor` (userId, roles, permissions as `ReadonlySet<Permission>`, departmentIds), `authorize()` throwing `FORBIDDEN` on any missing permission or department mismatch, and the login page UI — all testable against server actions alone with no other feature's UI.

**Independent Test**: Seed one user per role; log in as each; confirm `getActor()` resolves to the correct permission set; call `authorize()` for every permission key the role does NOT hold and assert `FORBIDDEN` every time; confirm `getActor()` rejects `UNAUTHENTICATED` after logout.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Unit test for `authorize()` in `tests/unit/authorize.test.ts` covering: actor with correct permission passes (void return), actor missing permission throws `FORBIDDEN`, actor with permission but wrong `departmentId` in scope throws `FORBIDDEN`, actor with correct permission and correct `departmentId` passes — verifying fail-closed behavior on every ambiguous state (spec US1 Acceptance Scenario 2, FR-009, SC-001)
- [x] T009 [P] [US1] Unit test for the lockout logic in `tests/unit/lockout.test.ts` covering: fewer than 5 failed attempts do not lock, the 5th consecutive failure sets `lockedUntil` to `now + 15min`, a subsequent attempt while `lockedUntil` is in the future is rejected regardless of password correctness, a successful login resets `failedLoginAttempts` to 0 (spec US1 Acceptance Scenario 4, FR-004)
- [x] T010 [P] [US1] Integration test for `getActor()` in `tests/integration/getActor.test.ts` covering: valid session + active user returns correct `Actor` with role-unioned permissions, expired session rejects `UNAUTHENTICATED`, no session rejects `UNAUTHENTICATED`, active session for a deactivated user (`isActive = false`) rejects `UNAUTHENTICATED` (spec US1 Acceptance Scenarios 1 and 3, FR-007, FR-008)

### Implementation for User Story 1

- [x] T011 [US1] Wire Better Auth's `username` plugin in `src/server/auth/better-auth.config.ts`, setting `session.expiresIn = "12h"` and populating `User.email` with the synthetic placeholder `{username}@local.invalid` at account-creation time (keeping `emailVerified = false` permanently, never surfaced or checked) — as decided in research.md ("synthetic, never-shown placeholder `{username}@local.invalid`") to satisfy FR-001, FR-002, FR-026 without forking Better Auth's core schema; wire the credential hook that invokes `lockout.ts` before Better Auth's own verify step
- [x] T012 [P] [US1] Implement failed-attempt counter and `lockedUntil` check in `src/server/auth/lockout.ts`: increment `failedLoginAttempts` on each failure, set `lockedUntil = now + 15min` on the 5th consecutive failure, reset both to 0 on any successful login, reject login if `lockedUntil` is in the future — called from the Better Auth credential hook wired in T011 (FR-004, research.md lockout decision)
- [x] T013 [US1] Implement `getActor()` in `src/server/auth/getActor.ts`: read Better Auth session from the current request cookie, reject `UNAUTHENTICATED` if no session or `Session.expiresAt` is past, load `User` and re-check `isActive` (rejecting `UNAUTHENTICATED` immediately if false — this per-request re-check is what makes session revocation instantaneous per research.md), compute `permissions` as `ReadonlySet<Permission>` from the union of all `RolePermission` rows for the user's `UserRole`s plus all `UserPermission` rows for the user, return the assembled `Actor = { userId, roles: RoleKey[], permissions: ReadonlySet<Permission>, departmentIds: string[] }` (contracts/auth.md, FR-008, SC-002)
- [x] T014 [US1] Implement `authorize(actor, permission, scope?)` in `src/server/auth/authorize.ts`: throw `FORBIDDEN` if `!actor.permissions.has(permission)`; throw `FORBIDDEN` if `scope?.departmentId` is given and `!actor.departmentIds.includes(scope.departmentId)`; otherwise return void — fail-closed, zero I/O, pure `Set.has()` + array `.includes()` against the already-loaded `Actor` (contracts/auth.md, FR-009, SC-006)
- [x] T015 [US1] Replace 002's ambient `getActor()` stub in `src/server/auth/index.ts` with a barrel export of `Actor`, `Permission`, `RoleKey`, `getActor`, and `authorize` — exactly the surface documented in `contracts/auth.md`, so 002's `transitionWorkItem` and shell layout callers continue to compile and run unchanged against the real implementation (FR-025, plan.md §5.6). `audit` (with `.record`) is NOT part of this barrel yet — `audit.record` doesn't exist until T031 (Phase 5); T031 adds it to this same barrel file then.
- [x] T016 [US1] Implement the login page UI in `src/app/(auth)/login/page.tsx` with a username+password form (no email field, no self-signup link, no "forgot password" email flow), using Arabic-first RTL layout with Tailwind logical properties, submitting to Better Auth's credential endpoint (FR-001, FR-002, spec constitution IX)

**Checkpoint**: At this point, User Story 1 is fully functional and independently testable — staff can log in, `getActor()` resolves, `authorize()` blocks unauthorized calls, and lockout works.

---

## Phase 4: User Story 2 — Admin manages who has access without touching the database (Priority: P1)

**Goal**: Admin server actions for creating/deactivating/reactivating users, resetting passwords, reassigning roles and departments for existing users, granting/revoking per-user extra permissions, force-logging out a user (session deletion without deactivation), and an Admin UI (Users, Roles, Departments screens) — all with immediate session revocation on deactivation/force-logout and no hard-delete paths anywhere.

**Independent Test**: As a seeded Admin user, create a new account, assign a role and department, deactivate it, and confirm the deactivated user's active session is rejected as `UNAUTHENTICATED` on their very next request — testable end-to-end against the admin server actions alone.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T017 [P] [US2] Integration test for session revocation in `tests/integration/session-revocation.test.ts` covering: deactivating a user deletes all their `Session` rows AND sets `isActive = false` in the same transaction so their next `getActor()` call rejects `UNAUTHENTICATED`; force-logout deletes the user's `Session` rows without setting `isActive = false` so the account remains loginnable; a role-change (without deactivation) does NOT revoke the existing session — verifying SC-002's "next request, not eventually" requirement and spec US2 Acceptance Scenarios 2 and 3 (FR-006, FR-007, research.md session-revocation decision)
- [x] T018 [P] [US2] Integration test for Admin user-management server actions in `tests/integration/admin-users.test.ts` covering: creating a user produces a loginnable account with the correct roles/departments reflected in `getActor()`; reassigning an existing user's roles/departments via `updateUserRoleAssignments`/`updateUserDepartments` updates `getActor()`'s next resolution accordingly; granting a `UserPermission` via `grantUserPermission` adds that permission to the actor's set even without the role including it, and `revokeUserPermission` removes it; deactivating a non-existent or already-inactive user is a no-op (no error, both deactivation events are independently audited — spec Edge Cases); no server action or UI path exposes a hard-delete operation (spec US2 Acceptance Scenario 4, FR-014, FR-015, SC-004)
- [x] T019 [P] [US2] Integration test for Admin department-management server actions in `tests/integration/admin-departments.test.ts` covering: adding a department creates a new row; renaming a department updates `name`; deactivating a department sets `isActive = false`; no delete action exists (spec US2 Acceptance Scenario 5, FR-016)

### Implementation for User Story 2

- [x] T020 [US2] Implement Admin user-management server actions in `src/server/admin/users.ts`: `createUser` (username, initial password via Better Auth, one or more role IDs, zero or more department IDs, populate email with `{username}@local.invalid` synthetic placeholder per research.md, call `audit.record` with `user.created` inside the same `tx`), `deactivateUser` (set `isActive = false` AND delete all user `Session` rows in one transaction, call `audit.record` with `user.deactivated`), `reactivateUser` (set `isActive = true`, call `audit.record` with `user.reactivated`), `resetPassword` (update credential via Better Auth's API, call `audit.record` with `password.reset`), `forceLogout` (delete target user's `Session` rows only — no `isActive` change — call `audit.record` with `logout`); every action calls `authorize(actor, "admin.users")` before mutating anything (FR-006, FR-015, FR-022)
- [x] T021 [US2] Implement `updateUserRoleAssignments(userId, roleIds)` and `updateUserDepartments(userId, departmentIds)` in `src/server/admin/users.ts`: replace a user's `UserRole`/`UserDepartment` rows to match the given sets (add missing, remove no-longer-present) in one transaction each, call `audit.record` with `role.changed` (capturing the before/after role-ID sets) for the roles case; both call `authorize(actor, "admin.users")` — this is the ongoing "assign roles+departments" admin capability spec.md's User Story 2 describes, distinct from the one-time assignment `createUser` (T020) does at account-creation (FR-015, FR-022)
- [x] T022 [US2] Implement `grantUserPermission(userId, permission, reason?)` and `revokeUserPermission(userId, permission)` in `src/server/admin/users.ts`: insert/delete a `UserPermission` row (`grantedById` set to the acting Admin), call `audit.record` with `role.changed` capturing the permission key and reason (reuse this action string — no dedicated `permission.granted` key exists in FR-022's fixed list, and inventing one is unnecessary); calls `authorize(actor, "admin.users")` — this is the concrete implementation of FR-014's "grant a specific user permissions beyond their role(s)" capability (e.g. giving one Accounting user `pricing.set_variable` without making it role-wide), which the spec's whole 7-vs-8-role resolution depends on existing (FR-014, PRD §26)
- [x] T023 [US2] Implement Admin roles server action in `src/server/admin/roles.ts`: `listRolesWithPermissions` returning the full role×permission matrix as a read-only view for display — no mutation path (matrix editing is out of scope per spec Assumptions; per-user extra permissions are handled in `src/server/admin/users.ts` via T022); calls `authorize(actor, "admin.users")` (FR-018)
- [x] T024 [US2] Implement Admin department-management server actions in `src/server/admin/departments.ts`: `addDepartment` (insert new `Department` row, call `audit.record`), `renameDepartment` (update `name`, call `audit.record`), `deactivateDepartment` (set `isActive = false`, call `audit.record`); no delete path exists anywhere; every action calls `authorize(actor, "admin.config")` (FR-016)
- [x] T025 [US2] Implement the Admin Users screen in `src/app/(shell)/admin/users/page.tsx`: list users with their roles/departments/active status; create-user form (username, initial password, role multi-select, department multi-select); per-row role/department reassignment controls (T021); per-row extra-permission grant/revoke controls (T022); deactivate/reactivate toggle per row; reset-password action per row; force-logout action per row; no delete button anywhere (spec US2 Acceptance Scenario 4); Arabic-first RTL layout with Tailwind logical properties (FR-014, FR-015, constitution IX)
- [x] T026 [P] [US2] Implement the Admin Roles screen in `src/app/(shell)/admin/roles/page.tsx`: read-only display of the 7 roles and the role×permission matrix from `data-model.md`; no edit controls (editing is out of scope per spec Assumptions); Arabic-first RTL layout (FR-018)
- [x] T027 [P] [US2] Implement the Admin Departments screen in `src/app/(shell)/admin/departments/page.tsx`: list departments with active/inactive status; add-department form; rename-department inline action; deactivate-department toggle; no delete button anywhere (spec US2 Acceptance Scenario 5); Arabic-first RTL layout (FR-016, constitution IX)

**Checkpoint**: At this point, User Stories 1 AND 2 are both fully functional and independently testable. An Admin can create accounts, manage sessions, reassign roles/departments/extra permissions, and the shop can operate on day one.

---

## Phase 5: User Story 3 — Every sensitive change leaves a tamper-proof trail Admin can review (Priority: P2)

**Goal**: `audit.record(tx, event)` callable inside any caller-supplied Prisma transaction, persisting full `before`/`after` JSON snapshots; the Audit Log viewer (Admin-only, filtering by entity type/ID/actor/action/date range, with single-event before/after diff view); and the database-level append-only guarantee verified by an automated contract test.

**Independent Test**: Perform user create + deactivate actions, open the Audit Log, filter to those events, inspect one event's before/after diff, and separately attempt raw SQL `UPDATE`/`DELETE` against `audit_event` and confirm the database itself rejects both.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T028 [P] [US3] Integration test for `audit.record()` in `tests/integration/audit-record.test.ts` covering: calling `audit.record(tx, event)` inside a transaction inserts exactly one `AuditEvent` row with correct `action`, `entityType`, `entityId`, `actorId`, `before`/`after` JSON; a transaction that rolls back after `audit.record()` also rolls back the audit row (atomicity); calling with `actorId` omitted (pre-auth event such as `login.failure` on unknown username) inserts a row with `actorId = null`; calling with override action but no `reason` is rejected by the caller's validation before `audit.record()` is invoked (FR-019, FR-020, FR-024, contracts/audit.md)
- [x] T029 [P] [US3] Contract test for the database-level append-only guarantee in `tests/contract/audit-append-only.test.ts`: insert a real `AuditEvent` row via `audit.record()`, then attempt a raw SQL `UPDATE audit_event SET reason = 'tampered' WHERE id = ...` and `DELETE FROM audit_event WHERE id = ...` directly against the test database (not through the application), and assert that Postgres itself rejects both with a permission-denied error — verifying SC-003 and FR-021 (research.md: "A Postgres `REVOKE UPDATE, DELETE ON audit_event FROM <app_role>` migration … rather than a trigger")
- [x] T030 [P] [US3] Contract test for the role×permission snapshot in `tests/contract/role-permission-matrix.test.ts`: query the seeded `Role`/`RolePermission` rows and assert the resulting matrix exactly equals the table from `data-model.md` (Reception → 7 permissions, Designer → 1, Head Designer → 1, Production Operator → 2, Print Reception/Delivery → 2, Accounting → 4, Admin/Owner → all 22 keys, noting `pricing.set_variable`/`pricing.override` are absent from `ACCOUNTING`); this snapshot test is the automated verification of SC-001

### Implementation for User Story 3

- [x] T031 [US3] Implement `audit.record(tx, event)` in `src/server/auth/audit.ts`: insert one `AuditEvent` row via the caller-supplied Prisma `tx` with `action`, `entityType`, `entityId`, `actorId?`, `before?: unknown` (serialized to Prisma `Json`), `after?: unknown`, `reason?`, `attachmentIds?`, `ipAddress?`, `userAgent?`; no validation beyond Prisma's JSON-serializability — callers are responsible for excluding secrets before calling (spec Edge Cases); propagate any Prisma write failure as-is to abort the caller's transaction (contracts/audit.md, FR-019, FR-020). Also add `audit` (with `.record`) to the `src/server/auth/index.ts` barrel export T015 created (contracts/audit.md's documented surface).
- [x] T032 [US3] Wire all authentication/administration audit events in the Better Auth credential hook and in `src/server/admin/users.ts`: `login.success` (on successful credential verify, inside the session-creation transaction), `login.failure` (on failed verify or lockout rejection — `actorId` omitted if username not found, to match spec Edge Case "never reveal whether the username exists"), `logout` (on explicit logout), `user.created`, `user.deactivated`, `user.reactivated`, `password.reset` — satisfying FR-022 and SC-005; `role.changed` on any `UserRole`/`UserPermission` mutation (T021, T022)
- [x] T033 [US3] Implement the Admin Audit Log viewer in `src/app/(shell)/admin/audit/page.tsx`: filterable list of `AuditEvent` rows by entity type, entity ID, actor, action string, and date range (server-side filtering via Prisma queries); single-event detail view showing `before`/`after` as a formatted diff; calls `authorize(actor, "audit.view")` before loading any data; Arabic-first RTL layout with Tailwind logical properties (FR-023, FR-009, constitution IX)

**Checkpoint**: All three user stories are fully functional and independently verifiable. The audit spine is live, tamper-proof at the database level, and reviewable by Admins.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Automated verification suite (quickstart.md §Automated verification), full `pnpm check` gate, and RTL/Arabic compliance across all admin screens introduced by this feature

- [x] T034 Run the complete automated verification from `quickstart.md`: `pnpm check` (lint + typecheck must pass with zero errors), `pnpm test` (full Vitest suite including the role×permission snapshot test SC-001, department-scope `FORBIDDEN` test SC-006, session-revocation test SC-002, and the contract-level raw-SQL `UPDATE`/`DELETE` rejection test SC-003)
- [x] T035 [P] Audit all admin screens (`src/app/(shell)/admin/users/page.tsx`, `src/app/(shell)/admin/roles/page.tsx`, `src/app/(shell)/admin/departments/page.tsx`, `src/app/(shell)/admin/audit/page.tsx`) and the login page (`src/app/(auth)/login/page.tsx`) for RTL compliance: zero physical directional spacing classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`), all spacing via Tailwind logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`), `dir="rtl"` inherited from root layout, Arabic labels throughout (constitution IX, plan.md §5)
- [x] T036 [P] Verify the `src/server/auth/index.ts` barrel export surface exposes exactly and only: `Actor`, `Permission`, `RoleKey`, `getActor`, `authorize`, `audit` (with `.record`) — nothing more, matching `contracts/auth.md` and `contracts/audit.md`; verify the ESLint module-boundary rule (established by 002) treats `src/server/auth/**` as a protected module boundary so no downstream feature imports internal files directly (plan.md §5.1, §5.6)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — executes immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**.
- **User Stories (Phase 3+)**: All depend on Phase 2 completion.
  - **User Story 1 (P1)**: Starts immediately after Foundational. Delivers login, `getActor()`, `authorize()`, and the lockout — everything every other story and feature depends on. MVP!
  - **User Story 2 (P1)**: Starts after Foundational. Depends on US1's `getActor()`/`authorize()` being real (not a stub) to enforce Admin-only access on every server action.
  - **User Story 3 (P2)**: Starts after Foundational. Depends on `audit.record()` being callable (implemented as part of US3 Phase 5) — US1 and US2's auth/admin events are wired into audit in T032, so US3 MUST complete before audit events are fully wired.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: `getActor()` and `authorize()` depend on T004 (schema) and T006 (permissions union). No dependency on US2 or US3.
- **User Story 2 (P1)**: All admin server actions call `authorize(actor, "admin.users"/"admin.config")` — depends on US1's `authorize()` (T014) being complete. `deactivateUser` / `forceLogout` / `updateUserRoleAssignments` / `grantUserPermission` write `audit.record()` — depends on US3's T031 if strict TDD order is followed; otherwise, stub `audit.record()` as a no-op and wire fully in T032.
- **User Story 3 (P2)**: `audit.record()` (T031) is independent of US1/US2 implementation — it is a pure Prisma insert. The audit-event wiring (T032) must run after US2's admin actions (T020, T021, T022) and the Better Auth credential hook (T011) are in place.

### Within Each User Story

- Test tasks MUST be written and fail before implementation files are created.
- Type/union definitions before functions that consume them.
- Server actions before Admin UI pages.
- `audit.record()` (T031) before auth/admin audit-event wiring (T032).

### Parallel Opportunities

- In Phase 1: T002 and T003 can run in parallel after T001.
- In Phase 2: T006 (`permissions.ts`) can start as soon as T004's migration is applied; T007 (seed) depends on T004 and T006 being complete.
- In User Story 1: T008, T009, T010 (tests) can all run in parallel; T012 (`lockout.ts`) can run in parallel with T013 (`getActor.ts`) and T014 (`authorize.ts`).
- In User Story 2: T017, T018, T019 (tests) can all run in parallel; T023, T024 (roles/departments server actions) can run in parallel with T020, T021, T022 (users server actions — same file, sequential within it); T025, T026, T027 (UI pages) can run in parallel after their respective server actions complete.
- In User Story 3: T028, T029, T030 (tests) can all run in parallel; T031 and T032 are sequential (T032 depends on T031).
- In Phase 6: T035 and T036 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Write all tests first (must fail):
Task: T008 [P] [US1] Unit test for authorize() in tests/unit/authorize.test.ts
Task: T009 [P] [US1] Unit test for lockout in tests/unit/lockout.test.ts
Task: T010 [P] [US1] Integration test for getActor() in tests/integration/getActor.test.ts

# Implement core auth functions (can run in parallel, different files):
Task: T011 [US1] Wire username plugin in src/server/auth/better-auth.config.ts
Task: T012 [P] [US1] Lockout logic in src/server/auth/lockout.ts
Task: T013 [US1] getActor() in src/server/auth/getActor.ts
Task: T014 [US1] authorize() in src/server/auth/authorize.ts
```

---

## Parallel Example: User Story 2

```bash
# Write all tests first (must fail):
Task: T017 [P] [US2] Session-revocation integration test in tests/integration/session-revocation.test.ts
Task: T018 [P] [US2] Admin users integration test in tests/integration/admin-users.test.ts
Task: T019 [P] [US2] Admin departments integration test in tests/integration/admin-departments.test.ts

# Implement server actions (users.ts tasks are sequential in one file; roles/departments can run in parallel with them):
Task: T020 [US2] createUser/deactivateUser/reactivateUser/resetPassword/forceLogout in src/server/admin/users.ts
Task: T021 [US2] updateUserRoleAssignments/updateUserDepartments in src/server/admin/users.ts
Task: T022 [US2] grantUserPermission/revokeUserPermission in src/server/admin/users.ts
Task: T023 [US2] Roles server action in src/server/admin/roles.ts
Task: T024 [US2] Departments server actions in src/server/admin/departments.ts

# Implement UI pages in parallel after server actions:
Task: T025 [US2] Users screen in src/app/(shell)/admin/users/page.tsx
Task: T026 [P] [US2] Roles screen in src/app/(shell)/admin/roles/page.tsx
Task: T027 [P] [US2] Departments screen in src/app/(shell)/admin/departments/page.tsx
```

---

## Parallel Example: User Story 3

```bash
# Write all tests first (must fail):
Task: T028 [P] [US3] audit.record() integration test in tests/integration/audit-record.test.ts
Task: T029 [P] [US3] Append-only contract test in tests/contract/audit-append-only.test.ts
Task: T030 [P] [US3] Role-permission matrix snapshot test in tests/contract/role-permission-matrix.test.ts

# Implement audit.record, then wire events, then UI:
Task: T031 [US3] audit.record() in src/server/auth/audit.ts
Task: T032 [US3] Wire all FR-022 audit events in better-auth.config.ts + src/server/admin/users.ts
Task: T033 [US3] Audit Log viewer in src/app/(shell)/admin/audit/page.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`T001` – `T003`)
2. Complete Phase 2: Foundational (`T004` – `T007`) — **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (`T008` – `T016`)
4. **STOP and VALIDATE**: Log in as the seeded Designer, confirm `getActor()` resolves with the correct permission set, attempt `authorize(actor, "pricing.set_variable")` and confirm `FORBIDDEN`, log out and confirm `UNAUTHENTICATED`. Demo MVP!

### Incremental Delivery

1. **Setup + Foundational**: Identity schema migrated, `REVOKE` applied, `Permission`/`RoleKey` unions defined, 7 roles × permission matrix seeded → foundation ready.
2. **User Story 1 (P1)**: Delivers username login, session management (~12h), lockout, `getActor()`, `authorize()`, and the login page. Every other feature can now call `authorize()` safely. MVP!
3. **User Story 2 (P1)**: Delivers Admin user/session management, ongoing role/department/extra-permission reassignment, role/department admin, and immediate session revocation — the shop can create and manage all staff accounts in-app, including the per-user pricing-permission grant FR-014 requires.
4. **User Story 3 (P2)**: Delivers `audit.record()`, all auth/admin audit events (FR-022), and the Audit Log viewer — every sensitive change leaves a tamper-proof, database-enforced audit trail.
5. **Polish (Phase 6)**: Full `pnpm check` + `pnpm test` green, RTL compliance verified across all new screens, barrel export surface confirmed.

---

## Notes

- `[P]` tasks = different files with no dependencies on incomplete tasks within the same phase. T020/T021/T022 all touch `src/server/admin/users.ts` and are therefore sequential, not parallel, despite all being `[US2]`.
- `[Story]` label (`[US1]`, `[US2]`, `[US3]`) maps every user-story task to its acceptance scenarios and success criteria in `spec.md`.
- All integration and contract tests require a real PostgreSQL test database (`DATABASE_URL_TEST`).
- The `REVOKE UPDATE, DELETE ON audit_event` migration (T005) only binds if the app's Postgres connection role is a non-superuser — this is a deployment prerequisite documented in T002 and in research.md.
- `audit.record()` is the **only** code path allowed to write `AuditEvent` rows — no migration, admin tool, or other function may `INSERT` directly (contracts/audit.md).
- No server action or UI path may expose a hard-delete for `User` or `Department` — only deactivate/reactivate (PRD §55 Rule 8, spec FR-015, FR-016).
- The `{username}@local.invalid` synthetic email placeholder (research.md) MUST be set at `createUser` time; nothing user-facing ever depends on `User.email` or `emailVerified` in this feature.
- Explicit logout (FR-005) is Better Auth's built-in sign-out endpoint — no custom implementation task is needed; it is exercised by T010's/T017's session-invalidation assertions.
- Commit after each task or logical group to maintain a clean, bisectable git history.
