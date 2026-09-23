// Integration test for rejectDesign's attachment handling — tasks.md T021,
// US3. spec.md US3 Acceptance Scenario 4: reject with a voice-note-kind and
// an image-kind attachment; assert two ReturnAttachment rows exist, each
// with correct kind/storageKey/fileName, both referencing the created
// Return.

import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { rejectDesign } from "~/server/review/review";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

function fileStream(content: string): NodeJS.ReadableStream {
  return Readable.from([Buffer.from(content)]);
}

async function createActor(permissions: Permission[]): Promise<Actor> {
  const actor: Actor = {
    userId: unique("test-rejectattach-actor"),
    roles: [],
    permissions: new Set<Permission>(permissions),
    departmentIds: [],
  };
  await testDb.user.create({
    data: {
      id: actor.userId,
      name: actor.userId,
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  return actor;
}

let customerId: string;
let departmentId: string;

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  const department = await testDb.department.create({ data: { name: unique("Department") } });
  departmentId = department.id;
});

describe("rejectDesign attachments (integration)", () => {
  it("creates one ReturnAttachment row per attachment, correctly kinded and referencing the Return", async () => {
    const assignee = await createActor(["design.work"]);
    const reviewer = await createActor(["design.review"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: assignee.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "WAITING_REVIEW", assigneeId: assignee.userId },
    });
    await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: `test/${workItem.id}/1`,
        fileName: "v1.png",
        sizeBytes: 10,
        sha256: "v1hash",
        uploadedById: assignee.userId,
      },
    });

    const { returnId } = await rejectDesign(reviewer, workItem.id, {
      category: "DESIGN_ISSUE",
      originDepartmentId: departmentId,
      explanation: "Please redo the layout, see attached notes.",
      attachments: [
        { kind: "VOICE_NOTE", fileName: "note.m4a", mimeType: "audio/m4a", stream: fileStream("voice-bytes") },
        { kind: "IMAGE", fileName: "reference.png", mimeType: "image/png", stream: fileStream("image-bytes") },
      ],
    });

    const attachments = await testDb.returnAttachment.findMany({
      where: { returnId },
      orderBy: { kind: "asc" },
    });

    expect(attachments).toHaveLength(2);

    const image = attachments.find((a) => a.kind === "IMAGE");
    expect(image).toBeDefined();
    expect(image?.fileName).toBe("reference.png");
    expect(image?.mimeType).toBe("image/png");
    expect(typeof image?.storageKey).toBe("string");
    expect(image?.storageKey.length).toBeGreaterThan(0);
    expect(image?.returnId).toBe(returnId);

    const voiceNote = attachments.find((a) => a.kind === "VOICE_NOTE");
    expect(voiceNote).toBeDefined();
    expect(voiceNote?.fileName).toBe("note.m4a");
    expect(voiceNote?.mimeType).toBe("audio/m4a");
    expect(voiceNote?.returnId).toBe(returnId);
  });

  it("submits successfully with zero attachments — the abandoned-voice-note edge case (spec.md Edge Cases)", async () => {
    const assignee = await createActor(["design.work"]);
    const reviewer = await createActor(["design.review"]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: assignee.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "WAITING_REVIEW", assigneeId: assignee.userId },
    });
    await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: `test/${workItem.id}/1`,
        fileName: "v1.png",
        sizeBytes: 10,
        sha256: "v1hash",
        uploadedById: assignee.userId,
      },
    });

    const { returnId } = await rejectDesign(reviewer, workItem.id, {
      category: "DESIGN_ISSUE",
      originDepartmentId: departmentId,
      explanation: "Category and explanation alone are enough.",
    });

    const attachments = await testDb.returnAttachment.findMany({ where: { returnId } });
    expect(attachments).toHaveLength(0);
  });
});
