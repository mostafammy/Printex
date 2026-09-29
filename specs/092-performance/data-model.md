# Data Model: Navigation Responsiveness & Server-Side Fetch Efficiency

## No schema delta

092 adds **no new persistent entities and no write paths**. Slices S1–S7 and S9 change only how existing data is read, ordered, batched, and streamed — every Prisma model is untouched (spec "Key Entities": no new persistent entities). No table is created, altered, or dropped for read-shape work; no column, enum, or constraint changes. The only possible schema touch is the verification-gated **index DDL in §Conditional schema delta** below, which is blocked behind `db-verification.md` evidence (FR-025…FR-028, DB-001…DB-005).

## Ownership boundary

No data becomes 092-owned. `Actor`/session stays 001-owned (widening is additive display data); `NotificationView`/count stays 053-owned; `PhaseDurations`/timer rows and `EligibleDesigner` stay 012-owned; review-queue rows stay 013-owned; order detail stays 011/016-owned; `WorkItem`/`notification`/`audit_event`/`FileObject` tables stay with their owning features. 092 consumes their read shapes through the contracts below.

## Request / in-memory shapes

All shapes below are request-scoped values passed between server services and components. None is stored.

### Actor (display-capable) — Contract §1

| Field           | Type           | Rules                                                                                                   |
| --------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| `userId`        | String         | unchanged (FR-010)                                                                                      |
| `roles`         | String[]       | unchanged                                                                                               |
| `permissions`   | Set/String[]   | unchanged — `authorize()` inputs untouched (SEC-002)                                                    |
| `departmentIds` | String[]       | unchanged                                                                                               |
| `name`          | String \| null | **new, display-only**; sourced from the user row the session/RBAC load already returns (FR-008, FR-010) |
| `username`      | String \| null | **new, display-only**; same source; never an authorization input                                        |

Resolution stays per-request via `getActor` / `getActorForSession`; `isActive` enforcement and redirect-on-unauthenticated unchanged (FR-009, SEC-001).

### PhaseDurations (per work item) — Contract §4

| Field                  | Type           | Rules                                                                                                 |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `queueTimeMs`          | number \| null | identical to `phaseDurations(actor, id)` output (FR-017)                                              |
| `activeTimeMs`         | number \| null | identical                                                                                             |
| `totalPhaseDurationMs` | number \| null | `null` when `DESIGN_COMPLETED` has no preceding start (Edge Cases); rework-restarted phases identical |

Batched loader returns `Map<workItemId, PhaseDurations>` (or aligned array) derived from **one shared pure helper** extracted from the current per-row math — both paths must call the same function so semantics cannot drift.

### EligibleDesigner + batch result map — Contract §5

| Field               | Type                                  | Rules                                                                                                                     |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| input `workItemIds` | String[]                              | batch IDs; empty → empty result, **zero queries**                                                                         |
| result              | `Map<workItemId, EligibleDesigner[]>` | per-work-item lists deep-equal repeated `getEligibleDesigners` (AC-009 equivalence via T017); suggestion output identical |
| authorize           | —                                     | `authorize(actor, "workitem.assign_designer")` enforced once, server-side (FR-014)                                        |

### Bell re-read payload — Contract §3

| Field   | Type               | Rules                                                                     |
| ------- | ------------------ | ------------------------------------------------------------------------- |
| `count` | number             | caller's unread count; same value `unreadCount` computes (FC-004)         |
| `rows`  | NotificationView[] | first page only (`page: 1`), same shape `listNotifications` returns today |

Delivered as the `revalidate` prop return type `() => Promise<{ count, rows }>` (Clarifications 2026-09-29); the bell sets local state from the return value — never via `router.refresh()` (FR-019, FR-020).

### Review-queue page result — FR-029 / AC-021

