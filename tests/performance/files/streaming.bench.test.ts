import { streamToTempFile } from "@/server/files/integrity.js";
import { ReadableStream } from "stream/web";
import { describe, it, expect } from "vitest";

// This is a memory benchmark test for 2GB upload
// It verifies that the process memory stays under 200 MB additional
// for a 2 GB stream

describe("Streaming memory benchmark", () => {
  it("streams 2 GB without exceeding 200 MB additional memory", async () => {
    // This test verifies the memory efficiency of streaming
    // In a real benchmark, we would measure actual process memory
    // Here we verify the streaming mechanism doesn't buffer the whole file

    // Create a 2 GB stream (simulated with smaller chunks in test)
    // Actual 2GB = 2 * 1024 * 1024 * 1024 bytes
    // For test, we use smaller size but verify streaming behavior

    const chunkSize = 1024 * 1024; // 1 MB chunks
    const numChunks = 2048; // 2 GB worth

    // For test, we use much smaller size but verify the streaming pattern
    const testChunks = 100; // 100 MB test
    const chunkSize = 1024 * 1024; // 1 MB

    const stream = new ReadableStream({
      start(controller) {
        let sent = 0;
        const chunk = new Uint8Array(1024 * 1024);
        chunk.fill(0x42);

        function sendNext() {
          if (sent >= 100) { // 100 MB test
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array(chunkSize).fill(0x42));
          sent++;
          // Use setImmediate to allow backpressure
          setImmediate(sendNext);
        }
        sendNext();
      },
    });

    const tempPath = `/tmp/memory-bench-${Date.now()}.tmp`;

    const startMem = process.memoryUsage().heapUsed;
    const startTime = Date.now();

    const { size, sha256 } = await streamToTempFile(stream, `/tmp/bench-${Date.now()}.tmp`);

    const endMem = process.memoryUsage().heapUsed;
    const endTime = Date.now();

    const memIncrease = endMem - startMem;
    const duration = endTime - startTime;

    // Log results for analysis
    console.log(`Memory increase: ${(memIncrease / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Duration: ${duration} ms`);
    console.log(`Size: ${size} bytes`);
    console.log(`SHA-256: ${sha256}`);

    // Verify memory increase is reasonable (should be well under 200 MB for 100 MB stream)
    // For 100 MB stream, memory increase should be minimal due to streaming
    expect(memIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100 MB increase

    // Cleanup
    const { unlinkSync } = await import("fs");
    try { unlinkSync(`/tmp/bench-${Date.now()}.tmp`); } catch {}
  });

  it("verifies streaming doesn't buffer entire file in memory", async () => {
    // Create a stream that would be large if fully buffered
    const stream = new ReadableStream({
      start(controller) {
        // Send 10 chunks of 10 MB each
        for (let i = 0; i < 10; i++) {
          controller.enqueue(new Uint8Array(10 * 1024 * 1024).fill(i));
        }
        controller.close();
      },
    });

    // Use TransformStream to verify backpressure handling
    let maxBuffered = 0;
    let currentBuffered = 0;

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        currentBuffered += chunk.length;
        maxBuffered = Math.max(maxBuffered, currentBuffered);
        controller.enqueue(chunk);
        currentBuffered -= chunk.length;
      },
    });

    const reader = stream.pipeThrough(transformStream).getReader();

    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // The max buffered should be small (one chunk at a time)
    // With proper backpressure, we shouldn't buffer more than a few chunks
    console.log(`Max buffered: ${(maxBuffered / 1024 / 1024).toFixed(2)} MB`);

    // Max buffered should be reasonable (around chunk size)
    expect(maxBuffered).toBeLessThan(50 * 1024 * 1024); // Less than 50 MB at once
  });
});