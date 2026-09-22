// Dev-only local-disk StorageAdapter — contracts/storage.md "Local-disk
// stub (this feature)".
//
// Root directory is injected via the constructor (dependency injection),
// not read from `env.STORAGE_ROOT` inside this class, so it stays testable
// against a throwaway temp directory (tests/contract/storageAdapter.test.ts)
// independent of process env. The caller wiring this up for real use (e.g.
// a server-only module) is responsible for passing `env.STORAGE_ROOT`.
//
// Development/CI only — explicitly out of scope for production use (spec
// Assumptions). No versioning, no checksum caching beyond the one computed
// on `put`, no access control.
//
// Stream-based: never buffers a whole file into memory. `sha256` is
// computed incrementally while the body streams to disk.
//
// This is a Port implementation (`src/server/core/storage/**`) and is
// exempt from the "core must not throw" ESLint rule (eslint.config.js rule
// (c)) — `put` throwing on an existing key, and `get`/`exists` propagating
// filesystem errors, is this adapter's documented contract, per
// contracts/storage.md.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { StorageAdapter } from "./adapter";

export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private resolvePath(key: string): string {
    return join(this.root, key);
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

    try {
      // "wx" is exclusive-create: it fails with EEXIST rather than
      // truncating if another writer won a race against the `exists()`
      // check above, closing the TOCTOU gap.
      await pipeline(body, measure, createWriteStream(target, { flags: "wx" }));
    } catch (caught) {
      if (
        caught instanceof Error &&
        "code" in caught &&
        caught.code === "EEXIST"
      ) {
        throw new Error(
          `LocalDiskStorageAdapter: refusing to overwrite existing key "${key}".`,
        );
      }

      // Any other pipeline failure (the source stream erroring mid-transfer,
      // a disk write error, etc.) can leave a partial/corrupted file behind
      // on disk — the "wx" flag only protects against a pre-existing file,
      // not a failure after bytes have already been flushed. Left in place,
      // that partial file would make every future `put()` for this key fail
      // with "refusing to overwrite existing key" (since `exists()` now sees
      // it) and would make `get()` silently return truncated content. Clean
      // it up so a retry with the same key can succeed.
      try {
        await unlink(target);
      } catch {
        // The file may not exist yet (e.g. the failure happened before any
        // bytes were written) — that's fine. Never let a failed cleanup
        // attempt mask the original error below.
      }

      throw caught;
    }

    return { size, sha256: hash.digest("hex") };
  }

  async get(key: string): Promise<NodeJS.ReadableStream> {
    const target = this.resolvePath(key);
    // Resolve existence up front so a missing key rejects predictably
    // (contracts/storage.md) rather than returning a stream that only
    // errors asynchronously once something starts reading it.
    await access(target);
    return createReadStream(target);
  }
}
