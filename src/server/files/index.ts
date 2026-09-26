// Frozen public barrel — 050-files
// Contracts: files.upload, files.listVersions, files.markApproved, files.getDownloadUrl,
// files.void, files.archive, attachments.attach, <FilePanel>

export { FileService, fileService, type UploadInput, type FileVersionOutput, type ListVersionsOptions } from "./service.js";
export { AttachmentService, attachments, type AttachInput, type AttachmentOutput, type ListAttachmentsOptions } from "./attachments.js";
export { validateUploadInput, validateAttachmentInput, FileError, FileErrorCode, listVersionsQuerySchema } from "./schemas.js";
export { createPreviewGrant, verifyPreviewGrant, encodeGrant, decodeAndVerifyGrant, createPreviewUrl, createDownloadUrl, type SignedPreviewGrant } from "./signed-preview.js";
export { canDownloadFileVersion, canListFileVersions, canPerformLifecycleAction, canApproveFileVersion, authorizeFileDownload, authorizeFileList, authorizeFileLifecycle, authorizeFileApprove } from "./authorization.js";
export { streamToTempFile, computeStreamIntegrity, verifyStreamIntegrity, withRetry } from "./integrity.js";
export { LocalDiskStorageAdapter, createLocalDiskAdapter } from "@/server/core/storage/local-disk.js";
export { getFilesConfig, isMimeAllowed, type FilesConfig } from "./config.js";
export { loadFilesConfig, resetFilesConfig } from "./config.js";
export { getMemorySnapshot, computeMemoryDelta, recordUploadMetrics, recordPreviewMetrics, isPreviewGrantExpired, createPreviewMetrics, formatMemorySnapshot, type UploadMetrics, type PreviewMetrics, type MemorySnapshot } from "./observability.js";
export type { FileConfig, FileObject, FileAsset, FileVersion, Attachment, FileAuditEvent, FileLifecycleStatus } from "../../../generated/prisma/index.js";