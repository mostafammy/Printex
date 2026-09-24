// Frozen public barrel — 050-files
// Contracts: files.upload, files.listVersions, files.markApproved, files.getDownloadUrl,
// files.void, files.archive, attachments.attach, <FilePanel>

export { FileService, fileService, type UploadInput, type FileVersionOutput, type ListVersionsOptions } from "./service.js";
export { validateUploadInput, validateAttachmentInput, FileError, FileErrorCode, listVersionsQuerySchema } from "./schemas.js";
export { createPreviewGrant, verifyPreviewGrant, createPreviewUrl, createDownloadUrl, type SignedPreviewGrant } from "./signed-preview.js";
export { canDownloadFileVersion, canListFileVersions, canPerformLifecycleAction, canApproveFileVersion, authorizeFileDownload, authorizeFileList, authorizeFileLifecycle, authorizeFileApprove } from "./authorization.js";
export { streamToTempFile, computeStreamIntegrity, verifyStreamIntegrity, withRetry } from "./integrity.js";
export { LocalDiskStorageAdapter, createLocalDiskAdapter } from "@/server/core/storage/local-disk.js";
export { getFilesConfig, isMimeAllowed, type FilesConfig } from "./config.js";
export { loadFilesConfig, resetFilesConfig } from "./config.js";
export { FileConfig, FileObject, FileAsset, FileVersion, FileVersionStatus, Attachment, FileAuditEvent } from "@prisma/client";