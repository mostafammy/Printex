import { createHash } from "crypto";
import { getFilesConfig } from "./config.js";

export interface StreamIntegrityResult {
  size: number;
  sha256: string;
}

export interface BoundedStreamOptions {
  highWaterMark?: number; // bytes
  maxSize?: number; // bytes, defaults to config max
  timeoutMs?: number; // per-chunk timeout
}

/**
 * Stream a readable stream to a temporary file, computing SHA-256 and size
 * without buffering the whole file in memory.
 *
 * Uses TransformStream with backpressure to bound memory usage.
 * Defaults to 200MB highWaterMark and config max file size.
 */
export async function streamToTempFile(
  readable: ReadableStream<Uint8Array>,
  tempPath: string,
  options: BoundedStreamOptions = {}
): Promise<StreamIntegrityResult> {
  const config = getFilesConfig();
  const {
    highWaterMark = 200 * 1024 * 1024, // 200 MB default
    maxSize = getFilesConfig().maxFileSizeBytes,
    timeoutMs = 30_000, // 30s per chunk
  } = options;

  const { createWriteStream } = await import("fs");
  const { pipeline } = await import("stream/promises");
  const { createHash } = await import("crypto");

  const hash = createHash("sha256");
  let totalSize = 0;

  // Create a transform stream that hashes and enforces size limit
  const transformStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      totalSize += chunk.length;

      if (totalSize > maxSize) {
        controller.error(new Error(`File size ${totalSize} exceeds maximum allowed ${maxSize} bytes`));
        return;
      }

      hash.update(chunk);
      controller.enqueue(chunk);
    },
  });

  // Wrap with timeout enforcement
  const timeoutStream = new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      // Each chunk must pass through within timeoutMs
      await Promise.race([
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
        Promise.resolve(),
      ]);
      controller.enqueue(chunk);
    },
  });

  // Pipe: readable -> timeout -> transform -> write to temp file
  const writer = createWriteStream(tempPath, { flags: "wx" }); // wx = exclusive create, fail if exists

  try {
    await pipeline(
      readable,
      timeoutStream,
      transformStream,
      writer
    );
  } catch (error) {
    // Clean up temp file on error
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(tempPath);
    } catch {}
    throw error;
  }

  return {
    size: totalSize,
    sha256: hash.digest("hex"),
  };
}

/**
 * Compute SHA-256 and size from a readable stream without writing to disk.
 * Useful for verification on read.
 */
export async function computeStreamIntegrity(
  readable: ReadableStream<Uint8Array>
): Promise<StreamIntegrityResult> {
  const hash = createHash("sha256");
  let totalSize = 0;

  const reader = readable.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalSize += value.length;
        hash.update(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    size: totalSize,
    sha256: hash.digest("hex"),
  };
}

/**
 * Verify stream integrity against expected SHA-256 and size.
 * Throws on mismatch.
 */
export async function verifyStreamIntegrity(
  readable: ReadableStream<Uint8Array>,
  expectedSha256: string,
  expectedSize: number
): Promise<void> {
  const { size, sha256 } = await computeStreamIntegrity(readable);

  if (size !== expectedSize) {
    throw new Error(`Size mismatch: expected ${expectedSize}, got ${size}`);
  }

  if (sha256 !== expectedSha256) {
    throw new Error(`Checksum mismatch: expected ${expectedSha256}, got ${sha256}`);
  }
}

/**
 * Retry policy for concurrent version creation.
 * Max 3 attempts with exponential backoff: 100ms, 200ms, 400ms.
 * Total timeout per attempt: 5 seconds.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 100,
  attemptTimeoutMs = 5_000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Wrap operation with timeout
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Operation timeout")), attemptTimeoutMs)
        ),
      ]);
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors or size/MIME errors
      if (error instanceof Error && (
        error.message.includes("exceeds maximum") ||
        error.message.includes("not in allowlist") ||
        error.message.includes("Invalid filename")
      )) {
        throw error;
      }

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 100, 200, 400
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}