/**
 * Server query for rich Work Item details used in the Board details view.
 * (specs/017-press-floor-board)
 */

import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import type { WorkItemFullDetail } from "~/lib/board/types";
import { mapWorkItemToDetail, type WorkItemDetailQueryRow } from "./workItemDetailMapper";

export type { WorkItemFullDetail };

const WORK_ITEM_DETAIL_INCLUDE = {
  order: {
    include: {
      customer: { include: { phones: true } },
      createdBy: { select: { id: true, name: true } },
    },
  },
  productType: { select: { id: true, name: true } },
  department: { select: { id: true, name: true, isExternalProduction: true } },
  assignee: { select: { id: true, name: true, email: true } },
  pricingStatus: true,
  prices: {
    include: { setBy: { select: { name: true } } },
    orderBy: { setAt: "desc" as const },
    take: 1,
  },
  returns: {
    include: {
      originDepartment: { select: { name: true } },
      raisedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  designVersions: {
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { version: "desc" as const },
  },
  fileAssets: {
    include: {
      fileVersions: {
        include: { fileObject: true, uploadedBy: { select: { name: true } } },
        orderBy: { versionNumber: "desc" as const },
      },
    },
  },
  transitions: {
    include: { actor: { select: { name: true } } },
    orderBy: { at: "desc" as const },
  },
  lateCancellation: true,
  vendorProductionRecords: { orderBy: { sentAt: "desc" as const } },
};

export async function getWorkItemDetail(
  actor: Actor,
  workItemId: string,
): Promise<WorkItemFullDetail | null> {
  const row = (await db.workItem.findUnique({
    where: { id: workItemId },
    include: WORK_ITEM_DETAIL_INCLUDE,
  })) as WorkItemDetailQueryRow | null;

  if (!row) return null;
  return mapWorkItemToDetail(row);
}
