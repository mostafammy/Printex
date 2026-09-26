// jobCard.ts — getJobCard (US2). contracts/production.md.
//
// Read-only — no `db.$transaction`, no audit event. Offers only the
// Head-Designer-approved DesignVersion pointer, never a draft (FR-004).
// Actual file bytes are served by 050's download route (plan.md "Consumes");
// this module only resolves which version is downloadable and its pointer.

import { db } from "~/server/db";
import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  getProductionHold,
  getProductionStartSpecDiff,
  productTypeNamesForChanges,
  type ProductionHold,
  type SpecFieldChange,
} from "~/server/changes";
import { DomainProductionError } from "./errors";
import { effectiveDepartmentId } from "./department";

export interface JobCardSpec {
  description: string | null;
  quantity: number | null;
  widthValue: string | null;
  heightValue: string | null;
  dimensionUnit: string | null;
  material: string | null;
  finishNotes: string | null;
}

export interface JobCardApprovedFile {
  versionId: string;
  fileName: string;
  /** 050's download route — this module only resolves the pointer, not bytes. */
  downloadUrl: string;
}

export interface VendorRecordSummary {
  recordId: string;
  vendorName: string;
  sentAt: Date;
  receivedAt: Date | null;
}

export interface JobCard {
  workItemId: string;
  state: string;
  order: { id: string; number: number; customerName: string };
  spec: JobCardSpec;
  approvedFile: JobCardApprovedFile | null;
  pendingFileRevisionAt: Date | null;
  vendorRecord: VendorRecordSummary | null;
  /** 016: non-null while a change request or revised instruction freezes the job. */
  changeHold: ProductionHold | null;
  /** 016: the current specification version number (null before the first version). */
  specVersion: number | null;
  /** 016 (FR-020): what changed between the version at production start and the current one. */
  productionStartDiff: SpecFieldChange[];
  /** productTypeId → name for the product types named in `productionStartDiff` (usually empty). */
  productionStartProductTypeNames: Record<string, string>;
}

export async function getJobCard(actor: Actor, workItemId: string): Promise<JobCard> {
  const workItem = await db.workItem.findUnique({
    where: { id: workItemId },
    include: {
      order: { include: { customer: { select: { name: true } } } },
      productType: { select: { defaultDepartmentId: true } },
      department: { select: { isExternalProduction: true } },
      currentSpecVersion: { select: { version: true } },
    },
  });
  if (!workItem) {
    throw new DomainProductionError("WORK_ITEM_NOT_FOUND", "Work Item not found");
  }

  authorize(actor, "production.operate", {
    departmentId: effectiveDepartmentId(workItem) ?? undefined,
  });

  // Independent reads — issued together rather than one after another.
  const [approvedVersion, latestVendorRecord, changeHold, startDiff] = await Promise.all([
    db.designVersion.findFirst({
      where: { workItemId, approvedAt: { not: null } },
      orderBy: { version: "desc" },
    }),
    workItem.department?.isExternalProduction
      ? db.vendorProductionRecord.findFirst({
          where: { workItemId },
          orderBy: { sentAt: "desc" },
        })
      : null,
    getProductionHold(db, workItemId),
    getProductionStartSpecDiff(db, workItemId),
  ]);
  // No query unless the diff touches productTypeId.
  const productionStartProductTypeNames = await productTypeNamesForChanges(db, [
    startDiff.changes,
  ]);

  return {
    workItemId: workItem.id,
    state: workItem.state,
    order: {
      id: workItem.order.id,
      number: workItem.order.number,
      customerName: workItem.order.customer.name,
    },
    spec: {
      description: workItem.description,
      quantity: workItem.quantity,
      widthValue: workItem.widthValue?.toString() ?? null,
      heightValue: workItem.heightValue?.toString() ?? null,
      dimensionUnit: workItem.dimensionUnit,
      material: workItem.material,
      finishNotes: workItem.finishNotes,
    },
    approvedFile: approvedVersion
      ? {
          versionId: approvedVersion.id,
          fileName: approvedVersion.fileName,
          downloadUrl: `/api/design-versions/${approvedVersion.id}/download`,
        }
      : null,
    pendingFileRevisionAt: workItem.pendingFileRevisionAt,
    vendorRecord: latestVendorRecord
      ? {
          recordId: latestVendorRecord.id,
          vendorName: latestVendorRecord.vendorName,
          sentAt: latestVendorRecord.sentAt,
          receivedAt: latestVendorRecord.receivedAt,
        }
      : null,
    changeHold,
    specVersion: workItem.currentSpecVersion?.version ?? null,
    productionStartDiff: startDiff.changes,
    productionStartProductTypeNames,
  };
}
