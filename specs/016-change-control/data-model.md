# Phase 1 Data Model: Order Change Control

## Schema diff

### New file `prisma/schema/change-control.prisma`

```prisma
/// research.md §1/§2. Origin of a specification version (FR-002).
enum SpecVersionOrigin {
  INITIAL         // created with the Work Item (011 creation paths)
  BACKFILL        // migration backfill or runtime self-heal (FR-005); createdById = null
  DIRECT_EDIT     // editSpec / 011 editWorkItem (US2)
  CHANGE_REQUEST  // approveChangeRequest (US3)
  ADMIN_OVERRIDE  // adminOverrideSpec (US7)
}

enum ChangeRequestStatus {
  PENDING
  APPROVED
  REJECTED
  WITHDRAWN
  CLOSED_BY_CANCELLATION
}

enum ChangeRequestOutcome {
  CONTINUE_PRODUCTION
  REDESIGN
}

/// One immutable specification snapshot. Append-only: REVOKE UPDATE, DELETE
/// (manual-sql/016-change-control-constraints.sql). Columns mirror WorkItem's
/// 011 descriptive fields exactly (types, precision, enum).
model SpecVersion {
  id               String                 @id @default(cuid())
  workItemId       String
  workItem         WorkItem               @relation("WorkItemSpecVersions", fields: [workItemId], references: [id])
  /// 1, 2, 3 … per Work Item, never reused.
  version          Int
  origin           SpecVersionOrigin

  productTypeId    String?
  productType      ProductType?           @relation("SpecVersionProductType", fields: [productTypeId], references: [id])
  description      String?
  quantity         Int?
  widthValue       Decimal?               @db.Decimal(10, 2)
  heightValue      Decimal?               @db.Decimal(10, 2)
  dimensionUnit    WorkItemDimensionUnit?
  material         String?
  finishNotes      String?

  /// WorkItem.state when this version was created (FR-002).
  stateAtCreation  WorkItemState
  /// Required for ADMIN_OVERRIDE and CHANGE_REQUEST (copied from the request); optional otherwise.
  reason           String?
  /// Null only for origin = BACKFILL.
  createdById      String?
  createdBy        User?                  @relation("SpecVersionCreatedBy", fields: [createdById], references: [id])
  createdAt        DateTime               @default(now())

  /// Back-relations
  currentFor           WorkItem?          @relation("WorkItemCurrentSpecVersion")
  baseOfChangeRequests ChangeRequest[]    @relation("ChangeRequestBaseVersion")
  resultOfChangeRequest ChangeRequest?    @relation("ChangeRequestResultingVersion")

  @@unique([workItemId, version])
}

/// A customer's requested modification to an IN_PRODUCTION Work Item (US3), or
/// the auto-approved record of an in-production Admin override (FR-028).
/// Never deleted. Fields below the divider are written exactly once by the
/// guarded PENDING → terminal update (research.md §13).
model ChangeRequest {
  id                String               @id @default(cuid())
  workItemId        String
  workItem          WorkItem             @relation(fields: [workItemId], references: [id])
  status            ChangeRequestStatus  @default(PENDING)
  baseSpecVersionId String
  baseSpecVersion   SpecVersion          @relation("ChangeRequestBaseVersion", fields: [baseSpecVersionId], references: [id])
  /// SpecPatch (contracts/change-control.md) — validated by specPatchSchema on
  /// write AND re-parsed on read; never consumed untyped.
  proposedPatch     Json
  requestReason     String
  requestedById     String
  requestedBy       User                 @relation("ChangeRequestRequestedBy", fields: [requestedById], references: [id])
  createdAt         DateTime             @default(now())
  /// Set when createChangeRequest closed an open ACTIVE PhaseTiming segment (FR-012).
  pausedRunningTimerAt DateTime?
  isAdminOverride   Boolean              @default(false)

  // ── decision (written once) ─────────────────────────────────────────────
  decidedById       String?
  decidedBy         User?                @relation("ChangeRequestDecidedBy", fields: [decidedById], references: [id])
  decidedAt         DateTime?
  /// Rejection/withdrawal reason (required then) or approval note (optional).
  decisionNote      String?
  /// Non-null iff status = APPROVED.
  outcome           ChangeRequestOutcome?
  resultingSpecVersionId String?         @unique
  resultingSpecVersion   SpecVersion?    @relation("ChangeRequestResultingVersion", fields: [resultingSpecVersionId], references: [id])
  /// Non-null iff outcome = REDESIGN.
  returnId          String?              @unique
  return            Return?              @relation(fields: [returnId], references: [id])

  // ── production acknowledgment (outcome = CONTINUE_PRODUCTION only) ──────
  productionAcknowledgedAt   DateTime?
  productionAcknowledgedById String?
  productionAcknowledgedBy   User?       @relation("ChangeRequestAcknowledgedBy", fields: [productionAcknowledgedById], references: [id])

  @@index([workItemId, status])
  @@index([status, createdAt])
}

/// Permanent record of a cancellation after production started (US6). Source
/// record for 052's direct cost (PRD §30). Append-only (REVOKE UPDATE, DELETE).
model LateCancellation {
  id                    String        @id @default(cuid())
  workItemId            String        @unique
  workItem              WorkItem      @relation(fields: [workItemId], references: [id])
  stateAtCancellation   WorkItemState
  reason                String
  /// Exact decimal, >= 0, entered explicitly (FR-024).
  costIncurred          Decimal       @db.Decimal(12, 2)
  /// Configured column, default EGP (constitution VI) — not a UI constant.
  currency              String        @default("EGP")
  producedQuantitySoFar Int?
  costNote              String?
  createdById           String
  createdBy             User          @relation("LateCancellationCreatedBy", fields: [createdById], references: [id])
  createdAt             DateTime      @default(now())
}
```

