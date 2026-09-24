// File service — 050-files
// Core business logic: upload, list, approve, lifecycle, attachments
// Consumes 001 audit.record and 002 StorageAdapter

import { type Prisma } from "../../../generated/prisma/index.js";
import type { Actor } from "@/server/auth/getActor.js";
import { LocalDiskStorageAdapter, createLocalDiskAdapter } from "@/server/core/storage/local-disk.js";
import { streamToTempFile, withRetry, verifyStreamIntegrity } from "./integrity.js";
import { validateUploadInput, validateAttachmentInput, FileError, FileErrorCode } from "./schemas.js";
import { canDownloadFileVersion, canListFileVersions, canPerformLifecycleAction, canApproveFileVersion } from "./authorization.js";
import { createPreviewGrant, verifyPreviewGrant, encodeGrant, type SignedPreviewGrant } from "./signed-preview.js";
import { audit } from "@/server/auth/audit.js";
import { db as prisma } from "@/server/db.js";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface UploadInput {
  workItemId: string;
  category: "ORIGINAL" | "DESIGN_VERSIONS" | "REVIEW_PROOF" | "APPROVED" | "PRODUCTION" | "SUPPORTING";
  stream: ReadableStream<Uint8Array>;
  fileName: string;
  note?: string;
  actor: Actor;
}

export interface FileVersionOutput {
  id: string;
  fileAssetId: string;
  fileObjectId: string;
  versionNumber: number;
  originalName: string;
  uploadedById: string;
  note: string | null;
  status: string;
  approved: boolean;
  createdAt: Date;
  fileObject: {
    id: string;
    storageKey: string;
    sizeBytes: number;
    sha256: string;
    mimeType: string;
  };
}

export interface ListVersionsOptions {
  workItemId: string;
  category?: string;
  status?: string;
  includeArchived?: boolean;
}

export class FileService {
  private storage: LocalDiskStorageAdapter;

  constructor(storage?: LocalDiskStorageAdapter) {
    this.storage = storage ?? createLocalDiskAdapter();
  }

