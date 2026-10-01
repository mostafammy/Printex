/**
 * Pure mapping functions from database query row to WorkItemFullDetail DTO.
 * (specs/017-press-floor-board)
 */

import type {
  WorkItemFullDetail,
  DetailCustomer,
} from "~/lib/board/detailTypes";
import type { WorkItemDetailQueryRow } from "./workItemDetailQueryTypes";
import { mapPriceBreakdown } from "./workItemDetailPricing";
import {
  mapReturns,
  mapDesignVersions,
  mapFileAssets,
  mapTransitions,
  mapLateCancel,
} from "./workItemDetailHistoryMapper";

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
  const currentPrice = p ? {
    amount: p.amount.toString(),
    currency: p.currency,
    source: p.source,
    setAt: p.setAt.toISOString(),
    setByName: p.setBy.name,
  } : null;

  const ps = row.pricingStatus;
  const pricingStatus = ps ? {
    status: ps.status,
    disputeReason: ps.disputeReason,
    waitingSince: ps.waitingSince?.toISOString() ?? null,
  } : null;

  return { currentPrice, pricingStatus };
}

function mapSpecs(row: WorkItemDetailQueryRow) {
  return {
    widthValue: row.widthValue ? row.widthValue.toString() : null,
    heightValue: row.heightValue ? row.heightValue.toString() : null,
    dimensionUnit: row.dimensionUnit,
    material: row.material,
    finishNotes: row.finishNotes,
    productionNotes: row.productionNotes,
    requiresDesign: row.requiresDesign,
    requiresReview: row.requiresReview,
  };
}

function mapProductAndDept(row: WorkItemDetailQueryRow) {
  const productType = row.productType ? { id: row.productType.id, name: row.productType.name } : null;
  const department = row.department ? { id: row.department.id, name: row.department.name, isExternalProduction: row.department.isExternalProduction } : null;
  return { productType, department };
}

function getDueDate(row: WorkItemDetailQueryRow): string | null {
  if (row.dueDate) return row.dueDate.toISOString();
  if (row.order.dueDate) return row.order.dueDate.toISOString();
  return null;
}

function getTitle(row: WorkItemDetailQueryRow): string {
  if (row.description) return row.description;
  if (row.productType?.name) return row.productType.name;
  return "أمر عمل";
}

function mapOrderInfo(row: WorkItemDetailQueryRow) {
  const o = row.order;
  return {
    orderId: row.orderId,
    orderNumber: o.number,
    orderChannel: o.channel,
    orderPriority: o.priority,
    orderCreatedAt: o.createdAt.toISOString(),
    orderDueDate: o.dueDate ? o.dueDate.toISOString() : null,
    customer: mapCustomer(o.customer),
    createdBy: { id: o.createdBy.id, name: o.createdBy.name },
    title: getTitle(row),
    description: row.description,
    dueDate: getDueDate(row),
    ...mapProductAndDept(row),
  };
}

function mapHistoryInfo(row: WorkItemDetailQueryRow) {
  return {
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

export function mapWorkItemToDetail(row: WorkItemDetailQueryRow): WorkItemFullDetail {
  const { currentPrice, pricingStatus } = mapPricing(row);
  return {
    id: row.id,
    state: row.state,
    quantity: row.quantity,
    producedQuantity: row.producedQuantity,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name, email: row.assignee.email } : null,
    pricingStatus,
    currentPrice,
    priceBreakdown: mapPriceBreakdown(row),
    ...mapOrderInfo(row),
    ...mapSpecs(row),
    ...mapHistoryInfo(row),
  };
}
