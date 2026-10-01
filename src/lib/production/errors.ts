// errors.ts — 093's own error vocabulary.
//
// Why a new class instead of reusing 051's `DomainPricingError` or 011's
// `DomainOrderError`: this bounded context refuses things none of them own —
// an over-maximum width, a missing frozen specification, a finishing that was
// not active on the day of the job. Overloading a neighbouring module's code
// union would force every existing `switch` on that union to learn about
// codes that can never originate there.
//
// The shape deliberately matches 051's (`class … extends Error` with a
// `readonly code`), because that is the established convention in this
// codebase for domain errors surfaced through server actions.
//
// Client-safe: no imports. The reception row raises and reads these codes
// while the receptionist types, so they must be shareable with the browser.

export type ProductionSpecErrorCode =
  /** Non-positive, non-finite, or missing dimension. */
  | "INVALID_DIMENSIONS"
  /** Height above the configured ceiling (FR-004). */
  | "HEIGHT_ABOVE_MAXIMUM"
  /** Width above the configured ceiling (FR-003). */
  | "WIDTH_ABOVE_MAXIMUM"
  /** Base rate outside the configured EGP/m² band (FR-007). */
  | "RATE_OUT_OF_BAND"
  /** The ProductType has no ProductionWidthRule, so it is not roll-governed. */
  | "NOT_PRODUCTION_SPEC_GOVERNED"
  /** The Work Item has no frozen production specification yet. */
  | "SPEC_NOT_SET"
  /** The Work Item has a specification but it is incomplete (missing dims or money). */
  | "PRODUCTION_SPEC_MISSING"
  /** A finishing service code does not exist or was not active when priced. */
  | "FINISHING_UNAVAILABLE"
  /** Corrupt or unusable configuration (empty ladder, bad band, …). */
  | "INVALID_WIDTH_LADDER"
  /** Work Item not found, or not in a state that permits the operation. */
  | "WORK_ITEM_NOT_APPLICABLE"
  /** An audited width-exception ticket is required and absent/unresolved. */
  | "WIDTH_EXCEPTION_REQUIRED";

export class DomainProductionSpecError extends Error {
  readonly code: ProductionSpecErrorCode;

  constructor(code: ProductionSpecErrorCode, message: string) {
    super(message);
    this.name = "DomainProductionSpecError";
    this.code = code;
  }
}
