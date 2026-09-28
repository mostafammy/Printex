// Frozen public barrel — 050-files
// Contracts: files.upload, files.listVersions, files.markApproved, files.getDownloadUrl,
// files.void, files.archive, attachments.attach, <FilePanel>
//
// Relative imports here are EXTENSIONLESS on purpose. 050 originally wrote
// them as `./service.js` TS-ESM specifiers, which resolve only under the
// webpack `extensionAlias` in next.config.js — and `pnpm dev` runs
// `--turbo`, where the webpack function is ignored entirely and Turbopack
// looks for a literal `service.js`, failing with
// `Module not found: Can't resolve './attachments.js'`. Extensionless matches
// every other module in this repo and resolves under both bundlers.

export { FileService, fileService, type UploadInput, type FileVersionOutput, type ListVersionsOptions } from "./service";
export { AttachmentService, attachments, type AttachInput, type AttachmentOutput, type ListAttachmentsOptions } from "./attachments";
export { validateUploadInput, validateAttachmentInput, FileError, FileErrorCode, listVersionsQuerySchema } from "./schemas";
export { createPreviewGrant, verifyPreviewGrant, encodeGrant, decodeAndVerifyGrant, createPreviewUrl, createDownloadUrl, type SignedPreviewGrant } from "./signed-preview";
export { canDownloadFileVersion, canListFileVersions, canPerformLifecycleAction, canApproveFileVersion, authorizeFileDownload, authorizeFileList, authorizeFileLifecycle, authorizeFileApprove } from "./authorization";
export { streamToTempFile, computeStreamIntegrity, verifyStreamIntegrity, withRetry } from "./integrity";
export { LocalDiskStorageAdapter, createLocalDiskAdapter } from "@/server/core/storage/local-disk";
export { getFilesConfig, isMimeAllowed, type FilesConfig } from "./config";
export { loadFilesConfig, resetFilesConfig } from "./config";
export { getMemorySnapshot, computeMemoryDelta, recordUploadMetrics, recordPreviewMetrics, isPreviewGrantExpired, createPreviewMetrics, formatMemorySnapshot, type UploadMetrics, type PreviewMetrics, type MemorySnapshot } from "./observability";
export type { FileConfig, FileObject, FileAsset, FileVersion, Attachment, FileAuditEvent, FileLifecycleStatus } from "../../../generated/prisma";