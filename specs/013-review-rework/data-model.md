# Phase 1 Data Model: Head Designer Review & Rework Loop

## New Prisma models (`prisma/schema/core.prisma`)

### `Return` (generic — FR-014)

```prisma
model Return {
  id                 String             @id @default(cuid())
  workItemId         String
  workItem           WorkItem           @relation(fields: [workItemId], references: [id])
  /// Actor who raised the return — the reviewer for a rejection; a
  /// production operator or pricer for a future 014/051-originated return.
  raisedById         String
  raisedBy           User               @relation("ReturnRaisedBy", fields: [raisedById], references: [id])
  originDepartmentId String
  originDepartment   Department         @relation(fields: [originDepartmentId], references: [id])
  category           RejectionCategory
  /// Who the return is directed at — the Work Item's assignee at the time
  /// of the return (denormalized so history survives later reassignment).
  assignedToId       String
  assignedTo         User               @relation("ReturnAssignedTo", fields: [assignedToId], references: [id])
  /// Required (FR-007) — the "why", distinct from `category`.
  explanation        String
  /// Optional free-text note, additional to `explanation`.
  note               String?
  /// The DesignVersion this return supersedes, when raised from this
  /// feature's own rejection flow (User Story 3). Null for a return raised
  /// by a department with no version concept (e.g. a future 051 pricing
  /// return).
  designVersionId    String?
  designVersion      DesignVersion?     @relation(fields: [designVersionId], references: [id])
  createdAt          DateTime           @default(now())

  attachments        ReturnAttachment[]

  @@index([workItemId, createdAt])
}
```

- **Immutable**: no application code path updates or deletes a `Return` row (FR-010, constitution
  III) — same rule as `WorkItemTransition`.
- **Reused by 014/051** (User Story 6): every field here applies to a Production- or
  Pricing-originated return; nothing is Review-specific except the optional `designVersionId` link,
  which is nullable precisely so a non-design return can omit it.
- `category` reuses 002's existing `RejectionCategory` enum (`src/server/core/workflow/
  rejectionCategory.ts` / the Prisma enum it mirrors) — no new enum.

### `ReturnAttachment`

```prisma
model ReturnAttachment {
  id         String             @id @default(cuid())
  returnId   String
  return     Return             @relation(fields: [returnId], references: [id])
  kind       ReturnAttachmentKind
  /// Opaque key passed to StorageAdapter.put/get (constitution IV) — no
  /// folder/filename semantics assumed by application code.
  storageKey String
  fileName   String
  mimeType   String?
  sizeBytes  Int
  createdAt  DateTime           @default(now())

  @@index([returnId])
}

enum ReturnAttachmentKind {
  VOICE_NOTE
  IMAGE
  FILE
}
```

- Zero or more per `Return` (FR-008) — none required.
- No size/length limit enforced by this feature beyond `StorageAdapter`'s own (research.md §3
  migration note; no review-specific voice-note-length limit per spec Assumptions).

## Extended existing model

### `DesignVersion` (012) — two new nullable columns

```prisma
model DesignVersion {
  // ...existing 012 fields unchanged...
  approvedAt   DateTime?
  approvedById String?
  approvedBy   User?     @relation("DesignVersionApprovedBy", fields: [approvedById], references: [id])

  returns Return[]  // back-relation for Return.designVersionId
}
```

- Set once by `approveDesign`, in the same transaction as the `WAITING_REVIEW → APPROVED`
  `transitionWorkItem` call. Never cleared or reset (FR-012, constitution IV) — a version that
  becomes wrong after approval requires a *new* version, not un-approving the old one (out of scope
  here; no such flow exists in this feature).
- A version with `approvedAt: null` is either not-yet-reviewed or was superseded by a `Return`
  pointing at it — the timeline (User Story 4) distinguishes the two by checking whether a `Return`
  references that `designVersionId`.

## Derived values (no schema — research.md §1)

- **Rework count** (FR-013, SC-006): `count(Return WHERE workItemId = X)`. Not a stored column.
- **Review queue rows** (FR-001): `WorkItem WHERE state = "WAITING_REVIEW"`, joined to its most
  recent `WorkItemTransition` landing in `WAITING_REVIEW` for `enteredQueueAt`, sorted urgent-first
  then oldest-`enteredQueueAt`-first — same shape as 012's `MyQueueRow` (`src/server/designers/
  queue.ts`), duplicated per research.md §6 rather than shared.
- **Version timeline** (FR-011, User Story 4): `DesignVersion` rows for a Work Item ordered by
  `version` ascending, left-joined to any `Return` where `designVersionId` matches, giving each
  version's outcome (approved-with-`approvedById`/`approvedAt`, or rejected-with-that-`Return`'s
  category/explanation/reviewer/`createdAt`).

## Seeded role × permission matrix — no change

Both `approveDesign` and `rejectDesign` `authorize(actor, "design.review")` — already seeded onto
`HEAD_DESIGNER` (and `ADMIN_OWNER`) by 001's `prisma/seed.ts`. No new `Permission` key, no seed
change required by this feature.

## Validation rules (Zod, server boundary — constitution V)

- `rejectDesign` input: `category` (enum, required), `originDepartmentId` (string, required, must
  reference an active `Department`), `explanation` (string, required, non-empty after trim),
  `note` (string, optional), `attachments` (array, optional, each with `kind`/`fileName`/
  `mimeType`/byte stream).
- `approveDesign` input: `workItemId` only — no free-text fields to validate.
