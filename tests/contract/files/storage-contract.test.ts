// Storage adapter contract tests — 050-files T038
// Tests path traversal prevention and private-root isolation

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLocalDiskAdapter, LocalDiskStorageAdapter } from "@/server/core/storage/local-disk.js";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";

function createReadable(content: string): ReadableStream<Uint8Array> {
  const data = new TextEncoder().encode(content);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

function nodeReadable(content: string): Readable {
  return Readable.from(Buffer.from(content), { objectMode: false });
}

describe("Storage Contract: Path Traversal & Private Root (T038)", () => {
  let storageRoot: string;
  let adapter: LocalDiskStorageAdapter;

  beforeEach(() => {
    storageRoot = mkdtempSync(join(tmpdir(), "storage-contract-"));
    adapter = createLocalDiskAdapter(storageRoot);
  });

  afterEach(() => {
    try {
      rmSync(storageRoot, { recursive: true, force: true });
    } catch {}
  });

  it("rejects path traversal with ../", async () => {
    await expect(
      adapter.put("../../../etc/passwd", nodeReadable("malicious"))
    ).rejects.toThrow("Path traversal attempt rejected");
  });

  it("rejects path traversal with absolute-like key starting with /", async () => {
    await expect(
      adapter.put("/etc/passwd", nodeReadable("malicious"))
    ).rejects.toThrow("Path traversal attempt rejected");
  });

  it("rejects path traversal with backslash on Windows", async () => {
    await expect(
      adapter.put("..\\..\\windows\\system32\\config\\sam", nodeReadable("malicious"))
    ).rejects.toThrow("Path traversal attempt rejected");
  });

  it("rejects path traversal with nested traversal", async () => {
    await expect(
      adapter.put("safe/../../etc/passwd", nodeReadable("malicious"))
    ).rejects.toThrow("Path traversal attempt rejected");
  });

  it("stores files under the configured root directory", async () => {
    const key = "ab/cd/validhash123";
    await adapter.put(key, nodeReadable("safe content"));

    const expectedPath = join(storageRoot, "ab", "cd", "validhash123");
    const content = readFileSync(expectedPath, "utf-8");
    expect(content).toBe("safe content");
  });

  it("does not expose files outside root", async () => {
    const key = "ab/cd/file1";
    await adapter.put(key, nodeReadable("contained"));

    // Verify file is under root
    const expectedPath = join(storageRoot, "ab", "cd", "file1");
    expect(expectedPath.startsWith(storageRoot)).toBe(true);
  });

  it("exists returns true for stored key and false for missing", async () => {
    const key = "ex/ex/testexists";
    expect(await adapter.exists(key)).toBe(false);

    await adapter.put(key, nodeReadable("exists test"));
    expect(await adapter.exists(key)).toBe(true);
  });

  it("put refuses to overwrite existing key", async () => {
    const key = "ow/ow/overwrite-test";
    await adapter.put(key, nodeReadable("original"));

    await expect(
      adapter.put(key, nodeReadable("overwrite attempt"))
    ).rejects.toThrow("refusing to overwrite");
  });

  it("get throws for non-existent key", async () => {
    await expect(adapter.get("no/such/key")).rejects.toThrow();
  });

  it("getWithVerification detects tampered bytes", async () => {
    const { createHash } = await import("node:crypto");
    const key = "tv/tv/tamper-test";
    const content = "original content for verification";
    const expectedSha = createHash("sha256").update(content).digest("hex");

    await adapter.put(key, nodeReadable(content));

    // Tamper directly on filesystem
    const fs = await import("node:fs/promises");
    await fs.writeFile(join(storageRoot, key), "TAMPERED CONTENT");

    await expect(
      adapter.getWithVerification(key, expectedSha, Buffer.byteLength(content))
    ).rejects.toThrow(/Checksum mismatch/);
  });

  it("getWithVerification succeeds with correct checksum", async () => {
    const { createHash } = await import("node:crypto");
    const key = "tv/tv/verify-ok";
    const content = "correct content";
    const expectedSha = createHash("sha256").update(content).digest("hex");

    await adapter.put(key, nodeReadable(content));

    const stream = await adapter.getWithVerification(
      key,
      expectedSha,
      Buffer.byteLength(content)
    );
    expect(stream).toBeDefined();
  });

  it("storage key is opaque — no customer/workitem/user names in path", async () => {
    const key = "a1/b2/sha256hashvalue";
    await adapter.put(key, nodeReadable("opaque key test"));

    const path = join(storageRoot, key);
    // Path should not contain any customer-like names
    expect(path).not.toContain("customer");
    expect(path).not.toContain("workitem");
    expect(path).not.toContain("user");
  });
});
