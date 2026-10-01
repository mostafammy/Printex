/**
 * Database query row types for work item detail fetching.
 * (specs/017-press-floor-board)
 */

import type { WorkItemState } from "~/server/core";

export interface WorkItemDetailQueryRow {
  readonly id: string;
  readonly orderId: string;
  readonly order: {
    readonly number: number;
    readonly channel: string;
    readonly priority: "NORMAL" | "URGENT";
    readonly createdAt: Date;
    readonly dueDate: Date | null;
    readonly customer: {
      readonly id: string;
      readonly name: string;
      readonly phones: readonly { readonly phoneE164: string }[];
      readonly notes: string | null;
      readonly isCashCustomer: boolean;
    };
    readonly createdBy: { readonly id: string; readonly name: string };
  };
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
  readonly widthValue: { toString(): string } | null;
  readonly heightValue: { toString(): string } | null;
  readonly dimensionUnit: string | null;
  readonly material: string | null;
  readonly finishNotes: string | null;
  readonly productionNotes: string | null;
  readonly requiresDesign: boolean;
  readonly requiresReview: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly dueDate: Date | null;
  readonly assignee: {
    readonly id: string;
    readonly name: string;
    readonly email?: string | null;
  } | null;
  readonly pricingStatus: {
    readonly status: "PENDING" | "PRICED" | "DISPUTED";
    readonly disputeReason: string | null;
    readonly waitingSince: Date | null;
  } | null;
  readonly prices: readonly {
    readonly amount: { toString(): string };
    readonly currency: string;
    readonly source: string;
    readonly setAt: Date;
    readonly setBy: { readonly name: string };
  }[];
  readonly returns: readonly {
    readonly id: string;
    readonly originDepartment: { readonly name: string };
    readonly category: string;
    readonly explanation: string;
    readonly note: string | null;
    readonly createdAt: Date;
    readonly raisedBy: { readonly name: string };
    readonly assignedTo: { readonly name: string };
  }[];
  readonly designVersions: readonly {
    readonly id: string;
    readonly version: number;
    readonly fileName: string;
    readonly sizeBytes: number;
    readonly mimeType: string | null;
    readonly note: string | null;
    readonly createdAt: Date;
    readonly approvedAt: Date | null;
    readonly uploadedBy: { readonly name: string };
  }[];
  readonly fileAssets: readonly {
    readonly id: string;
    readonly category: string;
    readonly logicalName: string;
    readonly fileVersions: readonly {
      readonly id: string;
      readonly versionNumber: number;
      readonly originalName: string;
      readonly fileObject: {
        readonly mimeType: string;
        readonly sizeBytes: bigint | number;
      };
      readonly note: string | null;
      readonly approved: boolean;
      /// 050's lifecycle status, so the popup can mark retired versions.
      readonly status: string;
      readonly createdAt: Date;
      readonly uploadedBy: { readonly name: string };
    }[];
  }[];
  readonly transitions: readonly {
    readonly id: string;
    readonly from: string;
    readonly to: string;
    readonly at: Date;
    readonly reason: string | null;
    readonly rejectionCategory: string | null;
    readonly actor: { readonly name: string };
  }[];
  readonly lateCancellation: {
    readonly id: string;
    readonly reason: string;
    readonly costIncurred: { toString(): string };
    readonly costNote: string | null;
    readonly createdAt: Date;
  } | null;
  readonly vendorProductionRecords: readonly {
    readonly id: string;
    readonly vendorName: string;
    readonly sentAt: Date;
    readonly receivedAt: Date | null;
  }[];
}
