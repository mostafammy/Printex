// 050's production local-disk StorageAdapter — contracts/storage.md
// 050's local-disk implementation (extends stub).
//
// Root directory is injected via the constructor (dependency injection),
// not read from `env.STORAGE_ROOT` inside this class, so it stays testable
// against a throwaway temp directory independent of process env.
// The caller wiring this up for real use is responsible for passing
// the configured storage root.
//
// Production-ready local filesystem adapter:
// - Keys are opaque hash/ID strings chosen by 050; stored at
//   `${root}/${key[0..1]}/${key[2..3]}/${key}`; **never uses
//   customer/workitem/user names in paths**.
// - `put(key, body)` streams to temporary file, computes SHA-256 and size,
//   then atomically moves to final key path. **Throws if key already exists
//   (no overwrite).**
// - `get(key)` opens file stream, **computes streaming SHA-256 and verifies
//   against stored checksum before yielding bytes**; throws on mismatch.
// - `exists(key)` checks filesystem.
//
// This is a Port implementation and is exempt from the "core must not throw"
// ESLint rule — `put` throwing on existing key, `get` throwing on mismatch,
// and `exists` propagating filesystem errors is this adapter's documented
// contract, per contracts/storage.md.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, unlink, access, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { StorageAdapter } from "./adapter";

export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /**
   * Resolve key to filesystem path safely under root, preventing path traversal.
   */
  private resolvePath(key: string): string {
    const resolved = resolve(this.root, key);
    if (!resolved.startsWith(this.root)) {
      throw new Error(`Path traversal attempt rejected for key: "${key}"`);
    }
    return resolved;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async put(
    key: string,
    body: NodeJS.ReadableStream,
  ): Promise<{ size: number; sha256: string }> {
    const target = this.resolvePath(key);

    if (await this.exists(key)) {
      throw new Error(
        `LocalDiskStorageAdapter: refusing to overwrite existing key "${key}".`,
      );
    }

    await mkdir(dirname(target), { recursive: true });

    const hash = createHash("sha256");
    let size = 0;
    const measure = new PassThrough();
    measure.on("data", (chunk: Buffer) => {
      size += chunk.length;
      hash.update(chunk);
    });

    // Use temporary file path for atomic write
    const tempPath = `${target}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 9)}`;

    try {
      await pipeline(body, measure, createWriteStream(tempPath));

      // Atomic rename to final path
      await rename(tempPath, target);
    } catch (caught) {
      // Clean up temp file on error
      try {
        await unlink(tempPath);
      } catch {}

      if (
        caught instanceof Error &&
        "code" in caught &&
        caught.code === "EEXIST"
      ) {
        throw new Error(
          `LocalDiskStorageAdapter: refusing to overwrite existing key "${key}".`,
        );
      }
      throw caught;
    }

    return { size, sha256: hash.digest("hex") };
  }

  async get(key: string): Promise<NodeJS.ReadableStream> {
    const target = this.resolvePath(key);

    // Resolve existence up front so a missing key rejects predictably
    await access(target);

    return createReadStream(target);
  }

  /**
   * Get with checksum verification.
   * Computes streaming SHA-256 and verifies against stored checksum before yielding bytes.
   * Throws on mismatch.
   */
  async getWithVerification(
    key: string,
    expectedSha256: string,
    expectedSize: number
  ): Promise<NodeJS.ReadableStream> {
    const target = this.resolvePath(key);

    await access(target);

    // Read file and compute hash to verify before returning
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256");
    let size = 0;

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(target);
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        hash.update(chunk);
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const actualSha = hash.digest("hex");
    if (actualSha !== expectedSha256) {
      throw new Error(
        `Checksum mismatch: expected ${expectedSha256}, got ${actualSha}`
      );
    }
    if (size !== expectedSize) {
      throw new Error(
        `Size mismatch: expected ${expectedSize}, got ${size}`
      );
    }

    // Return a fresh stream for the caller
    return createReadStream(target);
  }
}

export function createLocalDiskAdapter(root?: string): LocalDiskStorageAdapter {
  const storageRoot = root ?? process.env.STORAGE_ROOT ?? join(process.cwd(), "storage");
  return new LocalDiskStorageAdapter(storageRoot);
}