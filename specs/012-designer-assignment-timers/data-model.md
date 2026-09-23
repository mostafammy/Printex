# Data Model: Designer Assignment & Timers

Phase 1 output. Schema diff against `prisma/schema/core.prisma`, plus the read-only shapes this
feature computes but does not persist.

## Schema diff (`prisma/schema/core.prisma`)

### Reused, unchanged (grounding — no diff needed)

- `WorkItem.assigneeId String?` / `assignee User? @relation("WorkItemAssignee", ...)` — already
  exists (002). This feature is simply the first to write to it.
- `PhaseTiming` (`kind: QUEUE | ACTIVE`, `startedAt`, `endedAt`) — already exists (002). This
  feature is the primary producer of `ACTIVE` segments and a consumer of both kinds.
- `WorkItemTransition` (`from`, `to`, `actorId`, `at`, `reason`, `rejectionCategory`, `meta`) —
  already exists (002). `markDesignComplete()` produces two rows here per call (research.md §5).
- `Permission` key `workitem.assign_designer`, `RoleKey` `HEAD_DESIGNER` — already exist (001).

### New: `DesignVersion` model

```prisma
/// A single uploaded design file version for a Work Item (constitution IV:
/// "new version, never overwritten in place"). Bytes live in the existing
/// StorageAdapter (002); this table is metadata only. Owned by 012.
model DesignVersion {
  id           String   @id @default(cuid())
  workItemId   String
  workItem     WorkItem @relation(fields: [workItemId], references: [id])
  /// 1, 2, 3... per Work Item — never reused, never decremented.
  version      Int
  /// Opaque key passed to StorageAdapter.put/get — no folder/filename
  /// semantics assumed by application code (constitution IV).
  storageKey   String
  fileName     String
  mimeType     String?
  sizeBytes    Int
  sha256       String
  /// Short note the designer attaches (e.g. "v2 — updated logo size").
  note         String?
  uploadedById String
  uploadedBy   User     @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime @default(now())

  @@unique([workItemId, version])
  @@index([workItemId, createdAt])
}
```

`WorkItem` gains one back-relation field: `designVersions DesignVersion[]`.
`User` gains one back-relation field: `designVersionsUploaded DesignVersion[] @relation(...)`
(named relation, matching the existing `WorkItemAssignee`/`PhaseTimingUser` naming convention).

**Validation rules** (enforced in `src/server/designers/**`, not the schema):

- `version` MUST be `1 + count(existing DesignVersion rows for this workItemId)` at write time,
  computed inside the same transaction as the insert (optimistic — a `@@unique([workItemId,
  version])` constraint makes a race produce a DB error, not a silently wrong version number).
- `note` MAY be empty string but not omitted from the form (UI-level default `""`, not `null`) —
  matches 011's convention of never distinguishing "no note" from "empty note" in the DB.
- No delete path. A bad upload gets a corrective new version, same as every other constitution-IV
  entity — never a destructive fix.

### No other schema changes

- No new `Permission` key (research.md §1).
- No new `PhaseTiming`-shaped table (research.md §2).
- `ALLOWED_EDGES` (`src/server/core/workflow/edges.ts`) is unchanged — every transition this
  feature performs (`ASSIGNED`/`REWORK_REQUIRED → IN_DESIGN`, `IN_DESIGN → DESIGN_COMPLETED`,
  `DESIGN_COMPLETED → WAITING_REVIEW`, `DESIGN_COMPLETED → APPROVED`) is already a legal edge.

## `src/server/core/index.ts` barrel addition (not a schema change, but Foundational-phase work)

```ts
// ADD to the existing barrel — research.md §2's found gap:
export { openSegment, closeOpenSegment, calculatePhaseDurationMs } from "./workflow/timing";
export type { PhaseTimingKind, PhaseTimingSegment } from "./workflow/timing";
```

## Read-only computed shapes (not persisted)

### `EligibleDesigner` (assignment dialog rows, FR-002/FR-003)

```ts
interface EligibleDesigner {
  userId: string;
  name: string;
  activeWorkItemCount: number;      // WorkItem.assigneeId = userId AND state NOT IN terminal set
  queueSize: number;                // same as activeWorkItemCount today (V1: one shared queue definition)
  estimatedWaitMinutes: number;     // derived — research.md §6, exact formula an implementation detail
  pastJobsForCustomer: number;      // WorkItem.assigneeId = userId AND Order.customerId = target's customerId AND state IN (DELIVERED, COMPLETED)
  isSuggested: boolean;             // true for exactly one row — fewest activeWorkItemCount, tie-broken by earliest last assignment then name
}
```

"Terminal set" for `activeWorkItemCount`'s exclusion = `DELIVERED`, `COMPLETED`, `CANCELLED`
(matches `isOrderFinished`'s terminal-state list from 011's `completeness.ts`, reused for
consistent terminology across features).

### `MyQueueRow` (designer's personal queue, FR-008)

```ts
interface MyQueueRow {
  workItemId: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  productTypeName: string | null;
  description: string | null;
  dueDate: Date | null;
  priority: "NORMAL" | "URGENT";
  state: "ASSIGNED" | "IN_DESIGN" | "REWORK_REQUIRED";
  isRework: boolean;                // state === "REWORK_REQUIRED"
  rejectionDetails: { category: RejectionCategory; explanation: string | null } | null; // from the most recent WorkItemTransition landing in REWORK_REQUIRED
  hasOpenTimer: boolean;            // an ACTIVE PhaseTiming segment with endedAt: null exists for this workItem + the viewing designer
}
```

Sort: `priority === "URGENT"` first, then `assignedAt` ascending within each group. `assignedAt` =
the `at` timestamp of the most recent `WorkItemTransition` row landing in `ASSIGNED` or
`REWORK_REQUIRED` for this Work Item (no new column needed — this is already recorded).

### `PhaseDurations` (display, FR-014/FR-015)

```ts
interface PhaseDurations {
  // calculatePhaseDurationMs() over this WorkItem's QUEUE segments whose `phase` is `ASSIGNED` or
  // `REWORK_REQUIRED` only (auto-opened/closed by transitionWorkItem's own step 5 on every
  // transition — research.md §2 addendum). A QUEUE segment also auto-opens for phase `IN_DESIGN`,
  // `DESIGN_COMPLETED`, etc. as a side effect of transitioning INTO them; those are not "waiting
  // for a designer" time and MUST be excluded from this sum.
  queueTimeMs: number;
  activeTimeMs: number;  // calculatePhaseDurationMs() over this WorkItem's ACTIVE segments (all phase="IN_DESIGN" in practice — only this feature opens ACTIVE segments, always during IN_DESIGN)
  totalPhaseDurationMs: number | null; // null while still open; fixed once DESIGN_COMPLETED is reached — (DESIGN_COMPLETED transition's `at`) - (the earliest ASSIGNED/REWORK_REQUIRED transition's `at` since the last CANCELLED, if any)
}
```

## Seed data addition (`prisma/seed.ts`)

None required by this feature's default behavior — `workitem.assign_designer` is already seeded
onto `RECEPTION`/`ADMIN_OWNER` by 001's original `ROLE_SEED_DATA`. A shop that wants
`HEAD_DESIGNER` to also reassign adds `"workitem.assign_designer"` to that role's `permissions`
array — documented as an operational note in quickstart.md, not shipped as this feature's default
(Clarifications, 2026-09-23: default is reception/admin only).

