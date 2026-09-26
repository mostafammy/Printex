import { describe, it, expect, beforeEach } from "vitest";
import { attachments } from "@/server/files/attachments.js";
import { db as prisma } from "@/server/db.js";

function createReadable(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

describe("Attachment Authorization & Lifecycle (US4 - T034)", () => {
  let testUser: { id: string; name: string };

  beforeEach(async () => {
    const user = await prisma.user.findFirst();
    if (user) {
      testUser = { id: user.id, name: user.name ?? "Test User" };
    } else {
      testUser = { id: "test-actor-1", name: "Test Actor" };
    }
  });

  it("voids an attachment with required reason and audits before/after", async () => {
    const entityId = `entity-void-${Date.now()}`;
    const attachmentId = await attachments.attach({
      entityType: "discrepancy",
      entityId,
      stream: createReadable("Incorrect receipt attached"),
      fileName: "receipt.png",
      kind: "IMAGE",
      actor: { id: testUser.id } as any,
    });

    // Void without reason should fail
    await expect(
      attachments.void(attachmentId, { id: testUser.id } as any, "")
    ).rejects.toThrow();

    // Void with valid reason
    await attachments.void(
      attachmentId,
      { id: testUser.id } as any,
      "Duplicate receipt submitted by mistake"
    );

    const record = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { fileObject: true },
    });

    expect(record?.status).toBe("VOID");
    expect(record?.fileObject).toBeDefined(); // Bytes and metadata are preserved

    // Check audit event
    const auditRecord = await prisma.auditEvent.findFirst({
      where: { entityId: attachmentId, action: "VOID" },
    });
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.reason).toBe("Duplicate receipt submitted by mistake");
  });

  it("archives an attachment with required reason and preserves bytes", async () => {
    const entityId = `entity-archive-${Date.now()}`;
    const attachmentId = await attachments.attach({
      entityType: "expense",
      entityId,
      stream: createReadable("Monthly audited invoice"),
      fileName: "invoice.pdf",
      kind: "FILE",
      actor: { id: testUser.id } as any,
    });

    // Archive with reason
    await attachments.archive(
      attachmentId,
      { id: testUser.id } as any,
      "Fiscal year audit finalized"
    );

    const record = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { fileObject: true },
    });

    expect(record?.status).toBe("ARCHIVED");
    expect(record?.fileObject).toBeDefined();

    // Default list should exclude archived unless explicitly requested
    const listDefault = await attachments.list({
      entityType: "expense",
      entityId,
      includeArchived: false,
    });
    expect(listDefault).toHaveLength(0);

    const listArchived = await attachments.list({
      entityType: "expense",
      entityId,
      includeArchived: true,
    });
    expect(listArchived).toHaveLength(1);
    expect(listArchived[0]?.status).toBe("ARCHIVED");
  });
});
