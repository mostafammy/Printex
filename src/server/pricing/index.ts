import { bindPricingGatePort } from "./ports";
import { pricingGateProvider } from "./delivery-port";

bindPricingGatePort(pricingGateProvider);

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
export { pendingSince, status } from "./status";
export {
  PRICING_RESET_LISTENER_NAME,
  pricingResetListener,
  registerPricingResetListener,
} from "./change-listener";
export type { SpecChangedEvent, SpecChangeListener } from "./change-listener";
export { getCurrentPrice, getPriceHistory } from "./history";
export { pricingGateProvider } from "./delivery-port";
export { formatQueueAge, getPricingQueue } from "./queue";
export type { PricingQueueInput, PricingQueueResult, PricingQueueRow } from "./queue";
export { createPricingReturn } from "./returns";
export type { PricingReturnInput } from "./returns";
export { createCustomerPricingRule, createPriceList, retirePriceList, setPricingPolicy } from "./configuration";
export type { CreateCustomerRuleInput, CreatePriceListInput, PricingMode } from "./configuration";

export { quote } from "./quote";
export type { QuoteBreakdown, QuoteInput, QuoteResult } from "./quote";

export { authorizePricingOperation, pricingPermissionFor } from "./authorization";
export type { PricingOperation } from "./authorization";

export { setPrice } from "./prices";
export type { PriceSnapshot, SetPriceInput } from "./prices";
