# Phase 1 Data Model: Production Workflow

## Schema diff (`prisma/schema/core.prisma`)

### `WorkItem` — new columns

```prisma
model WorkItem {
  // ...existing fields unchanged...

  /// Set on completion (US4, FR-006/FR-007). Required by completeProduction();
  /// validated non-null and > 0 before the completion transition runs.
  producedQuantity     Int?
  /// Optional free-text notes recorded at completion.
  productionNotes      String?
  /// Non-null while a newer DesignVersion was approved during IN_PRODUCTION
  /// and the operator has not yet acknowledged it (US7, FR-013). Set by the
  /// approval path (013's approveDesign, extended to check for an
  /// in-production Work Item on the same order's design), cleared by
  /// acknowledgeFileRevision(). research.md §4 — a plain field, not a guard.
  pendingFileRevisionAt DateTime?

  vendorProductionRecords VendorProductionRecord[]
}
```

### `Department` — new column

```prisma
model Department {
  // ...existing fields unchanged...

  /// Configured flag (constitution VI), not a hardcoded department-name
  /// check (research.md §5, US6).
  isExternalProduction Boolean @default(false)
}
```

### New model: `VendorProductionRecord`

```prisma
model VendorProductionRecord {
  id         String    @id @default(cuid())
  workItemId String
  workItem   WorkItem  @relation(fields: [workItemId], references: [id])
  vendorName String
  sentAt     DateTime  @default(now())
  /// Null until recordReceivedFromVendor() runs; completeProduction() MUST
  /// refuse completion while this is null for a Work Item routed to an
  /// external-production department (FR-012).
  receivedAt DateTime?
  createdById String
  createdBy   User     @relation("VendorProductionRecordCreatedBy", fields: [createdById], references: [id])

  @@index([workItemId])
}
```

### `User` (identity.prisma) — new back-relation

```prisma
model User {
  // ...existing fields unchanged...
  vendorProductionRecordsCreated VendorProductionRecord[] @relation("VendorProductionRecordCreatedBy")
}
```

### `src/server/core/workflow/edges.ts` — new allowed edge

```ts
IN_PRODUCTION: ["PRODUCTION_COMPLETED", "REWORK_REQUIRED", "CANCELLED"],
```

(research.md §2 — the only workflow-edge change this feature makes.)

## Derived values (never stored)

- **`enteredQueueAt`** (per Work Item, queue only): the most recent `WorkItemTransition.at` where
  `to = "READY_FOR_PRODUCTION"` — same derivation pattern as 012/013's queues (research.md §6).
- **Active production duration**: `sum(PhaseTiming WHERE workItemId = ... AND phase =
  "IN_PRODUCTION" AND kind = "ACTIVE")` intervals, re-derived at every read (constitution III) —
  never a stored/incremented duration field.
- **Department workload** (`getDepartmentWorkload`, FR-014): per department, `count(WorkItem WHERE
  departmentId = ... AND state = "READY_FOR_PRODUCTION")` and `count(WorkItem WHERE departmentId =
  ... AND state = "IN_PRODUCTION")` — two plain counts, no new aggregate table.
- **Revised-file badge** (queue display, US1 Acceptance Scenario 3): `pendingFileRevisionAt IS NOT
  NULL` on the Work Item row already being read for the queue — no extra query.

## Validation rules

- `completeProduction()`: `producedQuantity` required, must be a positive integer
  (`z.number().int().positive()`); refuses completion (validation error, no state change) if
  omitted or non-positive (FR-006, spec.md US4 Acceptance Scenario 3).
- `completeProduction()`: for a Work Item whose `Department.isExternalProduction` is true, refuses
  completion unless a `VendorProductionRecord` for that Work Item has a non-null `receivedAt`
  (FR-012, spec.md US6 Acceptance Scenario 3).
- `sendBackToDesign()`: `reason` required, non-empty after trim (mirrors 013's `explanation`
  validation) — surfaced as a validation error, no state change, if omitted (spec.md US5
  Acceptance Scenario 2).
- `recordSentToVendor()`: `vendorName` required non-empty after trim; refuses if the target
  Work Item's department is not `isExternalProduction` (a job card for a normal department has no
  vendor-step UI to begin with, but the server validates independently per constitution V).
- `recordReceivedFromVendor()`: refuses if no prior `VendorProductionRecord` exists for the Work
  Item, or if the existing record already has a non-null `receivedAt` (no double-receipt).
- `resumeProduction()`: refuses (a plain `DomainProductionError`, not a `WorkItemTransitionError`)
  while `WorkItem.pendingFileRevisionAt` is non-null (US7, FR-013, research.md §4).

## Permission model (no new `Permission` key)

Reuses 001's already-seeded `production.operate` (queue, job card, timer, completion, send-back,
vendor steps — all scoped via `authorize(actor, "production.operate", { departmentId:
workItem.departmentId })`) and `files.download_production` (job-card file download). No schema or
seed change needed for permissions — both keys already exist in `src/server/auth/permissions.ts`
and are already seeded to `PRODUCTION_OPERATOR` in `prisma/seed.ts`.
