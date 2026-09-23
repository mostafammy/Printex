# Contract: Head Designer Review & Rework Loop

Owner: 013 (this feature). Consumers: 090 (dashboard — reads rework counts, review queue
volume), 014/051 (reuse the generic `createReturn`/`Return` shape for their own send-backs, per
research.md §3/§5, User Story 6), 054 (reads `approveDesign`'s outcome to trigger the customer
"design ready" WhatsApp message — out of scope here, consumes only).

All functions below live in `src/server/review/**` and are re-exported from the barrel
`src/server/review/index.ts` — the only legal import path for code outside this module (new
`eslint.config.js` module-boundary rule, same shape as `src/server/orders/**`/`src/server/
designers/**`).

Every function takes `actor: Actor` (from `~/server/auth`'s `getActor()`) as its first argument and
calls `authorize(actor, permission)` as its first statement — see the Authorization table at the
bottom.

## `getReviewQueue`

```ts
function getReviewQueue(actor: Actor): Promise<ReviewQueueRow[]>;
```

```ts
interface ReviewQueueRow {
  workItemId: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  productTypeName: string | null;
  priority: "NORMAL" | "URGENT";
  enteredQueueAt: Date;
  reworkCount: number;         // data-model.md derived value (research.md §1)
  isRework: boolean;           // reworkCount > 0
}
```

1. `authorize(actor, "design.review")`.
2. `db.workItem.findMany({ where: { state: "WAITING_REVIEW" }, ... })`.
3. For each row: `enteredQueueAt` from the most recent `WorkItemTransition` landing in
   `WAITING_REVIEW`; `reworkCount` from `count(Return WHERE workItemId = ...)`.
4. Sort urgent-first, then oldest-`enteredQueueAt`-first within each bucket (FR-001, research.md
   §6 — same rule as 012's `getMyQueue`).
5. Read-only — no transaction, no audit event.

## `getReviewDetail`

```ts
function getReviewDetail(actor: Actor, workItemId: string): Promise<ReviewDetail>;
```

```ts
interface ReviewDetail {
  workItemId: string;
  state: WorkItemState;
  order: { dimensions, quantity, material, customerNotes, ... };  // read from existing Order/WorkItem fields (011)
  versions: VersionSummary[];   // data-model.md — DesignVersion joined with any superseding Return
  currentVersion: VersionSummary;  // versions[versions.length - 1]
}
```

1. `authorize(actor, "design.review")`.
2. Loads the `WorkItem` (with `order`), its `DesignVersion` rows ordered by `version`, and any
   `Return` rows referencing each version — throws `DomainReviewError("WORK_ITEM_NOT_FOUND")` if
   missing (FR-003).
3. Read-only.

## `approveDesign`

```ts
function approveDesign(actor: Actor, workItemId: string): Promise<void>;
```

1. `authorize(actor, "design.review")`.
2. `db.$transaction(async (tx) => { ... })`:
   a. Load the `WorkItem` and its current (highest-`version`) `DesignVersion` inside `tx`. Throws
      `DomainReviewError("WORK_ITEM_NOT_FOUND")` if missing, `DomainReviewError("NOT_REVIEWABLE")`
      if `state !== "WAITING_REVIEW"`, `DomainReviewError("NO_DESIGN_VERSION")` if there is no
      current version.
   b. `transitionWorkItem(tx, { workItemId, to: "APPROVED", actor })` — the registered
      no-self-review guard (research.md §4) runs here and fails the whole call with
      `GUARD_FAILED` (surfaced as `WorkItemTransitionError`, not `DomainReviewError` — mirrors
      012's `assignment.ts` convention of not double-wrapping `transitionWorkItem`'s own error) if
      `currentVersion.uploadedById === actor.userId` (FR-005).
   c. `tx.designVersion.update({ where: { id: currentVersion.id }, data: { approvedAt: new Date(), approvedById: actor.userId } })`.
   d. `audit.record(tx, { action: "workitem.design_approved", entityType: "WorkItem", entityId: workItemId, actorId: actor.userId, after: { designVersionId: currentVersion.id } })`.
3. Whether the Work Item advances only to `APPROVED` or straight on to `READY_FOR_PRODUCTION` is
   governed by 002's existing edges/guards for `APPROVED`'s outgoing transitions (pricing-status
   dependent) — this function performs the single `WAITING_REVIEW → APPROVED` transition and stops
   there; it does not itself drive `APPROVED → READY_FOR_PRODUCTION` (FR-004 is satisfied by that
   edge already being unconditional on pricing per 002's `edges.ts`, not by this function forcing
   it).

## `rejectDesign`

```ts
function rejectDesign(
  actor: Actor,
  workItemId: string,
  input: {
    category: RejectionCategory;      // required
    originDepartmentId: string;       // required
    explanation: string;              // required, non-empty after trim
    note?: string;
    attachments?: Array<{ kind: "VOICE_NOTE" | "IMAGE" | "FILE"; fileName: string; mimeType?: string; stream: ReadableStream }>;
  },
): Promise<{ returnId: string }>;
```

1. `authorize(actor, "design.review")`.
2. Validate `input` with Zod at the server boundary (data-model.md) — throws a validation error
   (not `DomainReviewError`) before touching the transaction if `category`, `originDepartmentId`,
   or non-empty `explanation` is missing (FR-007).
3. `db.$transaction(async (tx) => { ... })`:
   a. Load the `WorkItem` and its current `DesignVersion` inside `tx`. Throws
      `DomainReviewError("WORK_ITEM_NOT_FOUND")` / `DomainReviewError("NOT_REVIEWABLE")` as in
      `approveDesign` step 2a.
   b. `transitionWorkItem(tx, { workItemId, to: "REWORK_REQUIRED", actor, reason: input.explanation, rejectionCategory: input.category })` — 002's existing required-field check for this edge already enforces `rejectionCategory` presence; this function supplies it from validated input.
   c. Attachment bytes (if any) are written via `StorageAdapter.put` *before* the transaction
      commits its metadata row (same ordering 012's `uploadDesignVersion` uses) — one
      `ReturnAttachment` row per attachment inside `tx`.
   d. `tx.return.create({ data: { workItemId, raisedById: actor.userId, originDepartmentId: input.originDepartmentId, category: input.category, assignedToId: workItem.assigneeId, explanation: input.explanation, note: input.note, designVersionId: currentVersion.id, attachments: { create: [...] } } })`.
   e. `notify(tx, { type: "workitem.rejected", entity: { type: "WorkItem", id: workItemId }, recipients: { userIds: [workItem.assigneeId] }, payload: { returnId, orderId: workItem.orderId } })` — same transaction as the `Return` write (FR-009, SC-003).
4. Returns `{ returnId }` so the caller can deep-link the notification.

## `createReturn` (generic — User Story 6, consumed by 014/051 later)

```ts
function createReturn(
  actor: Actor,
  workItemId: string,
  input: {
    category: RejectionCategory;
    originDepartmentId: string;
    assignedToId: string;
    explanation: string;
    note?: string;
    designVersionId?: string;
    attachments?: Array<{ kind: "VOICE_NOTE" | "IMAGE" | "FILE"; fileName: string; mimeType?: string; stream: ReadableStream }>;
  },
): Promise<{ returnId: string }>;
```

1. No `authorize()` beyond an authenticated actor — the caller (014/051) is responsible for its
   own permission check before invoking this; `createReturn` itself only writes the record (User
   Story 6's point: the shape and write path are generic, not Review-gated).
2. Same `Return`/`ReturnAttachment` write as `rejectDesign` step 3c–3d, without a
   `transitionWorkItem` call — **this function does not transition the Work Item**; a caller that
   also needs a state change (e.g. 014 sending a job back to design) performs its own
   `transitionWorkItem` call separately, in the same transaction it wraps around this function.
3. `rejectDesign` (above) is implemented as `transitionWorkItem(...)` followed by a call into this
   same write path — not duplicated logic.

## `getVersionTimeline`

```ts
function getVersionTimeline(actor: Actor, workItemId: string): Promise<TimelineEntry[]>;
```

```ts
interface TimelineEntry {
  version: number;
  fileName: string;
  uploadedById: string;
  uploadedAt: Date;
  outcome:
    | { kind: "APPROVED"; approvedById: string; approvedAt: Date }
    | { kind: "REJECTED"; returnId: string; category: RejectionCategory; explanation: string; reviewedById: string; reviewedAt: Date }
    | { kind: "PENDING" };  // no Return references it yet, not yet approved
}
```

1. No `authorize()` beyond an authenticated actor (FR-011 — "anyone with access to a Work Item",
   mirrors 012's `getMyQueue`/`phaseDurations` "authenticated only" rows).
2. Read-only join of `DesignVersion` + `Return` per data-model.md's "Derived values" section,
   ordered by `version` ascending.

## Guard registration (boot-time, `src/server/review/guards.ts`)

```ts
registerGuard({ to: "APPROVED" }, async (ctx) => {
  const currentVersion = /* load current DesignVersion for ctx.workItem.id */;
  if (currentVersion && currentVersion.uploadedById === ctx.actor.userId) {
    return { ok: false, error: { code: "GUARD_FAILED", message: "A reviewer cannot approve a design version they uploaded themselves." } };
  }
  return { ok: true, value: true };
});
```

Registered once at server boot (module import), same pattern as any other `registerGuard` caller
(research.md §4 — compares against the version's `uploadedById`, not `WorkItem.assigneeId`).

## Errors

`DomainReviewError` codes: `WORK_ITEM_NOT_FOUND | NOT_REVIEWABLE | NO_DESIGN_VERSION`. Mirrors
012's `DomainDesignerError` shape exactly (same base pattern, `src/server/orders/**`'s
`DomainOrderError` precedent) — throw-based, not `core`'s `Result` contract.

`transitionWorkItem`'s own `Result` error surfaces unchanged as a local `WorkItemTransitionError`
(same convention as 012's `assignment.ts`/`timer.ts`) for both the edge-validation failure and the
`GUARD_FAILED` self-review case — **not** wrapped in `DomainReviewError`.

## Authorization table

| Function | Permission | Notes |
|---|---|---|
| `getReviewQueue` | `design.review` | |
| `getReviewDetail` | `design.review` | |
| `approveDesign` | `design.review` | + server-side self-review guard (not a separate permission) |
| `rejectDesign` | `design.review` | |
| `createReturn` | none (authenticated only) | caller (014/051) owns its own authorization |
| `getVersionTimeline` | none (authenticated only) | matches 012's `phaseDurations` pattern |
