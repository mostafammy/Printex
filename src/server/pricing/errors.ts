export type PricingErrorCode =
  | "PRICE_NOT_FOUND"
  | "PRICING_DISPUTED"
  | "STALE_SPEC_VERSION"
  | "PRICING_UNRESOLVED"
  | "VALIDATION"
  | "INVALID_DIMENSIONS"
  | "INVALID_AMOUNT"
  | "INVALID_QUANTITY"
  | "TIER_NOT_FOUND"
  | "TIER_OVERLAP"
  | "EFFECTIVE_DATE_CONFLICT";

export class DomainPricingError extends Error {
  readonly code: PricingErrorCode;

  constructor(code: PricingErrorCode, message: string) {
    super(message);
    this.name = "DomainPricingError";
    this.code = code;
  }
}
