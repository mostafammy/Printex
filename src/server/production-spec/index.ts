// index.ts — the public surface of the production-specification bounded
// context (093). Import from here, never from a file inside the module: the
// internals are free to move without breaking callers, and the barrel is the
// one place that documents what this feature actually offers.

// 093 FR-001/FR-005: the canonical width round-up and the validated ladder.
export {
  assertWidthLadder,
  maxProductionWidthCm,
  resolveProductionWidth,
} from "./widths";
export type { ResolveWidthOk, ResolveWidthRefused, ResolveWidthResult, WidthLadder } from "./widths";

// 093 FR-006: production-area math, and FR-008/FR-010: the money.
export { computeProductionArea, formatRate, quoteRoll } from "./quote";
export type {
  AreaInput,
  FinishingRate,
  ProductionArea,
  RollQuote,
  RollQuoteInput,
  RollQuoteLine,
} from "./quote";

// 093 FR-003/FR-004/FR-007: the configuration boundary, and the roll defaults
// reception falls back to when no `ProductionWidthRule` row exists yet.
export {
  assertHeightWithinCap,
  assertRateWithinBand,
  defaultRollConstraints,
  isRollProductTypeName,
  loadProductionConstraints,
  loadReceptionConstraints,
  ROLL_MAX_HEIGHT_M,
  ROLL_MAX_RATE_PER_SQM,
  ROLL_MIN_RATE_PER_SQM,
  ROLL_WIDTH_LADDER_CM,
  toConstraints,
} from "./constraints";
export type { ProductionConstraints } from "./constraints";

// 093 FR-009: the extensible finishing catalogue.
export {
  createFinishingService,
  listActiveFinishingServices,
  resolveFinishingRates,
  retireFinishingService,
} from "./finishings";
export type { CreateFinishingServiceInput, FinishingServiceSnapshot } from "./finishings";

// 093 FR-003: audited width exceptions.
export {
  approvedWidthException,
  listPendingWidthExceptions,
  raiseWidthException,
  resolveWidthException,
} from "./exceptions";
export type {
  RaiseWidthExceptionInput,
  ResolveWidthExceptionInput,
  WidthExceptionTicketSnapshot,
} from "./exceptions";

// 093 US1: the reception write path and its preview.
//
// NOTE: the *live* preview the reception form shows while a row is being typed
// is not here. It runs the shared core (`src/lib/production/derive.ts`) in the
// browser, because a server round trip per keystroke made the price arrive
// seconds late. That is a placement, not a second implementation: the form and
// `setProductionSpec` call the same function, and the form sends only inputs.
export {
  getProductionSpec,
  previewProductionSpec,
  productionSpecInputSchema,
  setProductionSpec,
} from "./specification";
export type { ProductionSpecFinishing, ProductionSpecInput, ProductionSpecSnapshot } from "./specification";

export { DomainProductionSpecError } from "./errors";
export type { ProductionSpecErrorCode } from "./errors";
