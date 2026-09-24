// Attachments service — 050-files
// Generic evidence attachments (rejection, discrepancy, expense, audit event, message)
// Consumes 001 audit.record and 002 StorageAdapter

import { type Prisma, AttachmentKind } from "../../../generated/prisma/index.js";
import type { Actor } from "@/server/auth/getActor.js";
import { LocalDiskStorageAdapter, createLocalDiskAdapter } from "@/server/core/storage/local-disk.js";
import { streamToTempFile } from "./integrity.js";
import { validateAttachmentInput, FileError, FileErrorCode } from "./schemas.js";
import { audit } from "@/server/auth/audit.js";
import { db as prisma } from "@/server/db.js";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface AttachInput {
  entityType: string;
  entityId: string;
  stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream;
  fileName: string;
  kind: "VOICE_NOTE" | "IMAGE" | "FILE" | "voice" | "image" | "file";
  actor: Actor;
}

export interface AttachmentOutput {
  id: string;
  fileObjectId: string;
  entityType: string;
  entityId: string;
  originalName: string;
  kind: AttachmentKind;
  createdById: string;
  status: string;
  createdAt: Date;
  fileObject: {
    id: string;
    storageKey: string;
    sizeBytes: number;
    sha256: string;
    mimeType: string;
  } | null;
}

export interface ListAttachmentsOptions {
  entityType: string;
  entityId: string;
  includeArchived?: boolean;
}

function normalizeKind(kind: string): AttachmentKind {
  const upper = kind.toUpperCase();
  if (upper === "VOICE" || upper === "VOICE_NOTE") return AttachmentKind.VOICE_NOTE;
  if (upper === "IMAGE") return AttachmentKind.IMAGE;
  return AttachmentKind.FILE;
}

function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    ai: "application/vnd.adobe.illustrator",
    psd: "application/vnd.adobe.photoshop",
    tiff: "image/tiff",
    tif: "image/tiff",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    zip: "application/zip",
    txt: "text/plain",
  };
  return ext && map[ext] ? map[ext] : "application/octet-stream";
}

export class AttachmentService {
  private storage: LocalDiskStorageAdapter;

  constructor(storage?: LocalDiskStorageAdapter) {
    this.storage = storage ?? createLocalDiskAdapter();
  }

  /**
   * Attach a file to an entity (generic evidence link).
   * - Streams to temp file, computes SHA-256 and size
   * - Validates attachment input against allowlists and size limits
   * - Deduplicates FileObject by SHA-256
   * - Creates Attachment record
   * - Emits append-only audit event
   */
  async attach(
    txOrInput: Prisma.TransactionClient | AttachInput,
    possibleInput?: AttachInput
  ): Promise<string> {
    const isTx = txOrInput && typeof (txOrInput as any).attachment !== "undefined";
    const db = isTx ? (txOrInput as Prisma.TransactionClient) : prisma;
    const input = isTx ? possibleInput! : (txOrInput as AttachInput);

    const { entityType, entityId, stream, fileName, kind, actor } = input;
    const normalizedKind = normalizeKind(kind);

    // Stream to temp file and compute SHA-256 / size
    const tempPath = join(tmpdir(), `attach-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const { size, sha256 } = await streamToTempFile(stream as any, tempPath);
    const mimeType = getMimeType(fileName);

    // Validate
    validateAttachmentInput({
      entityType,
      entityId,
      fileName,
      kind: normalizedKind,
      createdById: actor.id,
      fileSize: size,
      mimeType,
    });

    // Deduplicate FileObject by SHA-256
    let fileObject = await db.fileObject.findUnique({
      where: { sha256 },
    });

    if (!fileObject) {
      const { createReadStream } = await import("fs");
      const fileStream = createReadStream(tempPath);
      await this.storage.put(sha256, fileStream as any);

      fileObject = await db.fileObject.create({
        data: {
          storageKey: sha256,
          sizeBytes: size,
          sha256,
          mimeType,
        },
      });
    }

    // Clean up temp file
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(tempPath);
    } catch {}

    // Create Attachment
    const attachment = await db.attachment.create({
      data: {
        fileObjectId: fileObject.id,
        entityType,
        entityId,
        originalName: fileName,
        kind: normalizedKind,
        createdById: actor.id,
        status: "ACTIVE",
      },
    });

    // Audit record
    await audit.record(db, {
      actorId: actor.id,
      action: "CREATE",
      entityType: "ATTACHMENT",
      entityId: attachment.id,
      after: {
        entityType,
        entityId,
        fileName,
        kind: normalizedKind,
        fileObjectId: fileObject.id,
      },
    });

    return attachment.id;
  }

  /**
   * List attachments for an entity.
   */
  async list(options: ListAttachmentsOptions): Promise<AttachmentOutput[]> {
    const { entityType, entityId, includeArchived } = options;

    const where: Prisma.AttachmentWhereInput = {
      entityType,
      entityId,
    };

    if (!includeArchived) {
      where.status = { not: "ARCHIVED" };
    }

    const rows = await prisma.attachment.findMany({
      where,
      include: { fileObject: true },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      fileObjectId: r.fileObjectId,
      entityType: r.entityType,
      entityId: r.entityId,
      originalName: r.originalName,
      kind: r.kind,
      createdById: r.createdById,
      status: r.status,
      createdAt: r.createdAt,
      fileObject: r.fileObject
        ? {
            id: r.fileObject.id,
            storageKey: r.fileObject.storageKey,
            sizeBytes: r.fileObject.sizeBytes,
            sha256: r.fileObject.sha256,
            mimeType: r.fileObject.mimeType,
          }
        : null,
    }));
  }

  /**
   * Void an attachment with required reason and audit.
   */
  async void(attachmentId: string, actor: Actor, reason: string): Promise<void> {
    if (!reason || !reason.trim()) {
      throw new FileError(FileErrorCode.VALIDATION_ERROR, "Reason is required to void attachment");
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new FileError(FileErrorCode.FILE_NOT_FOUND, "Attachment not found");
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: "VOID" },
    });

    await audit.record(prisma, {
      actorId: actor.id,
      action: "VOID",
      entityType: "ATTACHMENT",
      entityId: attachmentId,
      before: { status: attachment.status },
      after: { status: "VOID" },
      reason,
    });
  }

  /**
   * Archive an attachment with required reason and audit.
   */
  async archive(attachmentId: string, actor: Actor, reason: string): Promise<void> {
    if (!reason || !reason.trim()) {
      throw new FileError(FileErrorCode.VALIDATION_ERROR, "Reason is required to archive attachment");
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new FileError(FileErrorCode.FILE_NOT_FOUND, "Attachment not found");
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: "ARCHIVED" },
    });

    await audit.record(prisma, {
      actorId: actor.id,
      action: "ARCHIVE",
      entityType: "ATTACHMENT",
      entityId: attachmentId,
      before: { status: attachment.status },
      after: { status: "ARCHIVED" },
      reason,
    });
  }
}

export const attachments = new AttachmentService();
