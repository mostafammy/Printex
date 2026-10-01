// index.ts — the public surface of the pipeline bounded context (093).
//
// The `import "./guards"` below is load-bearing, not decoration. It is the
// same pattern `src/server/review/index.ts` uses for its no-self-review
// guard: guard registration is a module-load side effect, and every caller is
// required to enter through this barrel, so importing anything from the
// pipeline guarantees the gates are already in the registry before a single
// transition can run.
//
// If that import is ever removed, the pipeline stops being enforced and every
// test in `tests/contract/pipeline/` fails — which is the intent: the gates
// must be impossible to leave switched off.

import "./guards";

// 093: derived stage, no stored status (constitution I).
export {
  isInStage,
  PIPELINE_ORDER,
  stageIndex,
  stageOf,
  statesInStage,
} from "./stage";
export type { PipelineStage } from "./stage";

// 093 US3/FR-014: the accountant's sign-off and the printer release.
export {
  approveForProduction,
  hasAccountingApproval,
  listAwaitingAccountingApproval,
  PipelineTransitionError,
} from "./approval";
export type {
  AccountingApprovalSnapshot,
  ApproveForProductionInput,
} from "./approval";
