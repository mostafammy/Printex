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

describe("Attachments Service Integration (US4 - T033)", () => {
  const targetTypes = ["rejection", "discrepancy", "expense", "audit_event", "message"];
  const kinds = ["VOICE_NOTE", "IMAGE", "FILE"] as const;

  let testUser: { id: string; name: string };

  beforeEach(async () => {
    // Ensure test user exists
    const user = await prisma.user.findFirst();
    if (user) {
      testUser = { id: user.id, name: user.name ?? "Test User" };
    } else {
      testUser = { id: "test-actor-1", name: "Test Actor" };
    }
  });

  for (const entityType of targetTypes) {
    for (const kind of kinds) {
      it(`attaches kind=${kind} to entityType=${entityType}`, async () => {
        const entityId = `entity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const fileName = kind === "VOICE_NOTE" ? "voice.wav" : kind === "IMAGE" ? "evidence.png" : "doc.pdf";

        const attachmentId = await attachments.attach({
          entityType,
          entityId,
          stream: createReadable(`Evidence for ${entityType} ${kind} ${Date.now()}`),
          fileName,
          kind,
          actor: { id: testUser.id } as any,
        });

        expect(attachmentId).toBeDefined();

        const list = await attachments.list({ entityType, entityId });
        expect(list).toHaveLength(1);
        expect(list[0]?.id).toBe(attachmentId);
        expect(list[0]?.entityType).toBe(entityType);
        expect(list[0]?.entityId).toBe(entityId);
        expect(list[0]?.originalName).toBe(fileName);
        expect(list[0]?.fileObject).toBeDefined();
        expect(list[0]?.fileObject?.sha256).toMatch(/^[0-9a-f]{64}$/);
      });
    }
  }

  it("deduplicates identical file object bytes across different attachments", async () => {
    const payload = `Shared identical evidence bytes ${Date.now()}`;
    const entityId1 = `entity-dedup-1-${Date.now()}`;
    const entityId2 = `entity-dedup-2-${Date.now()}`;

    const id1 = await attachments.attach({
      entityType: "rejection",
      entityId: entityId1,
      stream: createReadable(payload),
      fileName: "voice1.wav",
      kind: "VOICE_NOTE",
      actor: { id: testUser.id } as any,
    });

    const id2 = await attachments.attach({
      entityType: "expense",
      entityId: entityId2,
      stream: createReadable(payload),
      fileName: "voice2.wav",
      kind: "VOICE_NOTE",
      actor: { id: testUser.id } as any,
    });

    const list1 = await attachments.list({ entityType: "rejection", entityId: entityId1 });
    const list2 = await attachments.list({ entityType: "expense", entityId: entityId2 });

    expect(list1[0]?.id).toBe(id1);
    expect(list2[0]?.id).toBe(id2);
    expect(list1[0]?.fileObjectId).toBe(list2[0]?.fileObjectId);
    expect(list1[0]?.fileObject?.sha256).toBe(list2[0]?.fileObject?.sha256);
  });
});