| Field                            | Type       | Rules                                                                                                                                                           |
| -------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`                           | queue rows | one page at the source (server-side pagination, not `paginateInMemory`); display ordering and entered-queue timestamp unchanged                                 |
| `totalCount` / pagination fields | number     | same `?page=` semantics preserved; statistics describe the **full backlog** the pages cover — no fixed `take` ceiling, no stranding (Clarifications 2026-09-29) |
| per-row transition               | —          | fetched as `to = WAITING_REVIEW`, most recent, `take: 1` — only the element the row displays                                                                    |

### Order-detail orchestration phases — FR-013

No shape change. Reads group as: `Promise.all([getOrderDetail, creationEvent])` → `Promise.all([assigneeRows, reworkCounts])` → `departments` ∥ `findPendingChangeRequestIds` where independent → `getEligibleDesignersBatch`. Output objects handed to the page are byte-identical to today's (AC-010).

### Query-capture helper result — T001 (test-only)

| Field     | Type     | Rules                                                                                                                    |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `result`  | T        | wrapped function's return value                                                                                          |
| `queries` | string[] | SQL/Prisma query strings captured from the `query`-event buffer, reset per capture; used to assert AC-005/009/011 counts |

Never imported by production code.

## Validation rules per shape

- **Scoping (SEC-003 / FR-018)**: batch duration IDs come only from the actor's already-authorized queue rows; the loader's `where` is restricted to the passed IDs and never widens — a cross-user work item cannot enter (AC-013, two-user fixture). The bell re-read authenticates the caller and scopes rows exactly as `listNotifications`/`unreadCount` do; another user's notifications unreachable (SEC-003).
- **Empty / edge inputs**: `getEligibleDesignersBatch([])` → empty result with zero queries (no empty-IN query storm — Edge Cases). Order with zero assignable work items → batch skipped.
- **Null duration cases**: `totalPhaseDurationMs = null` (no preceding start), rows with no QUEUE/ACTIVE segments, rework-restarted phases — all must equal per-row output (AC-012).
- **Authorization refusal parity**: unauthorized batch actor returns the same `FORBIDDEN` as the single-item path; non-assignable state behaves as today (T017).
- **Bell ordering**: a late-arriving re-read response MUST NOT overwrite newer local state — latest response wins (Contract §3).
- **Unchanged authority**: no shape carries client-computed permissions or stale data into fallbacks (FR-007, SEC-004); durations remain computed from persisted timestamps (BC-002).

## State transitions

**None.** 092 is read-only: no entity gains or changes lifecycle state, no FSM edge, gate, audit emission, or write path is touched (BC-001, TR-005, plan Constitution Check). There is nothing to diagram — notification read-state transitions remain 053's mark-read server actions, unchanged (FR-021).

## Conditional schema delta (verification-gated)

APPLY **ONLY IF** `db-verification.md` shows the item missing (FR-026, DB-002, AC-019). Unreachable DB ⇒ all DDL blocked, nothing assumed absent (FR-028). Drift findings route to 091, not fixed here (FR-027, DB-004).

| ID   | Candidate DDL                                                                                        | Serving query site                                                                            | Write-cost note                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | `WorkItem_state_createdAt_id_idx` on `WorkItem(state, createdAt, id)`                                | `lanePage.ts:103`, `projection.ts:136` — board lane filter+sort with skip/take ×14 lanes      | Moderate: `state` changes on every transition (hot) but narrow columns, user-paced writes; win is sort-elimination (Investigation §9) |
| R2   | `Notification_userId_archivedAt_createdAt_idx` on `notification(userId, archivedAt, createdAt DESC)` | `center.ts:117-129` list, `unreadCount:99`, mark-all-read                                     | Low: per-user, archival rare (Investigation §9)                                                                                       |
| R3   | `audit_event_entityId_action_createdAt_idx` on `audit_event(entityId, action, createdAt)`            | `orders/[orderId]/page.tsx:456-458` — order-detail audit probe, every navigation of that page | Moderate: hottest write table, 3 narrow columns, no FK compounding (Investigation §9, DB-005)                                         |
| drop | Drop `FileObject_sha256_idx`                                                                         | duplicate of unique `FileObject_sha256_key` (`add_files_schema/migration.sql:559`)            | Free win — removes an index write cost (Investigation §9)                                                                             |

Not modeled here: R4 `Order(priority, createdAt)` is "measure first", explicitly out of scope (spec Out of Scope). DDL ships as one reviewed Prisma migration in the tree T035 proves authoritative, never `db push` over prod (DB-003).

## Cross-references (spec IDs)

- No-schema-delta & read-only: Key Entities, TR-005, BC-001, BC-002, Constitution III.
- `Actor` widening: FR-008, FR-009, FR-010, FR-012, AC-005/006/007, Contract §1.
- `PhaseDurations` batch: FR-016, FR-017, FR-018, AC-011/012/013, PR-003, Contract §4.
- `EligibleDesigner` batch: FR-014, AC-008/009, PR-004, Contract §5.
- Bell `{count, rows}`: FR-019…FR-022, AC-014/015/016, PR-005, SEC-003, FC-004, Contract §3.
- Review-queue page result: FR-029, AC-021, DF-004/DF-005.
- Order-detail orchestration: FR-013, FR-015, AC-008/010, DF-001.
- Query-capture helper: PR-008, Test Expectations §2, T001.
- Conditional indexes: FR-025…FR-028, DB-001…DB-005, AC-019/020, Contract §8.
