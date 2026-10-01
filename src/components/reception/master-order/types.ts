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

export interface BannerJobSpec {
  readonly id: string;
  readonly pricingMode: "CALCULATOR" | "DIRECT";
  readonly jobName: string;
  readonly quantity: number;
  readonly unit: "PIECES" | "SQM";
  readonly notes: string;
  readonly printType: string;
  readonly materialWeight: string;
  readonly materialsDispensed: readonly string[];
  readonly placement: string;
  readonly width: number;
  readonly height: number;
  readonly measurementUnit: "M" | "CM";
  readonly singlePieceArea: number;
  readonly totalArea: number;
  readonly finishingOptions: readonly string[];
  readonly fieldInstallation: boolean;
  readonly attachedFiles: readonly string[];
  readonly artworkStatus: "RECEIVED" | "READY_TO_PRINT";
  readonly pricingMethod: "PER_SQM" | "PER_PIECE";
  readonly ratePerUnit: number;
  readonly discount: number;
  readonly taxRate: number;
  readonly totalCost: number;
  readonly departmentId?: string;
  readonly productTypeId?: string;
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
  readonly width?: number;
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
