# Data Model: 001-identity-access-audit

All new models live in `prisma/schema/identity.prisma` alongside the Better Auth models 002 already
scaffolded there, except `Department`/`UserDepartment`'s `Department` half, which stays in
`prisma/schema/core.prisma` (see research.md's Department decision). Prisma's multi-file schema
(`prismaSchemaFolder`) means cross-file relations need no import.

## Extended: `User` (identity.prisma, existing — 002/Better Auth scaffold)

Adds columns to the existing model (no field removed; `email`/`emailVerified` remain, unused by
the app beyond satisfying Better Auth's core schema — see research.md):

| Field | Type | Notes |
|---|---|---|
| `username` | `String @unique` | Better Auth username plugin field. Login identifier. |
| `displayUsername` | `String?` | Better Auth username plugin field (preserves original casing). |
| `isActive` | `Boolean @default(true)` | Deactivated users can never log in or resume a session (FR-006, FR-015). Never hard-deleted. |
| `failedLoginAttempts` | `Int @default(0)` | Lockout counter (FR-004). Reset to 0 on any successful login. |
| `lockedUntil` | `DateTime?` | Set on the 5th consecutive failure; login rejected while in the future (FR-004). |

New relations: `roles UserRole[]`, `extraPermissions UserPermission[]`, `departments UserDepartment[]`,
`auditEvents AuditEvent[]` (as actor), `grantedPermissions UserPermission[] @relation("PermissionGrantedBy")`.

## New: `Role`

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `key` | `String @unique` | Stable code identifier, e.g. `RECEPTION`, `DESIGNER` — the 7 keys from FR-011. |
| `name` | `String` | Display name shown in the Admin Roles screen. |
| `createdAt` | `DateTime @default(now())` | |

Relations: `permissions RolePermission[]`, `userRoles UserRole[]`.

Seeded exactly once with the 7 roles and their permission bundles (data, not enum — constitution VI).

## New: `RolePermission`

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `roleId` | `String` | FK → `Role`. |
| `permission` | `String` | One of the 22 fixed `Permission` union values (FR-010); validated by the app's Zod schema, not a DB enum, so adding a permission key never requires a migration to *this* table's constraint. |

`@@unique([roleId, permission])`.

## New: `UserRole`

Join table — a user may hold several roles (FR-012).

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `userId` | `String` | FK → `User`. |
| `roleId` | `String` | FK → `Role`. |

`@@unique([userId, roleId])`.

## New: `UserPermission`

Per-user extra permission beyond role (FR-014 — the "pricing users must be explicitly configurable"
requirement from PRD §26).

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `userId` | `String` | FK → `User`. |
| `permission` | `String` | One of the 22 fixed keys. |
| `grantedById` | `String` | FK → `User` (the Admin who granted it) — itself audited via `audit.record()` at grant time. |
| `createdAt` | `DateTime @default(now())` | |

`@@unique([userId, permission])`.

## New: `UserDepartment`

Join table scoping department-sensitive permission checks (FR-017).

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `userId` | `String` | FK → `User`. |
| `departmentId` | `String` | FK → `Department` (core.prisma; cross-file relation). |

`@@unique([userId, departmentId])`.

## Existing, unchanged: `Department` (core.prisma, 002)

001 owns this model's admin lifecycle (add/rename/deactivate — FR-016) going forward; the model
definition itself is unchanged from 002 (`id`, `name`, `isActive`, `createdAt`). No delete path
exists or is added (constitution/Rule G).

## New: `AuditEvent`

Append-only; the only writer is `audit.record()`, always inside the caller's transaction (FR-019,
FR-020). No application code ever issues `UPDATE`/`DELETE` against this table, and the database
itself refuses both (FR-021 — see research.md's REVOKE decision).

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `actorId` | `String?` | FK → `User`. Nullable only for system-originated events, if any ever exist (none currently do — kept nullable for forward-compat rather than forcing a synthetic system-user row). |
| `action` | `String` | e.g. `user.created`, `login.failure`, `workitem.transitioned`. Free-form but conventionally `entity.verb`. |
| `entityType` | `String` | e.g. `User`, `WorkItem`, `Order`. |
| `entityId` | `String` | The affected record's ID. |
| `before` | `Json?` | Full snapshot pre-change (research.md: snapshots, not diffs). |
| `after` | `Json?` | Full snapshot post-change. |
| `reason` | `String?` | Required by the app layer (not the schema) for overrides and rejections (FR-024). |
| `attachmentIds` | `String[]` | References only — files themselves belong to feature 050. |
| `ipAddress` | `String?` | Captured from the request when available. |
| `userAgent` | `String?` | Captured from the request when available. |
| `createdAt` | `DateTime @default(now())` | |

Indexes: `@@index([entityType, entityId])` (entity history lookups), `@@index([actorId, createdAt])`
(actor timeline), `@@index([action, createdAt])` (Audit Log viewer's action filter, FR-023).

## Fixed code-level union (not a table): `Permission`

The 22 keys from FR-010, defined once in `src/server/core` alongside `WorkItemState`'s pattern
(frozen, imported everywhere, typo-proof at compile time) — see contracts/auth.md.

## Fixed code-level union (not a table): `RoleKey`

The 7 role keys from FR-011 (`RECEPTION`, `DESIGNER`, `HEAD_DESIGNER`, `PRODUCTION_OPERATOR`,
`PRINT_RECEPTION_DELIVERY`, `ACCOUNTING`, `ADMIN_OWNER`) — used only to seed `Role.key` and to type
the seed matrix; runtime role checks always go through `authorize()`'s permission check, never a
`RoleKey` comparison (FR-013).

## Seeded role × permission matrix (authoritative — the snapshot test in SC-001 asserts this exactly)

Derived directly from PRD §48's Can/Cannot lists per role, mapped onto the 22 fixed permission keys.
Where PRD §48 explicitly says a role "Cannot" do something, the corresponding permission is
deliberately omitted. `ADMIN_OWNER` receives every key ("view all operations... manage system
settings"). Per PRD §26 / spec FR-014, `pricing.set_variable`/`pricing.override` are **not** seeded
onto `ACCOUNTING` by default — they are granted per-user via `UserPermission` when an Admin
explicitly configures a specific accounting user as a pricing user.

| Permission | Reception | Designer | Head Designer | Production Operator | Print Reception/Delivery | Accounting | Admin/Owner |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `order.create` | ✔ | | | | | | ✔ |
| `order.edit` | ✔ | | | | | | ✔ |
| `order.cancel` | ✔ | | | | | | ✔ |
| `customer.manage` | ✔ | | | | | | ✔ |
| `workitem.assign_designer` | ✔ | | | | | | ✔ |
| `design.work` | | ✔ | | | | | ✔ |
| `design.review` | | | ✔ | | | | ✔ |
| `production.operate` | | | | ✔ | | | ✔ |
| `collection.receive` | | | | | ✔ | | ✔ |
| `delivery.record` | | | | | ✔ | | ✔ |
| `pricing.use_fixed` | ✔ | | | | | | ✔ |
| `pricing.set_variable` | | | | | | | ✔ |
| `pricing.override` | | | | | | | ✔ |
| `payment.record` | | | | | | ✔ | ✔ |
| `payment.void` | | | | | | ✔ | ✔ |
| `expense.record` | | | | | | ✔ | ✔ |
| `finance.view` | ✔ | | | | | ✔ | ✔ |
| `files.download_production` | | | | ✔ | | | ✔ |
| `audit.view` | | | | | | | ✔ |
| `admin.users` | | | | | | | ✔ |
| `admin.config` | | | | | | | ✔ |
| `admin.override` | | | | | | | ✔ |

Notes on borderline mappings, so a reviewer can check them against PRD §48 directly:
- Reception's `finance.view` reflects "View relevant payment/order information"; it is view-only —
  Reception has no `payment.record`/`expense.record` (PRD: "Cannot modify production financial
  records freely").
- Reception's `order.cancel` is inferred from "Manage Orders" (full order lifecycle); nothing in
  PRD §48's Reception "Cannot" list forbids it.
- Head Designer gets `design.review` only, not `design.work` — PRD §48 lists Head Designer's
  capabilities as review/approve/reject/annotate/send-to-production, not hands-on design work
  (contrast with Designer's explicit "Work on designs").
- Accounting's `payment.void` is inferred from "Enter financial data" / "Record production and
  manufacturing costs" as part of ordinary financial-record correction; PRD §48 does not separately
  call out voiding, but nothing in Accounting's "Cannot" list forbids it either.
