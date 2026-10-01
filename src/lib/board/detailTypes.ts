/**
 * DTOs for complete Work Item details on the press floor board.
 * (specs/017-press-floor-board)
 */

import type { WorkItemState } from "~/server/board";

export interface DetailCustomer {
  readonly id: string;
  readonly name: string;
  readonly phones: readonly string[];
  readonly notes: string | null;
  readonly isCashCustomer: boolean;
}

export interface DetailReturn {
  readonly id: string;
  readonly originDepartmentName: string;
  readonly category: string;
  readonly explanation: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly raisedByName: string;
  readonly assignedToName: string;
}

export interface DetailDesignVersion {
  readonly id: string;
  readonly version: number;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly mimeType: string | null;
  readonly note: string | null;
  readonly createdAt: string;
  readonly approvedAt: string | null;
  readonly uploadedByName: string;
}

export interface DetailFileVersion {
  readonly id: string;
  readonly versionNumber: number;
  readonly originalName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly note: string | null;
  readonly approved: boolean;
  /// 050's lifecycle status. Carried so a VOID or ARCHIVED version can be shown
  /// as retired instead of reading as the live file — the popup is where someone
  /// decides which file to send to the printer.
  readonly status: string;
  readonly createdAt: string;
  readonly uploadedByName: string;
}

export interface DetailFileAsset {
  readonly id: string;
  readonly category: string;
  readonly logicalName: string;
  readonly versions: readonly DetailFileVersion[];
}

export interface DetailTransition {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly at: string;
  readonly reason: string | null;
  readonly rejectionCategory: string | null;
  readonly actorName: string;
}

export interface WorkItemFullDetail {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: number;
  readonly orderChannel: string;
  readonly orderPriority: "NORMAL" | "URGENT";
  readonly orderCreatedAt: string;
  readonly orderDueDate: string | null;
  readonly customer: DetailCustomer;
  readonly createdBy: { readonly id: string; readonly name: string };
  readonly title: string;
  readonly description: string | null;
  readonly productType: { readonly id: string; readonly name: string } | null;
  readonly department: {
    readonly id: string;
    readonly name: string;
    readonly isExternalProduction: boolean;
  } | null;
  readonly state: WorkItemState;
  readonly quantity: number | null;
  readonly producedQuantity: number | null;
  readonly widthValue: string | null;
  readonly heightValue: string | null;
  readonly dimensionUnit: string | null;
  readonly material: string | null;
  readonly finishNotes: string | null;
  readonly productionNotes: string | null;
  readonly requiresDesign: boolean;
  readonly requiresReview: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly dueDate: string | null;
  readonly assignee: {
    readonly id: string;
    readonly name: string;
    readonly email?: string | null;
  } | null;
  readonly pricingStatus: {
    readonly status: "PENDING" | "PRICED" | "DISPUTED" | "NOT_REQUIRED";
    readonly disputeReason: string | null;
    readonly waitingSince: string | null;
  } | null;
  readonly currentPrice: {
    readonly amount: string;
    readonly currency: string;
    readonly source: string;
    readonly setAt: string;
    readonly setByName: string;
  } | null;
  readonly reworkCount: number;
  readonly returns: readonly DetailReturn[];
  readonly designVersions: readonly DetailDesignVersion[];
  readonly fileAssets: readonly DetailFileAsset[];
  readonly transitions: readonly DetailTransition[];
  readonly lateCancellation: {
    readonly id: string;
    readonly reason: string;
    readonly costIncurred: string;
    readonly costNote: string | null;
    readonly createdAt: string;
  } | null;
  readonly vendorRecords: readonly {
    readonly id: string;
    readonly vendorName: string;
    readonly sentAt: string;
    readonly receivedAt: string | null;
  }[];
}
