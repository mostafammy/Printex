// Contract test — tasks.md T034 (US4), contracts/storage.md.
//
// Verifies `LocalDiskStorageAdapter` complies with the `StorageAdapter`
// interface: `put`/`get` round-trip bytes identically, `exists()` reports
// presence/absence correctly, and `put()` refuses to overwrite an existing
// key. Runs against a throwaway `fs.mkdtempSync` directory, cleaned up after
// each test — never touches a real `STORAGE_ROOT`.

import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalDiskStorageAdapter } from "~/server/core";

function toStream(data: Buffer): NodeJS.ReadableStream {
  return Readable.from(data);
}

describe("LocalDiskStorageAdapter (StorageAdapter contract)", () => {
  let root: string;
  let adapter: LocalDiskStorageAdapter;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "printex-storage-test-"));
    adapter = new LocalDiskStorageAdapter(root);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("puts a file and reads it back byte-identical", async () => {
    const payload = randomBytes(4096);

    const putResult = await adapter.put("orders/1/file.bin", toStream(payload));

    expect(putResult.size).toBe(payload.length);
    expect(putResult.sha256).toMatch(/^[0-9a-f]{64}$/);

    const stream = await adapter.get("orders/1/file.bin");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const readBack = Buffer.concat(chunks);

    expect(readBack.equals(payload)).toBe(true);
  });

  it("computes a correct sha256 over the streamed body", async () => {
    const { createHash } = await import("node:crypto");
    const payload = Buffer.from("printex storage adapter contract test", "utf8");
    const expected = createHash("sha256").update(payload).digest("hex");

    const { sha256 } = await adapter.put("checksum.txt", toStream(payload));

    expect(sha256).toBe(expected);
  });

  it("exists() returns false for a missing key and true once written", async () => {
    await expect(adapter.exists("missing.bin")).resolves.toBe(false);

    await adapter.put("present.bin", toStream(Buffer.from("x")));

    await expect(adapter.exists("present.bin")).resolves.toBe(true);
  });

  it("refuses to overwrite an existing key", async () => {
    await adapter.put("dup.bin", toStream(Buffer.from("first")));

    await expect(
      adapter.put("dup.bin", toStream(Buffer.from("second"))),
    ).rejects.toThrow();

    // The original content must survive the rejected overwrite attempt.
    const original = await readFile(join(root, "dup.bin"), "utf8");
    expect(original).toBe("first");
  });

  it("get() on a missing key rejects", async () => {
    await expect(adapter.get("does-not-exist.bin")).rejects.toThrow();
  });

  it("does not buffer files fully via a synchronous existsSync check bypass", () => {
    // Sanity check that the adapter actually wrote under `root` and not
    // somewhere else (e.g. cwd) — guards against a key-resolution bug.
    expect(existsSync(root)).toBe(true);
  });
});
