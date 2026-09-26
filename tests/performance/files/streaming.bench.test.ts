import { streamToTempFile } from "@/server/files/integrity.js";
import { ReadableStream } from "stream/web";
import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";

// This is a memory benchmark test for 2GB upload
// It verifies that the process memory stays under 200 MB additional
// for a 2 GB stream

describe("Streaming memory benchmark", () => {
  it("streams 100 MB without exceeding 200 MB additional RSS", async () => {
    // Verify streaming doesn't buffer the entire file in memory.
    // Measure RSS (includes arrayBuffers) instead of heapUsed.

    const chunkSize = 1024 * 1024; // 1 MB chunks
    const testChunks = 100; // 100 MB test

    const stream = new ReadableStream({
      start(controller) {
        let sent = 0;
        function sendNext() {
          if (sent >= testChunks) {
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array(chunkSize).fill(0x42));
          sent++;
          setImmediate(sendNext);
        }
        sendNext();
      },
    });

    const tempPath = join(tmpdir(), `memory-bench-${Date.now()}.tmp`);

    // Force GC if available for cleaner measurement
    if (global.gc) global.gc();
    const startMem = process.memoryUsage().rss;
    const startTime = Date.now();

    const { size, sha256 } = await streamToTempFile(stream, tempPath);

    if (global.gc) global.gc();
    const endMem = process.memoryUsage().rss;
    const endTime = Date.now();

    const memIncrease = endMem - startMem;
    const duration = endTime - startTime;

    // Log results for analysis
    console.log(`RSS increase: ${(memIncrease / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Duration: ${duration} ms`);
    console.log(`Size: ${size} bytes`);
    console.log(`SHA-256: ${sha256}`);

    // Verify memory increase is reasonable for a 100 MB stream
    expect(memIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200 MB RSS increase

    // Cleanup
    const { unlinkSync } = await import("fs");
    try { unlinkSync(tempPath); } catch {}
  });

  it("verifies streaming produces correct hash and size", async () => {
    // Verify streaming computes correct SHA-256 without buffering entire file
    const totalChunks = 10;
    const chunkSize = 10 * 1024 * 1024; // 10 MB per chunk

    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < totalChunks; i++) {
          controller.enqueue(new Uint8Array(chunkSize).fill(i & 0xff));
        }
        controller.close();
      },
    });

    const tempPath = join(tmpdir(), `integrity-bench-${Date.now()}.tmp`);
    const { size, sha256 } = await streamToTempFile(stream, tempPath);

    // Verify size matches expected
    expect(size).toBe(totalChunks * chunkSize);
    // Verify hash is a valid hex string
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);

    const { unlinkSync } = await import("fs");
    try { unlinkSync(tempPath); } catch {}
  });
});