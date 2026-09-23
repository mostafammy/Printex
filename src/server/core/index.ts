// Public barrel export — plan.md §5.6, contracts/*.md.
//
// This is the ONLY legal public surface of `src/server/core/**`. Nothing
// outside `core` may deep-import its internals — the ESLint module-boundary
// rule (eslint.config.js rule (b)) enforces this: any import matching
// `~/server/core/**` other than `~/server/core` or `~/server/core/index`
// itself is a lint error everywhere outside `src/server/core/**`.
//
// Re-exports exactly what contracts/*.md documents as public, nothing more.

// contracts: branded IDs (ids.ts)
export type { Brand, CustomerId, OrderId, WorkItemId, UserId } from "./ids";
export {
  asCustomerId,
  asOrderId,
  asWorkItemId,
  asUserId,
} from "./ids";

// contracts: Result (result.ts)
export type { Result } from "./result";
export { ok, err } from "./result";

// contracts/errors.md
export type { DomainError, ErrorCode, ActionResult } from "./errors";
export { toActionResult } from "./errors";

// Prisma `Json` field type
export type { JsonValue } from "./json";

// contracts/workflow.md: state model
export type { WorkItemState } from "./workflow/states";
export { WORK_ITEM_STATES, assertNever } from "./workflow/states";

// contracts/workflow.md: allowed-edges table
export { ALLOWED_EDGES } from "./workflow/edges";

// contracts/workflow.md: transitionWorkItem
export type { TransitionInput } from "./workflow/transition";
export { transitionWorkItem } from "./workflow/transition";

// contracts/workflow.md: registerGuard
export type {
  GuardContext,
  GuardResult,
  GuardFn,
  GuardRegistry,
} from "./workflow/guards";
export { registerGuard, runGuards } from "./workflow/guards";

// contracts/workflow.md: rejection categories
export type { RejectionCategory } from "./workflow/rejectionCategory";

// contracts/workflow.md: read-only Work Item projection
export type { WorkItemSnapshot } from "./workflow/snapshot";

// contracts: order status derivation
export { deriveOrderStatus } from "./orders";
export type { OrderStatusBucket } from "./orders";

// contracts/storage.md
export type { StorageAdapter } from "./storage/adapter";
export { LocalDiskStorageAdapter } from "./storage/local-disk";

// contracts/notifications.md
export { notify } from "./notifications/notify";
export type { NotifyEvent } from "./notifications/notify";

// contracts/workflow.md: Actor shape
export type { Actor } from "./actor";

// contracts/workflow.md: PhaseTiming segment primitives (specs/012-designer-
// assignment-timers/research.md §2 — added to the barrel here for the first
// time; the underlying functions/types are unchanged, owned by 002).
export { openSegment, closeOpenSegment, calculatePhaseDurationMs } from "./workflow/timing";
export type { PhaseTimingKind, PhaseTimingSegment } from "./workflow/timing";
