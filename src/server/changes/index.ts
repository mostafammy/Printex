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

// Phase 2: SPEC_CHANGED event and listener registry
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
