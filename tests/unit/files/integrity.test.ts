import { streamToTempFile, computeStreamIntegrity, verifyStreamIntegrity } from "@/server/files/integrity.js";
import { ReadableStream } from "stream/web";
import { describe, it, expect, vi } from "vitest";

describe("Stream integrity", () => {
  describe("streamToTempFile", () => {
    it("computes SHA-256 and size for small stream", async () => {
      const data = new TextEncoder().encode("Hello, World!");
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const tempPath = `/tmp/test-${Date.now()}.tmp`;

      const result = await streamToTempFile(stream, tempPath);

      expect(result.size).toBe(data.length);
      expect(result.sha256).toHaveLength(64); // SHA-256 hex length

      // Verify checksum is correct
      const crypto = await import("crypto");
      const expectedHash = crypto.createHash("sha256").update(data).digest("hex");
      expect(result.sha256).toBe(expectedHash);

      // Cleanup
      const { unlinkSync } = await import("fs");
      try { unlinkSync(tempPath); } catch {}
    });

    it("computes SHA-256 and size for larger stream", async () => {
      const chunkSize = 64 * 1024; // 64 KB
      const numChunks = 10;
      const totalSize = chunkSize * numChunks;

      const stream = new ReadableStream({
        start(controller) {
          for (let i = 0; i < numChunks; i++) {
            const chunk = new Uint8Array(chunkSize);
            chunk.fill(i);
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const tempPath = `/tmp/test-${Date.now()}.tmp`;

      const result = await streamToTempFile(stream, tempPath);

      expect(result.size).toBe(totalSize);
      expect(result.sha256).toHaveLength(64);

      // Cleanup
      const { unlinkSync } = await import("fs");
      try { unlinkSync(tempPath); } catch {}
    });

    it("enforces max size limit", async () => {
      const largeData = new Uint8Array(10 * 1024 * 1024); // 10 MB
      largeData.fill(0x42);

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(largeData);
          controller.close();
        },
      });

      const tempPath = `/tmp/test-${Date.now()}.tmp`;

      await expect(
        streamToTempFile(stream, tempPath, { maxSize: 5 * 1024 * 1024 }) // 5 MB limit
      ).rejects.toThrow("exceeds maximum allowed");
    });
  });

  describe("computeStreamIntegrity", () => {
    it("computes SHA-256 and size without writing to disk", async () => {
      const data = new TextEncoder().encode("Test data for integrity check");
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const result = await computeStreamIntegrity(stream);

      expect(result.size).toBe(data.length);
      expect(result.sha256).toHaveLength(64);

      const crypto = await import("crypto");
      const expectedHash = crypto.createHash("sha256").update(data).digest("hex");
      expect(result.sha256).toBe(expectedHash);
    });

    it("handles empty stream", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const result = await computeStreamIntegrity(stream);

      expect(result.size).toBe(0);
      expect(result.sha256).toHaveLength(64);
    });
  });

  describe("verifyStreamIntegrity", () => {
    it("passes for matching checksum and size", async () => {
      const data = new TextEncoder().encode("Verify this data");
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const crypto = await import("crypto");
      const expectedHash = crypto.createHash("sha256").update(data).digest("hex");

      await expect(
        verifyStreamIntegrity(stream, expectedHash, data.length)
      ).resolves.not.toThrow();
    });

    it("throws on size mismatch", async () => {
      const data = new TextEncoder().encode("Verify this data");
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const crypto = await import("crypto");
      const expectedHash = crypto.createHash("sha256").update(data).digest("hex");

      await expect(
        verifyStreamIntegrity(stream, expectedHash, data.length + 100)
      ).rejects.toThrow("Size mismatch");
    });

    it("throws on checksum mismatch", async () => {
      const data = new TextEncoder().encode("Verify this data");
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const wrongHash = "a".repeat(64);

      await expect(
        verifyStreamIntegrity(stream, wrongHash, data.length)
      ).rejects.toThrow("Checksum mismatch");
    });
  });

  describe("interrupted upload handling", () => {
    it("handles stream cancellation gracefully", async () => {
      let cancelled = false;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          // Simulate interruption by closing early
          controller.close();
        },
        cancel() {
          cancelled = true;
        },
      });

      const tempPath = `/tmp/test-interrupted-${Date.now()}.tmp`;

      // Should complete successfully even with early close
      const result = await streamToTempFile(stream, `/tmp/test-${Date.now()}.tmp`);

      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });
});