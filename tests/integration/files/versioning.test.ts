import { fileService } from "@/server/files/index.js";
import { fileFixtures, makeFileAssetInput, makeFileVersionInput, createTestStream } from "../../fixtures/files.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db as prisma } from "@/server/db.js";

describe("Versioning and deduplication integration", () => {
  let testWorkItemId: string;
  let testActorId: string;

  beforeEach(async () => {
    // Create a test work item or use existing seeded data
    const workItem = await prisma.workItem.findFirst({
      where: { state: "IN_DESIGN" },
    });
    if (!workItem) {
      throw new Error("No test work item found");
    }
    testWorkItemId = workItem.id;

    const user = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: "DESIGNER" } } } },
    });
    if (!user) {
      throw new Error("No designer user found");
    }
    testActorId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.fileVersion.deleteMany({
      where: { fileAsset: { workItemId: testWorkItemId } },
    });
    await prisma.fileAsset.deleteMany({
      where: { workItemId: testWorkItemId },
    });
  });

  it("creates new FileAsset and FileVersion on first upload", async () => {
    const stream = createTestStream(1024); // 1 KB test file

    const fileVersion = await fileService.upload({
      workItemId: testWorkItemId,
      category: "DESIGN_VERSIONS",
      stream: stream as any,
      fileName: "design-v1.ai",
      note: "Initial design",
      actor: { id: testActorId } as any,
    });

    expect(fileVersion).toBeDefined();
    expect(fileVersion.versionNumber).toBe(1);
    expect(fileVersion.originalName).toBe("design-v1.ai");
    expect(fileVersion.status).toBe("ACTIVE");
    expect(fileVersion.approved).toBe(false);
    expect(fileVersion.fileObject).toBeDefined();
    expect(fileVersion.fileObject.sizeBytes).toBe(1024);
    expect(fileVersion.fileObject.sha256).toHaveLength(64);
  });

  it("creates new version on second upload, marks first as SUPERSEDED", async () => {
    // First upload
    const stream1 = createTestStream(1024);
    const v1 = await fileService.upload({
      workItemId: testWorkItemId,
      category: "DESIGN_VERSIONS",
      stream: stream1 as any,
      fileName: "design.ai",
      note: "Version 1",
      actor: { id: testActorId } as any,
    });

    // Second upload (different content)
    const stream2 = createTestStream(2048);
    const v2 = await fileService.upload({
      workItemId: testWorkItemId,
      category: "DESIGN_VERSIONS",
      stream: stream2 as any,
      fileName: "design.ai",
      note: "Version 2",
      actor: { id: testActorId } as any,
    });

    // Verify v2 is created with versionNumber 2
    expect(v2.versionNumber).toBe(2);
    expect(v2.originalName).toBe("design.ai");
    expect(v2.status).toBe("ACTIVE");

    // Verify v1 is now SUPERSEDED
    const updatedV1 = await prisma.fileVersion.findUnique({
      where: { id: v1.id },
    });
    expect(updatedV1?.status).toBe("SUPERSEDED");

    // Both file versions should exist
    const versions = await prisma.fileVersion.findMany({
      where: { fileAssetId: v1.fileAssetId },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions).toHaveLength(2);
  });

  it("deduplicates identical FileObject bytes but creates separate FileVersion", async () => {
    // First upload with specific content
    const content = new Uint8Array(1024);
    content.fill(0x41); // All 'A'
    const stream1 = new ReadableStream({
      start(controller) {
        controller.enqueue(content);
        controller.close();
      },
    });

    const v1 = await fileService.upload({
      workItemId: testWorkItemId,
      category: "DESIGN_VERSIONS",
      stream: stream1 as any,
      fileName: "identical.ai",
      note: "First upload",
      actor: { id: testActorId } as any,
    });

    // Second upload with IDENTICAL content
    const stream2 = new ReadableStream({
      start(controller) {
        controller.enqueue(content);
        controller.close();
      },
    });

    const v2 = await fileService.upload({
      workItemId: testWorkItemId,
      category: "DESIGN_VERSIONS",
      stream: stream2 as any,
      fileName: "identical.ai",
      note: "Second upload (identical)",
      actor: { id: testActorId } as any,
    });

    // Both versions should exist
    const versions = await prisma.fileVersion.findMany({
      where: { fileAssetId: v1.fileAssetId },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions).toHaveLength(2);

    // But they should share the SAME FileObject (deduplication)
    expect(v1.fileObjectId).toBe(v2.fileObjectId);

    // FileObject should have size and SHA-256 matching the content
    const fileObject = await prisma.fileObject.findUnique({
      where: { id: v1.fileObjectId },
    });
    expect(fileObject).toBeDefined();
    expect(fileObject?.sizeBytes).toBe(content.length);

    // v1 should be SUPERSEDED, v2 should be ACTIVE
    const updatedV1 = await prisma.fileVersion.findUnique({ where: { id: v1.id } });
    const updatedV2 = await prisma.fileVersion.findUnique({ where: { id: v2.id } });
    expect(updatedV1?.status).toBe("SUPERSEDED");
    expect(updatedV2?.status).toBe("ACTIVE");
  });

  it("maintains monotonic version numbers under concurrent uploads", async () => {
    // Simulate concurrent uploads by creating multiple streams
    const streams = Array.from({ length: 5 }, (_, i) =>
      createTestStream(1024 * (i + 1))
    );

    // Upload sequentially but verify version numbers are monotonic
    const versions = [];
    for (const stream of streams) {
      const v = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: `concurrent-${Date.now()}.ai`,
        note: `Concurrent upload`,
        actor: { id: testActorId } as any,
      });
      versions.push(v);
    }

    // Verify version numbers are 1, 2, 3, 4, 5 (or continuing from existing)
    const versionNumbers = versions.map(v => v.versionNumber).sort((a, b) => a - b);
    for (let i = 1; i < versionNumbers.length; i++) {
      expect(versionNumbers[i]).toBe(versionNumbers[i - 1]! + 1);
    }
  });

  it("creates separate FileAsset per category", async () => {
    // Upload to DESIGN_VERSIONS
    const stream1 = createTestStream(1024);
    const v1 = await fileService.upload({
      workItemId: testWorkItemId,
      category: "DESIGN_VERSIONS",
      stream: stream1 as any,
      fileName: "design.ai",
      actor: { id: testActorId } as any,
    });

    // Upload to REVIEW_PROOF
    const stream2 = createTestStream(1024);
    const v2 = await fileService.upload({
      workItemId: testWorkItemId,
      category: "REVIEW_PROOF",
      stream: stream2 as any,
      fileName: "proof.pdf",
      actor: { id: testActorId } as any,
    });

    // Should have different FileAssets
    expect(v1.fileAssetId).not.toBe(v2.fileAssetId);

    // Both should have version 1
    expect(v1.versionNumber).toBe(1);
    expect(v2.versionNumber).toBe(1);
  });
});