### `WorkItem` (core.prisma): one new column and back-relations

```prisma
model WorkItem {
  // ...existing fields unchanged — the 011 descriptive columns (productTypeId,
  // description, quantity, widthValue, heightValue, dimensionUnit, material,
  // finishNotes) STAY and become the mirror of the current SpecVersion
  // (research.md §1). Written only by src/server/changes applySpecChangeInTx /
  // createInitialSpecVersionInTx after 016.

  /// --- 016-change-control ------------------------------------------------
  /// Current SpecVersion. Nullable only for the circular insert and the
  /// window before backfill (research.md §14); non-null for every Work Item
  /// after backfill (verified by query + contract test).
  currentSpecVersionId String?        @unique
  currentSpecVersion   SpecVersion?   @relation("WorkItemCurrentSpecVersion", fields: [currentSpecVersionId], references: [id])
  specVersions         SpecVersion[]  @relation("WorkItemSpecVersions")
  changeRequests       ChangeRequest[]
  lateCancellation     LateCancellation?
  /// --- end 016-change-control ---------------------------------------------
}
```

### Other back-relations

- `ProductType` (core.prisma): `specVersions SpecVersion[] @relation("SpecVersionProductType")`
- `Return` (core.prisma): `changeRequest ChangeRequest?`
- `User` (identity.prisma): `specVersionsCreated SpecVersion[] @relation("SpecVersionCreatedBy")`,
  `changeRequestsRequested ChangeRequest[] @relation("ChangeRequestRequestedBy")`,
  `changeRequestsDecided ChangeRequest[] @relation("ChangeRequestDecidedBy")`,
  `changeRequestsAcknowledged ChangeRequest[] @relation("ChangeRequestAcknowledgedBy")`,
  `lateCancellations LateCancellation[] @relation("LateCancellationCreatedBy")`

These are schema-only additions. No existing column, enum value, or relation changes. The
existing Prisma enum `RejectionCategory` already contains `CUSTOMER_CHANGE`, so it is not modified.

### Workflow edges (`src/server/core/workflow/edges.ts`)

```diff
-  APPROVED: ["WAITING_PRICING", "READY_FOR_PRODUCTION", "CANCELLED"],
-  WAITING_PRICING: ["READY_FOR_PRODUCTION", "CANCELLED"],
-  READY_FOR_PRODUCTION: ["IN_PRODUCTION", "CANCELLED"],
+  APPROVED: ["WAITING_PRICING", "READY_FOR_PRODUCTION", "REWORK_REQUIRED", "CANCELLED"],
+  WAITING_PRICING: ["READY_FOR_PRODUCTION", "REWORK_REQUIRED", "CANCELLED"],
+  READY_FOR_PRODUCTION: ["IN_PRODUCTION", "REWORK_REQUIRED", "CANCELLED"],
```

