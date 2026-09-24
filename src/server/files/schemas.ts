import { z } from "zod";
import { FileCategory, FileLifecycleStatus, AttachmentKind } from "@prisma/client";
import { getFilesConfig, isMimeAllowed } from "./config.js";

// Re-export enums for convenience
export { FileCategory, FileLifecycleStatus, AttachmentKind };

// Category schema
export const fileCategorySchema = z.nativeEnum(FileCategory);

// Status schema
export const fileLifecycleStatusSchema = z.nativeEnum(FileLifecycleStatus);

// Attachment kind schema
export const attachmentKindSchema = z.nativeEnum(AttachmentKind);

// Upload input schema
export const uploadInputSchema = z.object({
  workItemId: z.string().cuid(),
  category: fileCategorySchema,
  fileName: z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1F]+$/, "Invalid filename"),
  note: z.string().max(1000).optional(),
  actorId: z.string().cuid(),
});

// Upload validation with MIME/size check
export function validateUploadInput(input: z.infer<typeof uploadInputSchema>, fileSize: number, mimeType: string) {
  const config = getFilesConfig();

  const validated = uploadInputSchema.parse(input);

  if (fileSize > config.maxFileSizeBytes) {
    throw new Error(`File size ${fileSize} exceeds maximum allowed ${config.maxFileSizeBytes} bytes`);
  }

  if (!isMimeAllowed(mimeType)) {
    throw new Error(`MIME type ${mimeType} not in allowlist`);
  }

  return { ...validated, fileSize, mimeType };
}

// Lifecycle action input
export const lifecycleActionSchema = z.object({
  versionId: z.string().cuid(),
  actorId: z.string().cuid(),
  reason: z.string().min(1).max(500),
});

// Mark approved input
export const markApprovedInputSchema = z.object({
  versionId: z.string().cuid(),
  actorId: z.string().cuid(),
});

// Download URL input
export const downloadUrlInputSchema = z.object({
  versionId: z.string().cuid(),
  actorId: z.string().cuid(),
});

// Attachment input
export const attachmentInputSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().min(1).max(100),
  fileName: z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1F]+$/, "Invalid filename"),
  kind: attachmentKindSchema,
  createdById: z.string().cuid(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
});

export function validateAttachmentInput(input: z.infer<typeof attachmentInputSchema>) {
  const config = getFilesConfig();

  const validated = attachmentInputSchema.parse(input);

  if (input.fileSize > config.maxFileSizeBytes) {
    throw new Error(`File size ${input.fileSize} exceeds maximum allowed ${config.maxFileSizeBytes} bytes`);
  }

  if (!isMimeAllowed(input.mimeType)) {
    throw new Error(`MIME type ${input.mimeType} not in allowlist`);
  }

  return validated;
}

// List versions query
export const listVersionsQuerySchema = z.object({
  workItemId: z.string().cuid(),
  category: fileCategorySchema.optional(),
  status: fileLifecycleStatusSchema.optional(),
  includeArchived: z.boolean().default(false),
});

// Error codes for route-level mapping
export const FileErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CHECKSUM_MISMATCH: "CHECKSUM_MISMATCH",
  EXPIRED_GRANT: "EXPIRED_GRANT",
  INCOMPLETE_UPLOAD: "INCOMPLETE_UPLOAD",
  SIZE_EXCEEDED: "SIZE_EXCEEDED",
  MIME_UNSUPPORTED: "MIME_UNSUPPORTED",
  CHECKSUM_VERIFICATION_FAILED: "CHECKSUM_VERIFICATION_FAILED",
  CONCURRENT_VERSION_CONFLICT: "CONCURRENT_VERSION_CONFLICT",
  INVALID_GRANT: "INVALID_GRANT",
  UPLOAD_CLEANUP_FAILED: "UPLOAD_CLEANUP_FAILED",
} as const;

export type FileErrorCode = (typeof FileErrorCode)[keyof typeof FileErrorCode];

export class FileError extends Error {
  constructor(
    public readonly code: FileErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "FileError";
  }
}