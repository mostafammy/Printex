// Contract tests for src/server/designers/** —
// specs/012-designer-assignment-timers/contracts/designer-assignment.md.
//
// This file is populated incrementally as each user story lands (matching
// src/server/designers/index.ts's own barrel growth). Currently covers
// User Story 4 (`uploadDesignVersion`/`markDesignComplete` — tasks.md T030):
// Authorization table row `design.work` + assignee-only, and the frozen
// return shape of `uploadDesignVersion`.

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
let noPermissionActor: Actor;

beforeAll(async () => {
  designerActor = {
    userId: unique("test-contract-designer"),
    roles: [],
    permissions: new Set<Permission>(["design.work"]),
    departmentIds: [],
  };
  noPermissionActor = {
    userId: unique("test-contract-no-permission"),
    roles: [],
    permissions: new Set<Permission>(),
    departmentIds: [],
  };

  await testDb.user.createMany({
    data: [designerActor, noPermissionActor].map((a) => ({
      id: a.userId,
      name: a.userId,
      email: `${a.userId}@local.invalid`,
      username: a.userId,
      isActive: true,
      failedLoginAttempts: 0,
    })),
  });

  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedInDesignWorkItem() {
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
      requiresReview: true,
    },
  });
}

describe("uploadDesignVersion (contract)", () => {
  it("requires design.work — FORBIDDEN without it", async () => {
    const workItem = await seedInDesignWorkItem();

    await expect(
      uploadDesignVersion(noPermissionActor, workItem.id, {
        stream: fileStream("x"),
        fileName: "x.png",
      }),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("returns { designVersionId, version } matching the frozen shape", async () => {
    const workItem = await seedInDesignWorkItem();

    const result = await uploadDesignVersion(
      designerActor,
      workItem.id,
      { stream: fileStream("content"), fileName: "design.png", mimeType: "image/png" },
      "a note",
    );

    expect(typeof result.designVersionId).toBe("string");
    expect(result.version).toBe(1);
  });

  it("NOT_ASSIGNEE / NOT_IN_DESIGN are DomainDesignerError instances", async () => {
    const workItem = await seedInDesignWorkItem();
    const otherActor: Actor = {
      userId: unique("test-contract-other-designer"),
      roles: [],
      permissions: new Set<Permission>(["design.work"]),
      departmentIds: [],
    };
    await testDb.user.create({
      data: {
        id: otherActor.userId,
        name: otherActor.userId,
        email: `${otherActor.userId}@local.invalid`,
        username: otherActor.userId,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });

    await expect(
      uploadDesignVersion(otherActor, workItem.id, { stream: fileStream("x"), fileName: "x.png" }),
    ).rejects.toBeInstanceOf(DomainDesignerError);
  });
});

describe("markDesignComplete (contract)", () => {
  it("requires design.work — FORBIDDEN without it", async () => {
    const workItem = await seedInDesignWorkItem();

    await expect(markDesignComplete(noPermissionActor, workItem.id)).rejects.toMatchObject({
      name: "ForbiddenError",
    });
  });

  it("requires >=1 DesignVersion — NO_DESIGN_VERSION otherwise", async () => {
    const workItem = await seedInDesignWorkItem();

    await expect(markDesignComplete(designerActor, workItem.id)).rejects.toMatchObject({
      code: "NO_DESIGN_VERSION",
    });
  });

  it("requires assigneeId === actor.userId — NOT_ASSIGNEE otherwise", async () => {
    const workItem = await seedInDesignWorkItem();
    await uploadDesignVersion(designerActor, workItem.id, { stream: fileStream("x"), fileName: "x.png" });

    const otherActor: Actor = {
      userId: unique("test-contract-other-designer-2"),
      roles: [],
      permissions: new Set<Permission>(["design.work"]),
      departmentIds: [],
    };
    await testDb.user.create({
      data: {
        id: otherActor.userId,
        name: otherActor.userId,
        email: `${otherActor.userId}@local.invalid`,
        username: otherActor.userId,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });

    await expect(markDesignComplete(otherActor, workItem.id)).rejects.toMatchObject({
      code: "NOT_ASSIGNEE",
    });
  });
});
