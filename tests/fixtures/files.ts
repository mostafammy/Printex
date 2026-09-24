import { FileCategory, FileLifecycleStatus, AttachmentKind } from "@prisma/client";

export const fileFixtures = {
  categories: [
    FileCategory.ORIGINAL,
    FileCategory.DESIGN_VERSIONS,
    FileCategory.REVIEW_PROOF,
    FileCategory.APPROVED,
    FileCategory.PRODUCTION,
    FileCategory.SUPPORTING,
  ],
  statuses: [
    FileLifecycleStatus.ACTIVE,
    FileLifecycleStatus.SUPERSEDED,
    FileLifecycleStatus.VOID,
    FileLifecycleStatus.ARCHIVED,
    FileLifecycleStatus.CORRUPTED,
  ],
  kinds: [
    AttachmentKind.VOICE_NOTE,
    AttachmentKind.IMAGE,
    AttachmentKind.FILE,
  ],
  mimeTypes: {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    ai: "application/vnd.adobe.illustrator",
    psd: "application/vnd.adobe.photoshop",
    tiff: "image/tiff",
    wav: "audio/wav",
    mp3: "audio/mpeg",
  },
  checksums: {
    valid: "a".repeat(64),
    invalid: "b".repeat(64),
  },
  sizes: {
    small: 1024,           // 1 KB
    medium: 5 * 1024 * 1024,  // 5 MB
    large: 500 * 1024 * 1024, // 500 MB
    huge: 2 * 1024 * 1024 * 1024, // 2 GB
    max: 5 * 1024 * 1024 * 1024,  // 5 GB
    overMax: 6 * 1024 * 1024 * 1024, // 6 GB (over limit)
  },
};

export function makeFileObjectInput(overrides = {}) {
  return {
    storageKey: `ab/cd/${crypto.randomUUID()}`,
    sizeBytes: fileFixtures.sizes.medium,
    sha256: fileFixtures.checksums.valid,
    mimeType: fileFixtures.mimeTypes.pdf,
    ...overrides,
  };
}

export function makeFileAssetInput(workItemId: string, overrides = {}) {
  return {
    workItemId,
    category: FileCategory.DESIGN_VERSIONS,
    logicalName: `design-${Date.now()}`,
    ...overrides,
  };
}

export function makeFileVersionInput(fileAssetId: string, fileObjectId: string, versionNumber: number, overrides = {}) {
  return {
    fileAssetId,
    fileObjectId,
    versionNumber,
    originalName: `design-v${versionNumber}.pdf`,
    uploadedById: "user-123",
    note: `Version ${versionNumber}`,
    status: FileLifecycleStatus.ACTIVE,
    approved: false,
    ...overrides,
  };
}

export function makeAttachmentInput(overrides = {}) {
  return {
    fileObjectId: "file-object-123",
    entityType: "rejection",
    entityId: "rejection-123",
    originalName: "voice-note.wav",
    kind: AttachmentKind.VOICE_NOTE,
    createdById: "user-123",
    status: FileLifecycleStatus.ACTIVE,
    ...overrides,
  };
}

export function makeConfigInput(overrides = {}) {
  return {
    id: "files-config",
    mimeAllowlist: Object.values(fileFixtures.mimeTypes),
    maxFileSizeBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    departments: [{ name: "Design", code: "DESIGN" }, { name: "Production", code: "PROD" }],
    previewExpirySeconds: 300,
    updatedById: "admin-123",
    ...overrides,
  };
}

// Stream helpers for testing large file uploads
export function createTestStream(sizeBytes: number): ReadableStream<Uint8Array> {
  const chunkSize = 64 * 1024; // 64 KB chunks
  let remaining = sizeBytes;

  return new ReadableStream({
    start(controller) {},
    pull(controller) {
      if (remaining <= 0) {
        controller.close();
        return;
      }
      const chunk = new Uint8Array(Math.min(chunkSize, remaining));
      chunk.fill(0x42); // Fill with 'B'
      controller.enqueue(chunk);
      remaining -= chunk.length;
    },
    cancel() {},
  });
}

export function createTestFile(sizeBytes: number, mimeType = "application/pdf"): File {
  const buffer = new Uint8Array(sizeBytes);
  buffer.fill(0x42);
  return new File([buffer], `test-${sizeBytes}.pdf`, { type: mimeType });
}

// Large file benchmark helpers
export const benchmarkFiles = {
  small: { size: 1024 * 1024, name: "1MB.pdf" },           // 1 MB
  medium: { size: 100 * 1024 * 1024, name: "100MB.pdf" },   // 100 MB
  large: { size: 500 * 1024 * 1024, name: "500MB.pdf" },    // 500 MB
  huge: { size: 2 * 1024 * 1024 * 1024, name: "2GB.pdf" },  // 2 GB
  max: { size: 5 * 1024 * 1024 * 1024, name: "5GB.pdf" },   // 5 GB
};