(research §7). There is no new state. `REWORK_REQUIRED` still requires `reason` and
`rejectionCategory` (002's `transitionWorkItem`), and 016 always passes `CUSTOMER_CHANGE`.

### Permission key (`src/server/auth/permissions.ts`, 001, cross-team)

`"change.approve"` is added to the `Permission` union and `ALL_PERMISSIONS` (22 → 23). `prisma/seed.ts`
lists each role's permissions explicitly, so `"change.approve"` is appended to both the
`HEAD_DESIGNER` and the `ADMIN_OWNER` lists. `tests/contract/role-permission-matrix.test.ts`
gains the new key.

## Derived values (not stored)

| Value | Derivation | Where |
|---|---|---|
| Edit policy | `specEditPolicy(workItem.state)` → `DIRECT` for `NEW`…`READY_FOR_PRODUCTION` (9 states), `CHANGE_REQUEST` for `IN_PRODUCTION`, `ADMIN_ONLY` for `PRODUCTION_COMPLETED`/`READY_FOR_COLLECTION`/`DELIVERED`/`COMPLETED`, `LOCKED` for `CANCELLED` | `policy.ts` |
| Redesign choice | `REQUIRED` iff state ∈ {`APPROVED`,`WAITING_PRICING`,`READY_FOR_PRODUCTION`} ∧ `requiresDesign`; otherwise `FORBIDDEN` for direct edits. For approvals, `REDESIGN` is allowed iff `requiresDesign ∧ assigneeId ≠ null` | `policy.ts` |
| Production hold | `PENDING` CR exists → `{kind:"CHANGE_PENDING", changeRequestId}`; else an `APPROVED ∧ outcome=CONTINUE_PRODUCTION ∧ productionAcknowledgedAt IS NULL` CR exists → `{kind:"REVISION_UNACKNOWLEDGED", changeRequestId}`; else `null` | `productionHold.ts` |
| Effective department | `workItem.departmentId ?? productType.defaultDepartmentId` (same rule as 014) | `effects.ts` (local helper) |
| Production-start version | Latest `SpecVersion` with `createdAt ≤` the latest `WorkItemTransition(to = IN_PRODUCTION).at` | `versions.ts` `getProductionStartSpecDiff` |
| Changed fields | `diffSpecSnapshots(prev, next).map(c => c.field)` | `diff.ts` |

## State of a `ChangeRequest`

```text
                 approve(CONTINUE_PRODUCTION) ─► APPROVED ──(acknowledgeSpecRevision)──► APPROVED + ack
PENDING ──┬──── approve(REDESIGN) ─────────────► APPROVED (returnId set; Work Item → REWORK_REQUIRED)
          ├──── reject(reason) ────────────────► REJECTED
          ├──── withdraw(reason) ──────────────► WITHDRAWN
          └──── cancelAfterProductionStarted ──► CLOSED_BY_CANCELLATION
(adminOverrideSpec in IN_PRODUCTION inserts a row directly as APPROVED, isAdminOverride = true)
```

Each arrow is one `updateMany({ where: { id, status: "PENDING" } })` requiring `count === 1`
(otherwise `CHANGE_REQUEST_ALREADY_DECIDED`). The acknowledgment is `updateMany({ where: { workItemId,
status: "APPROVED", outcome: "CONTINUE_PRODUCTION", productionAcknowledgedAt: null } })`. It
covers every unacknowledged approval at once, because the latest instruction supersedes earlier
ones, and it requires `count ≥ 1`.

## Validation rules

| Rule | Enforced by | Error code (`ChangeError`, or an engine base code, per contracts/aspects.md) |
|---|---|---|
| `SpecPatch` has ≥ 1 key; each key is a spec field with its type (`quantity` int ≥ 1; `widthValue`/`heightValue` decimal > 0, ≤ 2 dp, ≤ 99,999,999.99; strings trimmed, length ≤ 2000, `""` → `null`; `productTypeId` must reference an existing active `ProductType`) | `specPatchSchema` (Zod) + existence check in `applySpecChangeInTx` | `VALIDATION`; `NOT_FOUND { entity: "ProductType" }` |
| Patch must change ≥ 1 field versus current | `diffSpecSnapshots` in `applySpecChangeInTx` | `NO_CHANGES` |
| `expectedVersion` = current version (direct edit, override) / `baseSpecVersionId` = current (approval) | `applySpecChangeInTx` + `@@unique` backstop (P2002 mapped) | `STALE_SPEC_VERSION` |
| Direct edit only when policy = `DIRECT` | `editSpec` | `CHANGE_REQUEST_REQUIRED` / `ADMIN_OVERRIDE_REQUIRED` / `WORK_ITEM_LOCKED` |
| Redesign choice given iff `REQUIRED` | `editSpec` | `REDESIGN_CHOICE_REQUIRED` / `REDESIGN_NOT_ALLOWED` |
| Change request only in `IN_PRODUCTION`; at most one `PENDING` per Work Item | `createChangeRequest` (row lock) + partial unique index | `NOT_IN_PRODUCTION` / `CHANGE_REQUEST_PENDING` |
| Approval only while Work Item is `IN_PRODUCTION` | `approveChangeRequest` | `WORK_ITEM_LEFT_PRODUCTION` |
| `REDESIGN` requires `requiresDesign ∧ assigneeId` | `approveChangeRequest`, `adminOverrideSpec` | `REDESIGN_NOT_ALLOWED` |
| Return origin department resolvable | `sendBackForCustomerChangeInTx` | `ORIGIN_DEPARTMENT_REQUIRED` |
| Reason required (non-empty after trim, ≤ 2000): request, reject, withdraw, late cancel, override | Zod | `VALIDATION` |
| Late cancel only from `IN_PRODUCTION`/`PRODUCTION_COMPLETED`/`READY_FOR_COLLECTION`; cost decimal string ≥ 0, ≤ 2 dp, required | `cancelAfterProductionStarted` + Zod | `LATE_CANCEL_NOT_APPLICABLE` / `VALIDATION` |
| Override refused in `CANCELLED`, while a CR is pending, or while an approved revision is unacknowledged | `adminOverrideSpec` | `WORK_ITEM_LOCKED` / `CHANGE_REQUEST_PENDING` / `REVISION_UNACKNOWLEDGED` |
| Diff versions must belong to the same Work Item | `getSpecVersionDiff` | `VERSION_MISMATCH` |
| Acknowledge only when hold kind = `REVISION_UNACKNOWLEDGED`; acknowledges every unacknowledged approval of the Work Item at once | `acknowledgeSpecRevision` | `NOTHING_TO_ACKNOWLEDGE` |

## Permission model

| Action | Permission | Scope |
|---|---|---|
| View history / diff | any of `order.edit`, `finance.view`, `design.work`, `design.review`, `change.approve`, `admin.override`, or `production.operate` (department-scoped). This is "anyone who can view the order" (US4) and is an any-of `PermissionSpec` on `defineQuery`, plus an `authorize` hook for the department scope (contracts/aspects.md) | effective department for `production.operate` |
| `editSpec` | `order.edit` | none |
| `createChangeRequest`, `withdrawChangeRequest` | `order.edit` | none |
| `approveChangeRequest`, `rejectChangeRequest`, `listPendingChangeRequests`, `getChangeRequestDetail` | `change.approve` | none |
| `acknowledgeSpecRevision` | `production.operate` | `{ departmentId: effectiveDepartmentId }` |
| `cancelAfterProductionStarted` | `order.cancel` | none |
| `adminOverrideSpec` | `admin.override` | none |

`PRODUCTION_OPERATOR` holds none of `order.edit`/`change.approve` in the seed, so FR-018 holds by
data. It is asserted by the permission test (the role-permission matrix, plus integration tests
calling each command as an operator).

## Migration & backfill plan (data preservation)

Constitution: "destructive migrations on operational or audit tables require explicit approval
and a data-preservation plan". This change is **non-destructive**. The plan below is still written
out, as the brief requires.

**Step 0: Pre-flight** (operator, on the target DB): take a backup with `pg_dump` (the regular
backup job suffices), and record `SELECT count(*) FROM "WorkItem"` as `N`.

**Step 1: DDL** (tasks T002, blocked on schema-owner confirmation): `pnpm exec prisma db push
--schema prisma/schema`. It creates 3 enums and 3 tables, adds the nullable unique
`WorkItem.currentSpecVersionId` plus its FK, and adds indexes. No existing column changes. `db push`
must report no data-loss warnings. If it does, **stop**: something other than 016's diff is in
the schema.

**Step 2: Constraints** (`prisma/manual-sql/016-change-control-constraints.sql`, idempotent):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "ChangeRequest_one_pending_per_work_item"
  ON "ChangeRequest" ("workItemId") WHERE status = 'PENDING';
REVOKE UPDATE, DELETE ON "SpecVersion" FROM CURRENT_USER;
REVOKE UPDATE, DELETE ON "LateCancellation" FROM CURRENT_USER;
```

(The same non-superuser prerequisite as `audit-event-append-only.sql`. Re-apply after every
`db push`.)

**Step 3: Backfill** (`prisma/manual-sql/016-spec-version-backfill.sql`, idempotent, a single
transaction):

```sql
BEGIN;
INSERT INTO "SpecVersion" (id, "workItemId", version, origin, "productTypeId", description,
  quantity, "widthValue", "heightValue", "dimensionUnit", material, "finishNotes",
  "stateAtCreation", reason, "createdById", "createdAt")
SELECT 'bf_' || w.id, w.id, 1, 'BACKFILL', w."productTypeId", w.description, w.quantity,
  w."widthValue", w."heightValue", w."dimensionUnit", w.material, w."finishNotes",
  w.state, 'Backfilled by 016-change-control from current values', NULL, now()
FROM "WorkItem" w
WHERE NOT EXISTS (SELECT 1 FROM "SpecVersion" s WHERE s."workItemId" = w.id);

-- Point every Work Item at its highest version (handles re-runs and self-healed items).
-- Does NOT touch "updatedAt" (raw SQL bypasses @updatedAt).
UPDATE "WorkItem" w SET "currentSpecVersionId" = s.id
FROM "SpecVersion" s
WHERE s."workItemId" = w.id
  AND s.version = (SELECT max(version) FROM "SpecVersion" m WHERE m."workItemId" = w.id)
  AND w."currentSpecVersionId" IS DISTINCT FROM s.id;

-- AuditEvent is @@map("audit_event") in identity.prisma; core models are unmapped.
INSERT INTO "audit_event" (id, action, "entityType", "entityId", "actorId", after,
  "attachmentIds", "createdAt")
SELECT 'bf_audit_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'), 'spec_version.backfilled',
  'Migration', '016-change-control', NULL,
  jsonb_build_object('backfilled', (SELECT count(*) FROM "SpecVersion" WHERE origin = 'BACKFILL')),
  '{}'::text[], now();
