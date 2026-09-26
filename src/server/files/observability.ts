// Observability diagnostics — 050-files T039
// Memory, upload duration, and preview expiry diagnostics

export interface UploadMetrics {
  /** Upload duration in milliseconds */
  durationMs: number;
  /** File size in bytes */
  sizeBytes: number;
  /** SHA-256 checksum */
  sha256: string;
  /** Bytes per second throughput */
  throughputBytesPerSec: number;
  /** Peak process memory delta in bytes (RSS) */
  peakMemoryDeltaBytes: number;
}

export interface PreviewMetrics {
  /** Grant creation timestamp */
  createdAt: number;
  /** Grant expiry timestamp */
  expiresAt: number;
  /** Time-to-live in seconds */
  ttlSeconds: number;
  /** Whether the grant has expired */
  isExpired: boolean;
}

export interface MemorySnapshot {
  /** RSS in bytes */
  rssBytes: number;
  /** Heap used in bytes */
  heapUsedBytes: number;
  /** Heap total in bytes */
  heapTotalBytes: number;
  /** External memory in bytes */
  externalBytes: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Take a snapshot of current process memory usage.
 */
export function getMemorySnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    rssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    heapTotalBytes: mem.heapTotal,
    externalBytes: mem.external,
    timestamp: Date.now(),
  };
}

/**
 * Compute memory delta between two snapshots.
 */
export function computeMemoryDelta(
  before: MemorySnapshot,
  after: MemorySnapshot
): { rssDeltaBytes: number; heapDeltaBytes: number } {
  return {
    rssDeltaBytes: after.rssBytes - before.rssBytes,
    heapDeltaBytes: after.heapUsedBytes - before.heapUsedBytes,
  };
}

/**
 * Record upload metrics for observability.
 * Logs structured data for monitoring upload performance.
 */
export function recordUploadMetrics(metrics: UploadMetrics): void {
  const logEntry = {
    event: "file_upload_complete",
    durationMs: metrics.durationMs,
    sizeBytes: metrics.sizeBytes,
    sha256: metrics.sha256.slice(0, 12) + "...",
    throughputMBps: Number(
      (metrics.throughputBytesPerSec / (1024 * 1024)).toFixed(2)
    ),
    peakMemoryDeltaMB: Number(
      (metrics.peakMemoryDeltaBytes / (1024 * 1024)).toFixed(2)
    ),
    timestamp: new Date().toISOString(),
  };

  console.log("[files:upload]", JSON.stringify(logEntry));
}

/**
 * Record preview grant metrics.
 */
export function recordPreviewMetrics(metrics: PreviewMetrics): void {
  const logEntry = {
    event: "preview_grant_issued",
    ttlSeconds: metrics.ttlSeconds,
    isExpired: metrics.isExpired,
    timestamp: new Date().toISOString(),
  };

  console.log("[files:preview]", JSON.stringify(logEntry));
}

/**
 * Check if a preview grant is expired.
 */
export function isPreviewGrantExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

/**
 * Create a preview metrics object from grant data.
 */
export function createPreviewMetrics(
  createdAt: number,
  ttlSeconds: number
): PreviewMetrics {
  const expiresAt = createdAt + ttlSeconds * 1000;
  return {
    createdAt,
    expiresAt,
    ttlSeconds,
    isExpired: isPreviewGrantExpired(expiresAt),
  };
}

/**
 * Format a memory snapshot for human-readable logging.
 */
export function formatMemorySnapshot(snapshot: MemorySnapshot): string {
  const rssMB = (snapshot.rssBytes / (1024 * 1024)).toFixed(1);
  const heapMB = (snapshot.heapUsedBytes / (1024 * 1024)).toFixed(1);
  const heapTotalMB = (snapshot.heapTotalBytes / (1024 * 1024)).toFixed(1);
  return `RSS: ${rssMB}MB | Heap: ${heapMB}/${heapTotalMB}MB | External: ${(snapshot.externalBytes / (1024 * 1024)).toFixed(1)}MB`;
}
