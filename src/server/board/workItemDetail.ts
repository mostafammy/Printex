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
  // 093's frozen spec + the add-on lines behind `productionTotal`, so the
  // popup can show the accountant how the price was derived rather than only its
  // sum. Newest generation first; the mapper keeps only that generation.
  // `productionSpecAt` is not exposed: it is a "was this ever frozen" marker,
  // and the mapper infers that from the values themselves.
  finishings: {
    select: {
      generation: true,
      labelSnapshot: true,
      rateSnapshot: true,
      totalAmount: true,
    },
    orderBy: [{ generation: "desc" as const }, { quotedAt: "desc" as const }],
  },
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
