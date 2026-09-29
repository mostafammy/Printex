/**
 * History, file asset, and transition mappers for WorkItemFullDetail.
 * (specs/017-press-floor-board)
 */

import type {
  DetailReturn,
  DetailDesignVersion,
  DetailFileAsset,
  DetailTransition,
} from "~/lib/board/detailTypes";
import type { WorkItemDetailQueryRow } from "./workItemDetailQueryTypes";

export function mapReturns(returns: WorkItemDetailQueryRow["returns"]): readonly DetailReturn[] {
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

export function mapDesignVersions(versions: WorkItemDetailQueryRow["designVersions"]): readonly DetailDesignVersion[] {
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

export function mapFileAssets(assets: WorkItemDetailQueryRow["fileAssets"]): readonly DetailFileAsset[] {
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

export function mapTransitions(transitions: WorkItemDetailQueryRow["transitions"]): readonly DetailTransition[] {
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

export function mapLateCancel(lc: WorkItemDetailQueryRow["lateCancellation"]) {
  if (!lc) return null;
  return {
    id: lc.id,
    reason: lc.reason,
    costIncurred: lc.costIncurred.toString(),
    costNote: lc.costNote,
    createdAt: lc.createdAt.toISOString(),
  };
}
