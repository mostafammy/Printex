import { z } from "zod";
import { getFilesConfig, isMimeAllowed } from "./config.js";

export const FileCategory = {
  ORIGINAL: "ORIGINAL",
  DESIGN_VERSIONS: "DESIGN_VERSIONS",
  REVIEW_PROOF: "REVIEW_PROOF",
  APPROVED: "APPROVED",
  PRODUCTION: "PRODUCTION",
  SUPPORTING: "SUPPORTING",
} as const;
export type FileCategory = (typeof FileCategory)[keyof typeof FileCategory];

export const FileLifecycleStatus = {
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
  VOID: "VOID",
  ARCHIVED: "ARCHIVED",
  CORRUPTED: "CORRUPTED",
} as const;
export type FileLifecycleStatus = (typeof FileLifecycleStatus)[keyof typeof FileLifecycleStatus];

export const AttachmentKind = {
  VOICE_NOTE: "VOICE_NOTE",
  IMAGE: "IMAGE",
  FILE: "FILE",
} as const;
export type AttachmentKind = (typeof AttachmentKind)[keyof typeof AttachmentKind];

// Category schema
export const fileCategorySchema = z.enum([
  "ORIGINAL",
  "DESIGN_VERSIONS",
  "REVIEW_PROOF",
  "APPROVED",
  "PRODUCTION",
  "SUPPORTING",
]);

// Status schema
export const fileLifecycleStatusSchema = z.enum([
  "ACTIVE",
  "SUPERSEDED",
  "VOID",
  "ARCHIVED",
  "CORRUPTED",
]);

// Attachment kind schema
export const attachmentKindSchema = z.enum(["VOICE_NOTE", "IMAGE", "FILE"]);

// Upload input schema
export const uploadInputSchema = z.object({
  workItemId: z.string().min(1),
  category: fileCategorySchema,
  fileName: z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1F]+$/, "Invalid filename"),
  note: z.string().max(1000).optional(),
  actorId: z.string().min(1),
});

// Upload validation with MIME/size check
export function validateUploadInput(input: unknown, fileSize: number, mimeType: string) {
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
  versionId: z.string().min(1),
  actorId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

// Mark approved input
export const markApprovedInputSchema = z.object({
  versionId: z.string().min(1),
  actorId: z.string().min(1),
});

// Download URL input
export const downloadUrlInputSchema = z.object({
  versionId: z.string().min(1),
  actorId: z.string().min(1),
});

// Attachment input
export const attachmentInputSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().min(1).max(100),
  fileName: z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1F]+$/, "Invalid filename"),
  kind: attachmentKindSchema,
  createdById: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
});

export function validateAttachmentInput(input: unknown) {
  const config = getFilesConfig();

  const validated = attachmentInputSchema.parse(input);

  if (validated.fileSize > config.maxFileSizeBytes) {
    throw new Error(`File size ${validated.fileSize} exceeds maximum allowed ${config.maxFileSizeBytes} bytes`);
  }

  if (!isMimeAllowed(validated.mimeType)) {
    throw new Error(`MIME type ${validated.mimeType} not in allowlist`);
  }

  return validated;
}

// List versions query
export const listVersionsQuerySchema = z.object({
  workItemId: z.string().min(1),
  category: fileCategorySchema.optional(),
  status: fileLifecycleStatusSchema.optional(),
  includeArchived: z.boolean().default(false),
});

// Error codes for route-level mapping
export const FileErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
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