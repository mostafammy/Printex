/**
 * Pricing type re-exports matching the Prisma schema enums.
 * Kept as a thin re-export layer so the barrel stays framework-agnostic.
 */

export type PricingUnit = "PIECE" | "SQUARE_METER" | "LINEAR_METER" | "SHEET" | "PACK";
export type PricingMode = "FIXED" | "VARIABLE";
export type PriceSource = "LIST" | "CUSTOMER_RULE" | "MANUAL";
export type PricingStatusValue = "PENDING" | "PRICED" | "DISPUTED";
