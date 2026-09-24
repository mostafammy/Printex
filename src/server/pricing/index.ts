export { DomainPricingError } from "./errors";
export type { PricingErrorCode } from "./errors";

export {
  calculateQuote,
  selectQuantityTier,
  toMeters,
  validateQuantityTiers,
} from "./calculation";
export type {
  CustomerAdjustment,
  DimensionUnit,
  PricingUnit,
  QuantityTier,
  QuoteCalculation,
  QuoteCalculationInput,
} from "./calculation";

export {
  bindPricingGatePort,
  getFailClosedPricingGatePort,
  getPricingGatePort,
} from "./ports";
export type { PricingGatePort, PricingGateStatus, PricingResponsible } from "./ports";

export type { PricingStatusSnapshot, PricingStatusValue } from "./status";

export { quote } from "./quote";
export type { QuoteBreakdown, QuoteInput, QuoteResult } from "./quote";

export { authorizePricingOperation, pricingPermissionFor } from "./authorization";
export type { PricingOperation } from "./authorization";