  /**
   * Upload a new file version.
   * - Streams to temp file, computes SHA-256/size
   * - Deduplicates FileObject by SHA-256
   * - Creates FileAsset if needed
   * - Creates FileVersion (next version number)
   * - Marks prior ACTIVE as SUPERSEDED
   * - Audits the operation
   */
  async upload(input: UploadInput): Promise<FileVersionOutput> {
    const { workItemId, category, stream, fileName, note, actor } = input;

    // Validate input
    // Note: fileSize and mimeType would come from the upload route after reading the stream
    // For now, we'll accept them as part of the stream metadata

    // Find or create FileAsset
    let fileAsset = await prisma.fileAsset.findFirst({
      where: { workItemId, category },
    });

    if (!fileAsset) {
      fileAsset = await prisma.fileAsset.create({
        data: {
          workItemId,
          category,
          logicalName: fileName,
        },
      });
    }

    // Determine next version number
    const maxVersion = await prisma.fileVersion.findFirst({
      where: { fileAssetId: fileAsset.id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const nextVersion = (maxVersion?.versionNumber ?? 0) + 1;

    // Create temp file path
    const tempPath = join(tmpdir(), `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    try {
      // Stream to temp file with SHA-256 and size
      const { size, sha256 } = await streamToTempFile(stream, tempPath);

      // Get MIME type from file name or stream metadata
      const mimeType = this.getMimeType(input.fileName);

      // Validate upload
      const validated = validateUploadInput({
        workItemId,
        category,
        fileName: input.fileName,
        note: input.note,
        actorId: actor.id,
      }, size, mimeType);

      // Deduplicate FileObject by SHA-256 — upsert to handle concurrent uploads
      const storageKey = `${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}`;
      let fileObject;
      let isNewObject = false;

      try {
        fileObject = await prisma.fileObject.create({
          data: {
            storageKey,
            sizeBytes: size,
            sha256,
            mimeType,
          },
        });
        isNewObject = true;
      } catch (e: any) {
        if (e?.code === "P2002") {
          // Concurrent upload already created this FileObject
          fileObject = await prisma.fileObject.findUnique({ where: { sha256 } });
          if (!fileObject) throw e;
        } else {
          throw e;
        }
      }

      // Move temp file to permanent storage only if we created a new object
      if (isNewObject) {
        const { createReadStream } = await import("fs");
        const fileStream = createReadStream(tempPath);
        await this.storage.put(storageKey, fileStream as any);
      }

      // Atomic: supersede prior ACTIVE versions + create new version in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Select ACTIVE version IDs for audit
        const priorActive = await tx.fileVersion.findMany({
          where: { fileAssetId: fileAsset!.id, status: "ACTIVE" },
          select: { id: true, status: true },
        });

        // Supersede prior versions
        if (priorActive.length > 0) {
          await tx.fileVersion.updateMany({
            where: { fileAssetId: fileAsset!.id, status: "ACTIVE" },
            data: { status: "SUPERSEDED" },
          });
        }

        // Create new FileVersion
        const fileVersion = await tx.fileVersion.create({
          data: {
            fileAssetId: fileAsset!.id,
            fileObjectId: fileObject!.id,
            versionNumber: nextVersion,
            originalName: input.fileName,
            uploadedById: actor.id,
            note: input.note ?? null,
            status: "ACTIVE",
            approved: false,
          },
          include: { fileObject: true },
        });

        return { fileVersion, priorActive };
      });

      // Audit the upload
      await audit.record({
        actorId: actor.id,
        action: "CREATE",
        entity: "FILE_VERSION",
        entityId: result.fileVersion.id,
        afterValues: {
          versionNumber: result.fileVersion.versionNumber,
          fileName: result.fileVersion.originalName,
          status: result.fileVersion.status,
          fileAssetId: fileAsset.id,
          fileObjectId: fileObject.id,
          sizeBytes: fileObject.sizeBytes,
          sha256: fileObject.sha256,
        },
      });

      // Audit each superseded version
      for (const prior of result.priorActive) {
        await audit.record({
          actorId: actor.id,
          action: "SUPERSEDE",
          entity: "FILE_VERSION",
          entityId: prior.id,
          beforeValues: { status: prior.status },
          afterValues: { status: "SUPERSEDED" },
        });
      }

      return this.toOutput(result.fileVersion);
    } finally {
      // Always clean up temp file
      try {
        const { unlinkSync } = await import("fs");
        unlinkSync(tempPath);
      } catch {}
    }
  }

  /**
   * List file versions for a work item, optionally filtered by category.
   */
  async listVersions(options: ListVersionsOptions): Promise<FileVersionOutput[]> {
    const { workItemId, category, status, includeArchived } = options;

    const where: Prisma.FileVersionWhereInput = {
      fileAsset: { workItemId },
    };

    if (category) {
      where.fileAsset = { ...where.fileAsset, category };
    }
    if (status) {
      where.status = status;
    } else if (!includeArchived) {
      where.status = { not: "ARCHIVED" };
    }

    const versions = await prisma.fileVersion.findMany({
      where,
      include: { fileObject: true },
      orderBy: [{ fileAsset: { category: "asc" } }, { versionNumber: "desc" }],
    });

    return versions.map(v => this.toOutput(v));
  }

  /**
   * Mark a version as approved (called by 013).
   */
  async markApproved(versionId: string, actor: Actor): Promise<void> {
    // Authorize
    await this.authorizeApprove(actor, versionId);

    const fileVersion = await prisma.fileVersion.findUnique({
      where: { id: versionId },
      include: { fileAsset: { include: { workItem: true } } },
    });

    if (!fileVersion) {
      throw new Error("File version not found");
    }

    if (fileVersion.approved) {
      return; // Already approved
    }

    const beforeValues = { approved: false };

    await prisma.fileVersion.update({
      where: { id: versionId },
      data: { approved: true },
    });

    await audit.record({
      actorId: actor.id,
      action: "APPROVE",
      entity: "FILE_VERSION",
      entityId: versionId,
      beforeValues,
      afterValues: { approved: true },
      reason: "Approved by Head Designer",
    });
  }

  /**
   * Get download URL (signed preview grant).
   */
  async getDownloadUrl(versionId: string, actor: Actor): Promise<string> {
    const allowed = await canDownloadFileVersion({ actor, fileVersionId: versionId });
    if (!allowed.allowed) {
      throw new Error("FORBIDDEN");
    }

    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const grant = createPreviewGrant(versionId, actor.id, "download");
    return `${baseUrl}/api/files/${versionId}/download?grant=${encodeGrant(grant)}`;
  }

  /**
   * Void a file version.
   */
  async voidVersion(versionId: string, actor: Actor, reason: string): Promise<void> {
    if (!reason || !reason.trim()) {
      throw new FileError(FileErrorCode.VALIDATION_ERROR, "Reason is required to void a file version");
    }

    const allowed = await canPerformLifecycleAction(actor, versionId, "VOID");
    if (!allowed.allowed) {
      throw new Error("FORBIDDEN");
    }

    const fileVersion = await prisma.fileVersion.findUnique({ where: { id: versionId } });
    if (!fileVersion) throw new Error("File version not found");

    await prisma.fileVersion.update({
      where: { id: versionId },
      data: { status: "VOID" },
    });

    await audit.record({
      actorId: actor.id,
      action: "VOID",
      entity: "FILE_VERSION",
      entityId: versionId,
      beforeValues: { status: fileVersion.status },
      afterValues: { status: "VOID" },
      reason,
    });
  }

  /**
   * Archive a file version.
   */
  async archiveVersion(versionId: string, actor: Actor, reason: string): Promise<void> {
    if (!reason || !reason.trim()) {
      throw new FileError(FileErrorCode.VALIDATION_ERROR, "Reason is required to archive a file version");
    }

    const allowed = await canPerformLifecycleAction(actor, versionId, "ARCHIVE");
    if (!allowed.allowed) {
      throw new Error("FORBIDDEN");
    }

    const fileVersion = await prisma.fileVersion.findUnique({ where: { id: versionId } });
    if (!fileVersion) throw new Error("File version not found");

    await prisma.fileVersion.update({
      where: { id: versionId },
      data: { status: "ARCHIVED" },
    });

    await audit.record({
      actorId: actor.id,
      action: "ARCHIVE",
      entity: "FILE_VERSION",
      entityId: versionId,
      beforeValues: { status: fileVersion.status },
      afterValues: { status: "ARCHIVED" },
      reason,
    });
  }

  /**
   * Attach a file to an entity (rejection, discrepancy, expense, etc.).
   */
  async attach(input: {
    entityType: string;
    entityId: string;
    stream: ReadableStream<Uint8Array>;
    fileName: string;
    kind: "VOICE_NOTE" | "IMAGE" | "FILE";
    actor: Actor;
  }): Promise<string> {
    const { entityType, entityId, stream, fileName, kind, actor } = input;

    // Stream to temp and compute integrity
    const tempPath = join(tmpdir(), `attach-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    try {
      const { size, sha256 } = await streamToTempFile(stream, tempPath);
      const mimeType = this.getMimeType(fileName);

      // Validate
      validateAttachmentInput({
        entityType,
        entityId,
        fileName,
        kind,
        createdById: actor.id,
        fileSize: size,
        mimeType,
      });

      // Deduplicate FileObject — upsert to handle concurrent uploads
      const storageKey = `${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}`;
      let fileObject;
      let isNewObject = false;

      try {
        fileObject = await prisma.fileObject.create({
          data: { storageKey, sizeBytes: size, sha256, mimeType },
        });
        isNewObject = true;
      } catch (e: any) {
        if (e?.code === "P2002") {
          fileObject = await prisma.fileObject.findUnique({ where: { sha256 } });
          if (!fileObject) throw e;
        } else {
          throw e;
        }
      }

      if (isNewObject) {
        const { createReadStream } = await import("fs");
        const fileStream = createReadStream(tempPath);
        await this.storage.put(storageKey, fileStream as any);
      }

      // Create Attachment
    const attachment = await prisma.attachment.create({
      data: {
        fileObjectId: fileObject.id,
        entityType,
        entityId,
        originalName: fileName,
        kind,
        createdById: actor.id,
        status: "ACTIVE",
      },
    });

    await audit.record({
      actorId: actor.id,
      action: "CREATE",
      entity: "ATTACHMENT",
      entityId: attachment.id,
      afterValues: {
        entityType,
        entityId,
        fileName,
        kind,
        fileObjectId: fileObject.id,
      },
    });

    return attachment.id;
    } finally {
      try {
        const { unlinkSync } = await import("fs");
        unlinkSync(tempPath);
      } catch {}
    }
  }

  /**
   * Verify preview grant and return file version if valid.
   */
  async verifyPreviewGrant(token: string) {
    const payload = verifyPreviewGrant(token);
    return payload;
  }

  // Helper methods

  private toOutput(v: any): FileVersionOutput {
    return {
      id: v.id,
      fileAssetId: v.fileAssetId,
      fileObjectId: v.fileObjectId,
      versionNumber: v.versionNumber,
      originalName: v.originalName,
      uploadedById: v.uploadedById,
      note: v.note,
      status: v.status,
      approved: v.approved,
      createdAt: v.createdAt,
      fileObject: v.fileObject ? {
        id: v.fileObject.id,
        storageKey: v.fileObject.storageKey,
        sizeBytes: v.fileObject.sizeBytes,
        sha256: v.fileObject.sha256,
        mimeType: v.fileObject.mimeType,
      } : null,
    };
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split(".").pop();
    const map: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      ai: "application/vnd.adobe.illustrator",
      psd: "application/vnd.adobe.photoshop",
      tiff: "image/tiff",
      tif: "image/tiff",
      wav: "audio/wav",
      mp3: "audio/mpeg",
    };
    return ext && map[ext] ? map[ext] : "application/octet-stream";
  }

  private async authorizeApprove(actor: Actor, versionId: string) {
    const allowed = await canApproveFileVersion(actor, versionId);
    if (!allowed.allowed) throw new Error("FORBIDDEN");
  }
}

export const fileService = new FileService();