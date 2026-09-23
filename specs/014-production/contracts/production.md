# Contracts: Production Workflow

All functions live in `src/server/production/**`, exported only from the barrel
`src/server/production/index.ts` (module-boundary ESLint rule, mirrors `orders`/`designers`/
`review`). Every function takes `actor: Actor` first and calls `authorize()` before touching data.

## `routeToDepartment(actor: Actor, workItemId: string, departmentId: string): Promise<void>`

- `authorize(actor, "orders.manage")` or equivalent Head-Designer/Reception permission (FR-001 —
  not `production.operate`, since routing is a pre-production decision made by whoever approves or
  receives the order, not the operator who later works it; final permission key confirmed against
  001's existing role/permission table during implementation, no new key expected).
- Refuse (`DomainProductionError("PRODUCTION_ALREADY_STARTED")`) once the Work Item is
  `IN_PRODUCTION` or later — routing is only changeable "before production starts" (FR-001).
- Sets `WorkItem.departmentId = departmentId`, overriding whatever the effective-department
  fallback (research.md §8) would otherwise have derived from the Product Type's
  `defaultDepartmentId`. No state transition.

## `getOperatorQueue(actor: Actor): Promise<ProductionQueueRow[]>`

- `authorize(actor, "production.operate")` (no department scope on the queue call itself — the
  query already filters to the actor's own departments).
- Query `WorkItem WHERE state = "READY_FOR_PRODUCTION"` and filter to rows whose **effective**
  department (research.md §8: `departmentId ?? productType.defaultDepartmentId`) is in
  `actor.departmentIds`.
- Derive `enteredQueueAt`, sort urgent-first then oldest (research.md §6/§7).
- `ProductionQueueRow`: `{ workItemId, orderId, orderNumber, customerName, productTypeName,
  departmentId, priority, enteredQueueAt, hasPendingFileRevision }`.

## `getJobCard(actor: Actor, workItemId: string): Promise<JobCard>`

- Load the Work Item; throw `DomainProductionError("WORK_ITEM_NOT_FOUND")` if missing.
- `authorize(actor, "production.operate", { departmentId: workItem.departmentId })`.
- Return read-only spec fields (dimensions, quantity, material, notes), the approved
  `DesignVersion`'s download pointer only (never a draft — FR-004), current
  `pendingFileRevisionAt`, and (if the department `isExternalProduction`) the latest
  `VendorProductionRecord` if any.
- `JobCard`: `{ workItemId, state, order: {...}, spec: {...}, approvedFile: { versionId,
  fileName, downloadUrl } | null, pendingFileRevisionAt: Date | null, vendorRecord:
  VendorRecordSummary | null }`.

## `startProduction(actor: Actor, workItemId: string): Promise<void>`

- `authorize(actor, "production.operate", { departmentId })`.
- `db.$transaction`: `transitionWorkItem(tx, { workItemId, to: "IN_PRODUCTION", actor })`; open a
  `PhaseTiming` row (`phase: "IN_PRODUCTION", kind: "ACTIVE", startedAt: now`).
- Refuses (via `transitionWorkItem`'s own edge check) if the Work Item is not
  `READY_FOR_PRODUCTION`.

## `pauseProduction(actor: Actor, workItemId: string): Promise<void>`

- `authorize(actor, "production.operate", { departmentId })`.
- Closes the open `ACTIVE` `PhaseTiming` row (`endedAt: now`). No state transition — the Work Item
  stays `IN_PRODUCTION`.

## `resumeProduction(actor: Actor, workItemId: string): Promise<void>`

- `authorize(actor, "production.operate", { departmentId })`.
- Refuses with `DomainProductionError("PENDING_FILE_REVISION")` while
  `WorkItem.pendingFileRevisionAt` is non-null (research.md §4, FR-013) — no new `PhaseTiming` row
  opened.
- Otherwise opens a new `ACTIVE` `PhaseTiming` row (`startedAt: now`).

## `acknowledgeFileRevision(actor: Actor, workItemId: string): Promise<void>`

- `authorize(actor, "production.operate", { departmentId })`.
- Sets `WorkItem.pendingFileRevisionAt = null`. Does not itself resume the timer — the operator
  still calls `resumeProduction()` after acknowledging (US7 Acceptance Scenario 3).

## `completeProduction(actor, workItemId, input: { producedQuantity: number; notes?: string }): Promise<void>`

- `authorize(actor, "production.operate", { departmentId })`.
- Validate `producedQuantity` (positive integer, data-model.md's Validation rules) before opening
  a transaction — a bad submission never reaches the DB.
- If `Department.isExternalProduction`, refuse unless a `VendorProductionRecord` with non-null
  `receivedAt` exists for this Work Item (FR-012).
- `db.$transaction`: close any open `ACTIVE` `PhaseTiming` row; `transitionWorkItem(tx, {
  workItemId, to: "PRODUCTION_COMPLETED", actor })`; `tx.workItem.update({ producedQuantity,
  productionNotes: notes })`; `audit.record(tx, { action: "workitem.production_completed", ... })`.

## `sendBackToDesign(actor, workItemId, input: { reason: string }): Promise<{ returnId: string }>`

- `authorize(actor, "production.operate", { departmentId })`.
- Validate `reason` (non-empty after trim).
- `db.$transaction`: close any open `ACTIVE` `PhaseTiming` row (research.md — timer stops, same as
  completion); `transitionWorkItem(tx, { workItemId, to: "REWORK_REQUIRED", actor, reason,
  rejectionCategory: "PRODUCTION_ISSUE" })` (research.md §2's new edge); call 013's
  `createReturnInTx(tx, actor, workItemId, { category: "PRODUCTION_ISSUE", originDepartmentId:
  workItem.departmentId, assignedToId: workItem.assigneeId, explanation: input.reason })`
  (research.md §3); `notify(tx, { type: "workitem.rejected", ... })`.

## `recordSentToVendor(actor, workItemId, input: { vendorName: string }): Promise<{ recordId: string }>`

- `authorize(actor, "production.operate", { departmentId })`.
- Refuse (`DomainProductionError("NOT_EXTERNAL_DEPARTMENT")`) unless
  `Department.isExternalProduction`.
- Creates a `VendorProductionRecord` row (`sentAt: now`, `receivedAt: null`).

## `recordReceivedFromVendor(actor, workItemId, recordId: string): Promise<void>`

- `authorize(actor, "production.operate", { departmentId })`.
- Refuse (`DomainProductionError("ALREADY_RECEIVED")`) if the record's `receivedAt` is already
  non-null.
- Sets `receivedAt = now`.

## `getDepartmentWorkload(actor: Actor): Promise<DepartmentWorkload[]>`

- `authorize(actor, "production.operate")` (or a broader dashboard-reading permission — final call
  deferred to 090's own integration, per that feature's contract).
- Per department: `readyCount`, `inProductionCount` (data-model.md's Derived values).

## Errors

`DomainProductionError` codes: `WORK_ITEM_NOT_FOUND | NOT_READY_FOR_PRODUCTION |
PENDING_FILE_REVISION | MISSING_PRODUCED_QUANTITY | VENDOR_RECEIPT_REQUIRED |
NOT_EXTERNAL_DEPARTMENT | ALREADY_RECEIVED | PRODUCTION_ALREADY_STARTED`.
`WorkItemTransitionError` (mirrors 011/012/013) surfaces `transitionWorkItem`'s own `Result` error
unchanged for edge-check failures.

## Authorization table

| Function | Permission | Department-scoped? |
|---|---|---|
| `routeToDepartment` | Head-Designer/Reception routing permission (FR-001) | No (pre-production) |
| `getOperatorQueue` | `production.operate` | Implicit (query filter) |
| `getJobCard` | `production.operate` | Yes (`{ departmentId }`) |
| `startProduction`/`pauseProduction`/`resumeProduction` | `production.operate` | Yes |
| `acknowledgeFileRevision` | `production.operate` | Yes |
| `completeProduction` | `production.operate` | Yes |
| `sendBackToDesign` | `production.operate` | Yes |
| `recordSentToVendor`/`recordReceivedFromVendor` | `production.operate` | Yes |
| `getDepartmentWorkload` | `production.operate` | No (cross-department summary) |
| Job-card file download | `files.download_production` | Yes |