COMMIT;
```

Table and column names were checked against `core.prisma`/`identity.prisma` when this plan was
written. The implementation task (T005) re-checks them against the schema at that time. Re-running inserts no
versions, and the re-run's audit row makes the re-run itself visible.

**Step 4: Verification** (must return **zero rows**, and is also in quickstart.md):

```sql
-- (a) every Work Item has a current version
SELECT id FROM "WorkItem" WHERE "currentSpecVersionId" IS NULL;
-- (b) mirror columns equal the current version
SELECT w.id FROM "WorkItem" w JOIN "SpecVersion" s ON s.id = w."currentSpecVersionId"
WHERE (w."productTypeId", w.description, w.quantity, w."widthValue", w."heightValue",
       w."dimensionUnit", w.material, w."finishNotes")
  IS DISTINCT FROM
      (s."productTypeId", s.description, s.quantity, s."widthValue", s."heightValue",
       s."dimensionUnit", s.material, s."finishNotes");
-- (c) exactly N backfilled-or-initial v1 rows
SELECT count(*) FROM "SpecVersion" WHERE version = 1;  -- must equal N
```

**Step 5: Deploy the app build.** From here all writes go through `applySpecChangeInTx`. Any Work
Item created between steps 1 and 5 by the old build is healed at first touch by
`ensureCurrentSpecVersionInTx`. Re-running step 3 at any time is also safe.

**Rollback**: redeploy the previous build. It ignores the new tables and the nullable column, so
nothing needs to be undone. If the tables must ever be removed, first run `pg_dump -t
'"SpecVersion"' -t '"ChangeRequest"' -t '"LateCancellation"'` and archive it with the backups, since
those rows are audit-relevant history. **Pre-existing edit history** (011's `workitem.edited`
audit events) is untouched and remains readable (FR-005).
