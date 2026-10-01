export interface CustomerSummary {
  readonly id: string;
  readonly name: string;
  readonly phone?: string | null;
  readonly isCashCustomer?: boolean;
  readonly classification?: string | null;
}

export interface ClientDepartment {
  readonly id: string;
  readonly name: string;
}

export interface ClientProductType {
  readonly id: string;
  readonly name: string;
  readonly defaultDepartmentId: string | null;
  readonly defaultRequiresDesign: boolean;
  readonly defaultRequiresReview: boolean;
}

/**
 * 093 configuration for one product type, flattened for the client.
 *
 * Reception NEVER hard-codes the ladder, the height ceiling or the rate band:
 * it receives them from the server, which read them out of
 * `ProductionWidthRule` through `loadProductionConstraints` — the single
 * configuration boundary (constitution VI). A shop that adds a 340 cm roll
 * edits a row; it does not edit this file.
 */
export interface ProductionGovernance {
  readonly productTypeId: string;
  readonly productTypeName: string;
  /** Ascending whole centimetres; the last entry is the ceiling (FR-002/FR-003). */
  readonly ladderCm: readonly number[];
  /** Height ceiling in METRES — height is never a ladder value (FR-004/FR-005). */
  readonly maxHeightM: string;
  /** Inclusive EGP/m² band the base rate must sit inside (FR-007). */
  readonly minRatePerSqm: string;
  readonly maxRatePerSqm: string;
  /** Midpoint of the band — what the rate field opens at. */
  readonly suggestedRatePerSqm: string;
}

/** One row of the extensible finishing catalogue (FR-009/FR-010). */
export interface FinishingServiceOption {
  readonly id: string;
  readonly code: string;
  readonly labelAr: string;
  readonly ratePerSqm: string;
}

/**
 * The reception-entered production specification for a roll job.
 *
 * Canonical units (FR-005) and NO ambiguous `width`/`height` pair: BOTH
 * dimensions are CENTIMETRES, because a width in centimetres beside a height in
 * metres is a form where somebody eventually transposes the two. The ladder is
 * defined in centimetres, so centimetres is the unit everything follows.
 *
 * The distinction between what the customer asked for and what they are BILLED
 * for has to survive into the stored order (FR-001/FR-002): `customerWidthCm` is
 * the width the designer lays out and the printer cuts, `productionWidthCm` is
 * the billing width and nothing else.
 */
export interface BannerJobSpec {
  readonly id: string;
  readonly jobName: string;
  readonly quantity: number;
  readonly unit: "PIECES" | "SQM";
  readonly notes: string;
  readonly printType: string;
  readonly materialWeight: string;
  readonly materialsDispensed: readonly string[];
  readonly placement: string;

  // ── Dimensions: customer request vs. what production consumes ──────────────
  /** Exactly what the customer asked for, in CENTIMETRES. Never overwritten. */
  readonly customerWidthCm: number;
  /** The first ladder step ≥ `customerWidthCm`, in CENTIMETRES (FR-002). */
  readonly productionWidthCm: number;
  /** True when rounding actually moved the width up. */
  readonly roundedUp: boolean;
  /** Height in CENTIMETRES — the same unit as the width (FR-005). */
  readonly heightCm: number;

  // ── Derived billable figures (FR-006/FR-008) ──────────────────────────────
  /** Billable area of ONE piece, in m², from the PRODUCTION width. */
  readonly areaPerPieceSqm: number;
  /** Billable area of ALL pieces, in m². */
  readonly totalAreaSqm: number;

  // ── Pricing (FR-007/FR-008/FR-010) ────────────────────────────────────────
  /** EGP per m² the receptionist selected — frozen on the order item. */
  readonly baseRatePerSqm: number;
  /** `totalAreaSqm × baseRatePerSqm`. */
  readonly baseTotal: number;
  /** Selected finishing codes, priced per m² off the same area. */
  readonly finishingCodes: readonly string[];
  readonly finishingLines: readonly BannerFinishingLine[];
  /** Sum of the finishing lines. */
  readonly finishingTotal: number;
  /** `baseTotal + finishingTotal`, rounded once to whole EGP. */
  readonly total: number;

  readonly fieldInstallation: boolean;
  readonly attachedFiles: readonly string[];
  readonly artworkStatus: "RECEIVED" | "READY_TO_PRINT";

  readonly departmentId?: string;
  readonly productTypeId?: string;
}

export interface BannerFinishingLine {
  readonly code: string;
  readonly labelAr: string;
  readonly ratePerSqm: number;
  readonly amount: number;
}

export interface DesignerSummary {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
}

export type JobCategory =
  | "OFFSET"
  | "DIGITAL"
  | "SILK_SCREEN"
  | "BANNER_FLEX"
  | "LASER"
  | "OTHER";

export interface MasterOrderItem {
  readonly id: string;
  readonly category: JobCategory;
  readonly categoryLabelAr: string;
  readonly jobName: string;
  readonly quantity: number;
  /** Legacy `WorkItem.widthValue`. For governed jobs this is the PRODUCTION width, in CM. */
  readonly width?: number;
  /** Legacy `WorkItem.heightValue`. For governed jobs this is the height in CM. */
  readonly height?: number;
  readonly measurementUnit?: "M" | "CM";
  readonly unit?: string;
  readonly material?: string;
  readonly finishing?: string;
  readonly notes?: string;
  readonly totalCost: number;
  readonly departmentId?: string;
  readonly productTypeId?: string;
  readonly bannerSpec?: BannerJobSpec;
}

export interface MasterOrderSummaryFinancials {
  readonly subtotal: number;
  readonly discountType: "FIXED" | "PERCENT";
  readonly discountValue: number;
  readonly discountAmount: number;
  readonly taxType: "FIXED" | "PERCENT";
  readonly taxValue: number;
  readonly taxAmount: number;
  readonly grandTotal: number;
  readonly paidAmount: number;
  readonly remainingBalance: number;
  readonly paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
}
