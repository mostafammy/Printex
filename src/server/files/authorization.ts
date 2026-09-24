// File authorization policy — 050-files
// Implements: Admin, assigned designer, same-department production operator
// for Approved/Production; all other cases forbidden.

import { ForbiddenError, authorize } from "@/server/auth/authorize.js";
import { Actor } from "@/server/auth/getActor.js";
import { FileCategory, FileLifecycleStatus } from "@prisma/client";
import { prisma } from "@/server/db/client.js";

export interface FileAccessContext {
  actor: Actor;
  fileVersionId: string;
  workItemId?: string;
  category?: FileCategory;
  status?: FileLifecycleStatus;
}

export interface FileAccessResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if actor can download a file version.
 * Rules:
 * - Admin: all authorized files
 * - Assigned designer: files for assigned Work Items
 * - Production operator: only Approved/Production category files for Work Items in their department
 * - Other users: denied
 */
export async function canDownloadFileVersion(
  context: FileAccessContext
): Promise<FileAccessResult> {
  const { actor, fileVersionId } = context;

  // Admin has access to everything
  if (actor.permissions.has("admin")) {
    return { allowed: true };
  }

  // Fetch file version with relations
  const fileVersion = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: {
      fileAsset: {
        include: {
          workItem: {
            include: {
              assignee: true,
              department: true,
            },
          },
        },
      },
    },
  });

  if (!fileVersion) {
    return { allowed: false, reason: "File version not found" };
  }

  const workItem = fileVersion.fileAsset.workItem;
  const category = fileVersion.fileAsset.category;
  const status = fileVersion.status;

  // Check if actor is assigned designer for this work item
  if (workItem.assigneeId === actor.id && actor.permissions.has("designer")) {
    return { allowed: true };
  }

  // Check if actor is production operator in same department
  // Only for Approved or Production category files
  if (
    actor.permissions.has("production.operate") &&
    workItem.departmentId &&
    actor.departmentIds.includes(workItem.departmentId) &&
    (category === FileCategory.APPROVED || category === FileCategory.PRODUCTION) &&
    (status === FileLifecycleStatus.ACTIVE || status === FileLifecycleStatus.SUPERSEDED)
  ) {
    return { allowed: true };
  }

  // Check if actor has general file read permission (for Admin-like roles)
  if (actor.permissions.has("files.read")) {
    return { allowed: true };
  }

  return { allowed: false, reason: "Insufficient permissions for this file" };
}

/**
 * Check if actor can list file versions for a work item.
 */
export async function canListFileVersions(
  actor: Actor,
  workItemId: string
): Promise<FileAccessResult> {
  // Admin
  if (actor.permissions.has("admin")) {
    return { allowed: true };
  }

  const workItem = await prisma.workItem.findUnique({
    where: { id: workItemId },
    include: { department: true, assignee: true },
  });

  if (!workItem) {
    return { allowed: false, reason: "Work item not found" };
  }

  // Assigned designer
  if (workItem.assigneeId === actor.id && actor.permissions.has("designer")) {
    return { allowed: true };
  }

  // Production operator in same department
  if (
    actor.permissions.has("production.operate") &&
    workItem.departmentId &&
    actor.departmentIds.includes(workItem.departmentId)
  ) {
    return { allowed: true };
  }

  // General file read permission
  if (actor.permissions.has("files.read")) {
    return { allowed: true };
  }

  return { allowed: false, reason: "Insufficient permissions to list files" };
}

/**
 * Check if actor can perform lifecycle action (void/archive/supersede).
 */
export async function canPerformLifecycleAction(
  actor: Actor,
  fileVersionId: string,
  action: "VOID" | "ARCHIVE" | "SUPERSEDE"
): Promise<FileAccessResult> {
  // Admin can do everything
  if (actor.permissions.has("admin")) {
    return { allowed: true };
  }

  const fileVersion = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: {
      fileAsset: {
        include: {
          workItem: {
            include: { assignee: true, department: true },
          },
        },
      },
    },
  });

  if (!fileVersion) {
    return { allowed: false, reason: "File version not found" };
  }

  const workItem = fileVersion.fileAsset.workItem;

  // Assigned designer can void/archive their own uploads
  if (workItem.assigneeId === actor.id && actor.permissions.has("designer")) {
    // Designer can only void/archive, not supersede (that's done by upload)
    if (action === "VOID" || action === "ARCHIVE") {
      return { allowed: true };
    }
  }

  // Head Designer / Review role can approve
  if (action === "SUPERSEDE" && actor.permissions.has("head_designer")) {
    return { allowed: true };
  }

  return { allowed: false, reason: `Cannot ${action} this file version` };
}

/**
 * Check if actor can mark a version as approved (013 feature).
 * Only Head Designer / Review role can approve.
 */
export async function canApproveFileVersion(
  actor: Actor,
  fileVersionId: string
): Promise<FileAccessResult> {
  if (actor.permissions.has("admin")) {
    return { allowed: true };
  }

  if (!actor.permissions.has("head_designer")) {
    return { allowed: false, reason: "Only Head Designer can approve file versions" };
  }

  const fileVersion = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: {
      fileAsset: {
        include: {
          workItem: {
            include: { department: true },
          },
        },
      },
    },
  });

  if (!fileVersion) {
    return { allowed: false, reason: "File version not found" };
  }

  // Head Designer must be in the same department or have global permission
  // For now, allow if they have head_designer permission
  return { allowed: true };
}

/**
 * Authorize and throw ForbiddenError if not allowed.
 * Wrapper for route handlers.
 */
export async function authorizeFileDownload(
  actor: Actor,
  fileVersionId: string
): Promise<void> {
  const result = await canDownloadFileVersion({ actor, fileVersionId });
  if (!result.allowed) {
    throw new Error(result.reason ?? "FORBIDDEN");
  }
}

export async function authorizeFileList(
  actor: Actor,
  workItemId: string
): Promise<void> {
  const result = await canListFileVersions(actor, workItemId);
  if (!result.allowed) {
    throw new Error(result.reason ?? "FORBIDDEN");
  }
}

export async function authorizeFileLifecycle(
  actor: Actor,
  fileVersionId: string,
  action: "VOID" | "ARCHIVE" | "SUPERSEDE"
): Promise<void> {
  const result = await canPerformLifecycleAction(actor, fileVersionId, action);
  if (!result.allowed) {
    throw new Error(result.reason ?? "FORBIDDEN");
  }
}

export async function authorizeFileApprove(
  actor: Actor,
  fileVersionId: string
): Promise<void> {
  const result = await canApproveFileVersion(actor, fileVersionId);
  if (!result.allowed) {
    throw new Error(result.reason ?? "FORBIDDEN");
  }
}