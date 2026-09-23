// Integration test for uploadDesignVersion/markDesignComplete — tasks.md
// T029, US4. Covers US4 Acceptance Scenarios 1-4.

import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { uploadDesignVersion, markDesignComplete, DomainDesignerError } from "~/server/designers";
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

let customerId: string;
let designerActor: Actor;

beforeAll(async () => {
  designerActor = {
    userId: unique("test-designer-upload"),
    roles: [],
    permissions: new Set<Permission>(["design.work"]),
    departmentIds: [],
  };
  await testDb.user.create({
    data: {
      id: designerActor.userId,
      name: "Test Designer",
      email: `${designerActor.userId}@local.invalid`,
      username: designerActor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedInDesignWorkItem(requiresReview: boolean) {
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: designerActor.userId,
    },
  });
  return testDb.workItem.create({
    data: {
      orderId: order.id,
      state: "IN_DESIGN",
      assigneeId: designerActor.userId,
      requiresReview,
    },
  });
}

describe("uploadDesignVersion (integration)", () => {
  it("creates version 1 then version 2 on a second upload, without changing state", async () => {
    const workItem = await seedInDesignWorkItem(true);

    const first = await uploadDesignVersion(
      designerActor,
      workItem.id,
      { stream: fileStream("first"), fileName: "logo-v1.png", mimeType: "image/png" },
      "first pass",
    );
    expect(first.version).toBe(1);

    const second = await uploadDesignVersion(
      designerActor,
      workItem.id,
      { stream: fileStream("second"), fileName: "logo-v2.png", mimeType: "image/png" },
      "updated logo size",
    );
    expect(second.version).toBe(2);

    const versions = await testDb.designVersion.findMany({
      where: { workItemId: workItem.id },
      orderBy: { version: "asc" },
    });
    expect(versions.map((v) => v.version)).toEqual([1, 2]);

    const reloaded = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloaded.state).toBe("IN_DESIGN");
  });

  it("throws NOT_ASSIGNEE for a user other than the assignee", async () => {
    const workItem = await seedInDesignWorkItem(true);
    const otherActor: Actor = {
      userId: unique("test-designer-other"),
      roles: [],
      permissions: new Set<Permission>(["design.work"]),
      departmentIds: [],
    };
    await testDb.user.create({
      data: {
        id: otherActor.userId,
        name: "Other Designer",
        email: `${otherActor.userId}@local.invalid`,
        username: otherActor.userId,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });

    await expect(
      uploadDesignVersion(otherActor, workItem.id, { stream: fileStream("x"), fileName: "x.png" }),
    ).rejects.toMatchObject({ code: "NOT_ASSIGNEE" });
  });

  it("throws NOT_IN_DESIGN when the Work Item isn't IN_DESIGN", async () => {
    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: designerActor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "ASSIGNED", assigneeId: designerActor.userId },
    });

    await expect(
      uploadDesignVersion(designerActor, workItem.id, { stream: fileStream("x"), fileName: "x.png" }),
    ).rejects.toMatchObject({ code: "NOT_IN_DESIGN" });
  });
});

describe("markDesignComplete (integration)", () => {
  it("throws NO_DESIGN_VERSION when no version has been uploaded", async () => {
    const workItem = await seedInDesignWorkItem(true);

    await expect(markDesignComplete(designerActor, workItem.id)).rejects.toBeInstanceOf(DomainDesignerError);
    await expect(markDesignComplete(designerActor, workItem.id)).rejects.toMatchObject({
      code: "NO_DESIGN_VERSION",
    });

    const reloaded = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloaded.state).toBe("IN_DESIGN");
  });

  it("routes to WAITING_REVIEW when requiresReview is true, producing two WorkItemTransition rows", async () => {
    const workItem = await seedInDesignWorkItem(true);
    await uploadDesignVersion(
      designerActor,
      workItem.id,
      { stream: fileStream("content"), fileName: "final.png" },
      "",
    );

    await markDesignComplete(designerActor, workItem.id);

    const reloaded = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloaded.state).toBe("WAITING_REVIEW");

    const transitions = await testDb.workItemTransition.findMany({
      where: { workItemId: workItem.id },
      orderBy: { at: "asc" },
    });
    expect(transitions).toHaveLength(2);
    expect(transitions[0]).toMatchObject({ from: "IN_DESIGN", to: "DESIGN_COMPLETED" });
    expect(transitions[1]).toMatchObject({ from: "DESIGN_COMPLETED", to: "WAITING_REVIEW" });
  });

  it("routes to APPROVED when requiresReview is false, and closes any open ACTIVE segment", async () => {
    const workItem = await seedInDesignWorkItem(false);
    await uploadDesignVersion(
      designerActor,
      workItem.id,
      { stream: fileStream("content"), fileName: "final.png" },
      "",
    );
    await testDb.phaseTiming.create({
      data: {
        workItemId: workItem.id,
        phase: "IN_DESIGN",
        kind: "ACTIVE",
        userId: designerActor.userId,
        startedAt: new Date(Date.now() - 60_000),
        endedAt: null,
      },
    });

    await markDesignComplete(designerActor, workItem.id);

    const reloaded = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloaded.state).toBe("APPROVED");

    const openSegments = await testDb.phaseTiming.findMany({
      where: { workItemId: workItem.id, kind: "ACTIVE", endedAt: null },
    });
    expect(openSegments).toHaveLength(0);

    const transitions = await testDb.workItemTransition.findMany({
      where: { workItemId: workItem.id },
      orderBy: { at: "asc" },
    });
    expect(transitions.map((t) => t.to)).toEqual(["DESIGN_COMPLETED", "APPROVED"]);
  });
});
