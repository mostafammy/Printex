/**
 * Pure mapping functions from database query row to WorkItemFullDetail DTO.
 * (specs/017-press-floor-board)
 */

import type {
  WorkItemFullDetail,
  DetailCustomer,
  DetailReturn,
  DetailDesignVersion,
  DetailFileAsset,
  DetailTransition,
} from "~/lib/board/detailTypes";
import type { WorkItemDetailQueryRow } from "./workItemDetailQueryTypes";

export type { WorkItemDetailQueryRow };

function mapCustomer(c: WorkItemDetailQueryRow["order"]["customer"]): DetailCustomer {
  return {
    id: c.id,
    name: c.name,
    phones: c.phones.map((p) => p.phoneE164),
    notes: c.notes,
    isCashCustomer: c.isCashCustomer,
  };
}

function mapPricing(row: WorkItemDetailQueryRow) {
  const p = row.prices[0];
  const currentPrice = p
    ? {
        amount: p.amount.toString(),
        currency: p.currency,
        source: p.source,
        setAt: p.setAt.toISOString(),
        setByName: p.setBy.name,
      }
    : null;

  const pricingStatus = row.pricingStatus
    ? {
        status: row.pricingStatus.status,
        disputeReason: row.pricingStatus.disputeReason,
        waitingSince: row.pricingStatus.waitingSince?.toISOString() ?? null,
      }
    : null;

  return { currentPrice, pricingStatus };
}

function mapReturns(returns: WorkItemDetailQueryRow["returns"]): readonly DetailReturn[] {
  return returns.map((r) => ({
    id: r.id,
    originDepartmentName: r.originDepartment.name,
    category: r.category,
    explanation: r.explanation,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    raisedByName: r.raisedBy.name,
    assignedToName: r.assignedTo.name,
  }));
}

function mapDesignVersions(versions: WorkItemDetailQueryRow["designVersions"]): readonly DetailDesignVersion[] {
  return versions.map((dv) => ({
    id: dv.id,
    version: dv.version,
    fileName: dv.fileName,
    sizeBytes: dv.sizeBytes,
    mimeType: dv.mimeType,
    note: dv.note,
    createdAt: dv.createdAt.toISOString(),
    approvedAt: dv.approvedAt?.toISOString() ?? null,
    uploadedByName: dv.uploadedBy.name,
  }));
}

function mapFileAssets(assets: WorkItemDetailQueryRow["fileAssets"]): readonly DetailFileAsset[] {
  return assets.map((fa) => ({
    id: fa.id,
    category: fa.category,
    logicalName: fa.logicalName,
    versions: fa.fileVersions.map((fv) => ({
      id: fv.id,
      versionNumber: fv.versionNumber,
      originalName: fv.originalName,
      mimeType: fv.fileObject.mimeType,
      sizeBytes: Number(fv.fileObject.sizeBytes),
      note: fv.note,
      approved: fv.approved,
      createdAt: fv.createdAt.toISOString(),
      uploadedByName: fv.uploadedBy.name,
    })),
  }));
}

function mapTransitions(transitions: WorkItemDetailQueryRow["transitions"]): readonly DetailTransition[] {
  return transitions.map((t) => ({
    id: t.id,
    from: t.from,
    to: t.to,
    at: t.at.toISOString(),
    reason: t.reason,
    rejectionCategory: t.rejectionCategory,
    actorName: t.actor.name,
  }));
}

function mapLateCancel(lc: WorkItemDetailQueryRow["lateCancellation"]) {
  if (!lc) return null;
  return {
    id: lc.id,
    reason: lc.reason,
    costIncurred: lc.costIncurred.toString(),
    costNote: lc.costNote,
    createdAt: lc.createdAt.toISOString(),
  };
}

export function mapWorkItemToDetail(row: WorkItemDetailQueryRow): WorkItemFullDetail {
  const { currentPrice, pricingStatus } = mapPricing(row);
  const due = row.dueDate?.toISOString() ?? row.order.dueDate?.toISOString() ?? null;
  const title = row.description ?? row.productType?.name ?? "أمر عمل";

  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.number,
    orderChannel: row.order.channel,
    orderPriority: row.order.priority,
    orderCreatedAt: row.order.createdAt.toISOString(),
    orderDueDate: row.order.dueDate?.toISOString() ?? null,
    customer: mapCustomer(row.order.customer),
    createdBy: { id: row.order.createdBy.id, name: row.order.createdBy.name },
    title,
    description: row.description,
    productType: row.productType ? { id: row.productType.id, name: row.productType.name } : null,
    department: row.department ? { id: row.department.id, name: row.department.name, isExternalProduction: row.department.isExternalProduction } : null,
    state: row.state,
    quantity: row.quantity,
    producedQuantity: row.producedQuantity,
    widthValue: row.widthValue ? row.widthValue.toString() : null,
    heightValue: row.heightValue ? row.heightValue.toString() : null,
    dimensionUnit: row.dimensionUnit,
    material: row.material,
    finishNotes: row.finishNotes,
    productionNotes: row.productionNotes,
    requiresDesign: row.requiresDesign,
    requiresReview: row.requiresReview,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    dueDate: due,
    assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name, email: row.assignee.email } : null,
    pricingStatus,
    currentPrice,
    reworkCount: row.returns.length,
    returns: mapReturns(row.returns),
    designVersions: mapDesignVersions(row.designVersions),
    fileAssets: mapFileAssets(row.fileAssets),
    transitions: mapTransitions(row.transitions),
    lateCancellation: mapLateCancel(row.lateCancellation),
    vendorRecords: row.vendorProductionRecords.map((vr) => ({
      id: vr.id,
      vendorName: vr.vendorName,
      sentAt: vr.sentAt.toISOString(),
      receivedAt: vr.receivedAt?.toISOString() ?? null,
    })),
  };
}
