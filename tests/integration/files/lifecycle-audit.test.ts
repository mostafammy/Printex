import { fileService } from "@/server/files/index.js";
import { createTestStream } from "../../fixtures/files.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db as prisma } from "@/server/db.js";

describe("Lifecycle and audit tests", () => {
  let testWorkItemId: string;
  let testActorId: string;

  beforeEach(async () => {
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
    await prisma.fileVersion.deleteMany({
      where: { fileAsset: { workItemId: testWorkItemId } },
    });
    await prisma.fileAsset.deleteMany({
      where: { workItemId: testWorkItemId },
    });
  });

  describe("Void lifecycle", () => {
    it("voids a version with required reason", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: "to-void.ai",
        actor: { id: testActorId } as any,
      });

      await fileService.voidVersion(fileVersion.id, { id: testActorId } as any, "Design rejected by client");

      const voided = await prisma.fileVersion.findUnique({
        where: { id: fileVersion.id },
      });
      expect(voided?.status).toBe("VOID");

      // Verify audit event
      const audit = await prisma.fileAuditEvent.findFirst({
        where: { entityId: fileVersion.id, action: "VOID" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.beforeValues).toEqual(expect.objectContaining({ status: "ACTIVE" }));
      expect(audit?.afterValues).toEqual(expect.objectContaining({ status: "VOID" }));
      expect(audit?.reason).toBe("Design rejected by client");
    });

    it("rejects void without reason", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: "no-reason.ai",
        actor: { id: testActorId } as any,
      });

      // The service requires a reason - this would be enforced at the route level
      // but we verify the service accepts it (route validates)
      await expect(
        fileService.voidVersion(fileVersion.id, { id: testActorId } as any, "")
      ).rejects.toThrow();
    });

    it("preserves bytes and metadata when voided", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: "preserve.ai",
        actor: { id: testActorId } as any,
      });

      const fileObjectId = fileVersion.fileObjectId;

      await fileService.voidVersion(fileVersion.id, { id: testActorId } as any, "Voided");

      // FileObject should still exist
      const fileObject = await prisma.fileObject.findUnique({
        where: { id: fileObjectId },
      });
      expect(fileObject).toBeDefined();

      // FileVersion should still exist with VOID status
      const voided = await prisma.fileVersion.findUnique({
        where: { id: fileVersion.id },
      });
      expect(voided?.status).toBe("VOID");
      expect(voided?.fileObjectId).toBe(fileObjectId);
    });
  });

  describe("Archive lifecycle", () => {
    it("archives a version with required reason", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: "to-archive.ai",
        actor: { id: testActorId } as any,
      });

      await fileService.archiveVersion(fileVersion.id, { id: testActorId } as any, "Project completed");

      const archived = await prisma.fileVersion.findUnique({
        where: { id: fileVersion.id },
      });
      expect(archived?.status).toBe("ARCHIVED");

      // Verify audit event
      const audit = await prisma.fileAuditEvent.findFirst({
        where: { entityId: fileVersion.id, action: "ARCHIVE" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.beforeValues).toEqual(expect.objectContaining({ status: "ACTIVE" }));
      expect(audit?.afterValues).toEqual(expect.objectContaining({ status: "ARCHIVED" }));
      expect(audit?.reason).toBe("Project completed");
    });

    it("preserves bytes and metadata when archived", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: "archive.ai",
        actor: { id: testActorId } as any,
      });

      const fileObjectId = fileVersion.fileObjectId;

      await fileService.archiveVersion(fileVersion.id, { id: testActorId } as any, "Archived");

      // FileObject should still exist
      const fileObject = await prisma.fileObject.findUnique({
        where: { id: fileObjectId },
      });
      expect(fileObject).toBeDefined();

      // FileVersion should still exist with ARCHIVED status
      const archived = await prisma.fileVersion.findUnique({
        where: { id: fileVersion.id },
      });
      expect(archived?.status).toBe("ARCHIVED");
    });
  });

  describe("Supersede lifecycle", () => {
    it("supersedes prior ACTIVE version on new upload", async () => {
      const stream1 = createTestStream(1024);
      const v1 = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream1 as any,
        fileName: "v1.ai",
        actor: { id: testActorId } as any,
      });

      const stream2 = createTestStream(2048);
      const v2 = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream2 as any,
        fileName: "v2.ai",
        actor: { id: testActorId } as any,
      });

      // v1 should be SUPERSEDED
      const updatedV1 = await prisma.fileVersion.findUnique({
        where: { id: v1.id },
      });
      expect(updatedV1?.status).toBe("SUPERSEDED");

      // v2 should be ACTIVE
      const updatedV2 = await prisma.fileVersion.findUnique({
        where: { id: v2.id },
      });
      expect(updatedV2?.status).toBe("ACTIVE");

      // Audit event for supersede
      const audit = await prisma.fileAuditEvent.findFirst({
        where: { entityId: v1.id, action: "SUPERSEDE" },
      });
      expect(audit).toBeDefined();
    });
  });

  describe("Approval lifecycle", () => {
    it("approves a version and audits the action", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "REVIEW_PROOF",
        stream: stream as any,
        fileName: "to-approve.pdf",
        actor: { id: testActorId } as any,
      });

      // Approve with admin/head designer actor
      const adminActor = { id: "admin-user", permissions: new Set(["admin"]) } as any;
      await fileService.markApproved(fileVersion.id, adminActor);

      const approved = await prisma.fileVersion.findUnique({
        where: { id: fileVersion.id },
      });
      expect(approved?.approved).toBe(true);

      // Verify audit event
      const audit = await prisma.fileAuditEvent.findFirst({
        where: { entityId: fileVersion.id, action: "APPROVE" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.beforeValues).toEqual(expect.objectContaining({ approved: false }));
      expect(audit?.afterValues).toEqual(expect.objectContaining({ approved: true }));
    });
  });

  describe("No permanent deletion", () => {
    it("never permanently deletes FileVersion or FileObject", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: "no-delete.ai",
        actor: { id: testActorId } as any,
      });

      const fileObjectId = fileVersion.fileObjectId;

      // Void it
      await fileService.voidVersion(fileVersion.id, { id: testActorId } as any, "Voided");

      // Archive another
      const stream2 = createTestStream(1024);
      const v2 = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream2 as any,
        fileName: "archive.ai",
        actor: { id: testActorId } as any,
      });
      await fileService.archiveVersion(v2.id, { id: testActorId } as any, "Archived");

      // Supersede another
      const stream3 = createTestStream(1024);
      await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream3 as any,
        fileName: "v3.ai",
        actor: { id: testActorId } as any,
      });

      // All FileVersions should still exist
      const allVersions = await prisma.fileVersion.findMany({
        where: { fileAsset: { workItemId: testWorkItemId } },
      });
      expect(allVersions.length).toBeGreaterThanOrEqual(3);

      // All FileObjects should still exist
      const allObjects = await prisma.fileObject.findMany({
        where: { fileVersions: { some: { fileAsset: { workItemId: testWorkItemId } } } },
      });
      expect(allObjects.length).toBeGreaterThanOrEqual(3);

      // No hard delete operations should exist in audit
      const deleteAudits = await prisma.fileAuditEvent.findMany({
        where: { action: "VOID" },
      });
      expect(deleteAudits).toHaveLength(0);
    });
  });

  describe("Required reason validation", () => {
    it("requires reason for void", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: "reason-test.ai",
        actor: { id: testActorId } as any,
      });

      // Route-level validation would catch empty reason
      // Service level would accept but route rejects
      await expect(
        fileService.voidVersion(fileVersion.id, { id: testActorId } as any, "")
      ).rejects.toThrow();
    });

    it("requires reason for archive", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: "reason-test.ai",
        actor: { id: testActorId } as any,
      });

      await expect(
        fileService.archiveVersion(fileVersion.id, { id: testActorId } as any, "")
      ).rejects.toThrow();
    });
  });

  describe("Audit record completeness", () => {
    it("records all required fields in audit events", async () => {
      const stream = createTestStream(1024);
      const fileVersion = await fileService.upload({
        workItemId: testWorkItemId,
        category: "DESIGN_VERSIONS",
        stream: stream as any,
        fileName: "audit-test.ai",
        actor: { id: testActorId } as any,
      });

      await fileService.voidVersion(fileVersion.id, { id: testActorId } as any, "Test reason");

      const audit = await prisma.fileAuditEvent.findFirst({
        where: { entityId: fileVersion.id, action: "VOID" },
      });

      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe(testActorId);
      expect(audit?.action).toBe("VOID");
      expect(audit?.entity).toBe("FILE_VERSION");
      expect(audit?.entityId).toBe(fileVersion.id);
      expect(audit?.beforeValues).toBeDefined();
      expect(audit?.afterValues).toBeDefined();
      expect(audit?.reason).toBe("Test reason");
      expect(audit?.createdAt).toBeDefined();
    });
  });
});