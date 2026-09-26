// Barrel — the only legal import surface for src/server/changes/**
// (eslint.config.js module-boundary rule, specs/016-change-control/plan.md
// "Structure Decision"). Populated incrementally as each task lands.

// Phase 2: errors and module result
export type { ChangeError, ChangeResult } from "./errors";

// Phase 2: spec fields, schemas, snapshots, and views
export {
  SPEC_FIELDS,
  specPatchSchema,
  toSpecSnapshot,
  mergeSpecPatch,
} from "./specFields";
export type {
  SpecField,
  SpecSnapshot,
  SpecPatch,
  SpecPatchInput,
  SpecVersionView,
  SpecColumns,
  WorkItemDimensionUnit,
} from "./specFields";

// Phase 2: policy
export {
  specEditPolicy,
  redesignChoice,
  canRedesignOnApproval,
} from "./policy";
export type { SpecEditPolicy, RedesignChoice } from "./policy";

// Phase 2: specification diffing
export { diffSpecSnapshots } from "./diff";
export type { SpecFieldChange } from "./diff";

// Phase 2: SPEC_CHANGED event and listener registry.
// Cross-team contract, frozen at merge: specs/016-change-control/contracts/events-and-ports.md §1.
// 051 Pricing registers "pricing.reset" at module load; the listener runs in the
// caller's tx, before commit, and may veto only with fail({ code: "SPEC_CHANGE_VETOED" }).
// Emitted exactly once per version after v1 (never for INITIAL/BACKFILL or refusals).
export {
  SPEC_CHANGED,
  registerSpecChangeListener,
} from "./events";
export type { SpecChangedEvent, SpecChangeListener } from "./events";

// Phase 2: cross-team ports
export {
  noopDirectCostPort,
  setDirectCostPort,
} from "./ports";
export type { LateCancellationCost, DirectCostPort } from "./ports";

// Phase 3: specification versioning
export {
  createInitialSpecVersionInTx,
  ensureCurrentSpecVersionInTx,
  applySpecChangeInTx,
  getSpecHistory,
} from "./versions";
export type {
  ApplySpecChangeInput,
  AppliedSpecChange,
  SpecHistoryResult,
} from "./versions";

// Phase 3: txScope runner for non-aspect callers
export { runInTxScope } from "./txScope";
export type { TxScopeOptions } from "./txScope";

// Phase 4: User Story 2 effects and editSpec
export {
  sendBackForCustomerChangeInTx,
} from "./effects";
export type {
  SendBackCtx,
  SendBackForCustomerChangeInput,
} from "./effects";

export {
  editSpec,
  editSpecInputSchema,
} from "./editSpec";
export type {
  EditSpecInput,
  EditSpecResult,
} from "./editSpec";

export {
  effectiveDepartmentId,
  usersWithPermission,
} from "./recipients";

// Phase 5: User Story 3 — change requests, production hold, transition guards
export { getProductionHold, acknowledgeSpecRevision, acknowledgeSpecRevisionInputSchema } from "./productionHold";
export type { ProductionHold } from "./productionHold";

export {
  createChangeRequest,
  createChangeRequestInputSchema,
  approveChangeRequest,
  approveChangeRequestInputSchema,
  rejectChangeRequest,
  withdrawChangeRequest,
  listPendingChangeRequests,
  listPendingChangeRequestsInputSchema,
  getChangeRequestDetail,
  getChangeRequestDetailInputSchema,
  closeChangeRequestInputSchema,
  findPendingChangeRequestId,
  findPendingChangeRequestIds,
  PENDING_QUEUE_DEFAULT_LIMIT,
  PENDING_QUEUE_MAX_LIMIT,
} from "./changeRequests";
export type { PendingChangeRequestRow, ChangeRequestDetail } from "./changeRequests";

export {
  registerChangeGuards,
  CHANGE_HOLD,
  LATE_CANCELLATION_REQUIRED,
  LATE_CANCEL_STATES,
} from "./guards";

// Phase 8: User Story 6 — late cancellation
export {
  cancelAfterProductionStarted,
  cancelAfterProductionStartedInputSchema,
} from "./lateCancellation";
export type { CancelAfterProductionStartedInput } from "./lateCancellation";

// Phase 9: User Story 7 — admin override
export { adminOverrideSpec, adminOverrideSpecInputSchema } from "./adminOverride";
export type { AdminOverrideSpecInput, AdminOverrideSpecResult } from "./adminOverride";

// Phase 6: User Story 4 — version diffs
export {
  getSpecVersionDiff,
  getSpecVersionDiffInputSchema,
  getProductionStartSpecDiff,
  productTypeNamesForChanges,
} from "./versions";
export type { ProductionStartSpecDiff } from "./versions";

// Importing the barrel (or any 014/011 file that transitions, which imports
// it) registers the guards. Idempotent, so repeated imports are harmless
// (research §18, T046).
import { registerChangeGuards as registerChangeGuardsOnImport } from "./guards";
registerChangeGuardsOnImport();
