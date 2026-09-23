// Contract tests for src/server/designers/** —
// specs/012-designer-assignment-timers/contracts/designer-assignment.md.
//
// Populated incrementally as each user story lands (matching
// src/server/designers/index.ts's own barrel growth). Currently covers:
// - User Story 1 (getEligibleDesigners/assignDesigner initial — T010)
// - User Story 2 (assignDesigner reassignment — T016)
// - User Story 3 (getMyQueue/startTimer/pauseTimer/phaseDurations — T021)
// - User Story 4 (uploadDesignVersion/markDesignComplete — T030)
// The remaining Authorization-table row (getDesignerWorkload) belongs to
// Polish and is covered by its own test file.

import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  getEligibleDesigners,
  assignDesigner,
  getMyQueue,
  startTimer,
  pauseTimer,
  phaseDurations,
  uploadDesignVersion,
  markDesignComplete,
  getDesignerWorkload,
  DomainDesignerError,
} from "~/server/designers";
import { ForbiddenError } from "~/server/auth/authorize";
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
    userId: unique("test-contract-actor"),
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
  // getEligibleDesigners/getDesignerWorkload resolve design.work holders from
  // the DB, not from the in-memory Actor — persist the grants too.
  if (permissions.length > 0) {
    await testDb.userPermission.createMany({
      data: permissions.map((permission) => ({ userId: actor.userId, permission, grantedById: actor.userId })),
    });
  }
  return actor;
}

let customerId: string;
let designerActor: Actor;
let noPermissionActor: Actor;

beforeAll(async () => {
  designerActor = await createActor(["design.work"]);
  noPermissionActor = await createActor([]);

  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedAssignedWorkItem(assigneeId: string) {
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "URGENT",
      mode: "SEPARATE",
      createdById: assigneeId,
    },
  });
  const workItem = await testDb.workItem.create({
    data: { orderId: order.id, state: "ASSIGNED", assigneeId },
  });
  await testDb.phaseTiming.create({
    data: { workItemId: workItem.id, phase: "ASSIGNED", kind: "QUEUE", startedAt: new Date() },
  });
  return { orderId: order.id, workItemId: workItem.id };
}

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

describe("designer-assignment contract: getMyQueue", () => {
  it("requires no permission beyond an authenticated actor, and scopes rows to actor.userId", async () => {
    const { workItemId } = await seedAssignedWorkItem(designerActor.userId);

    // No permission at all — still resolves, because getMyQueue has no
    // authorize() gate (contracts/designer-assignment.md's Authorization
    // table: "none (authenticated only)").
    const rows = await getMyQueue(noPermissionActor);
    expect(rows.find((r) => r.workItemId === workItemId)).toBeUndefined();

    const ownRows = await getMyQueue(designerActor);
    const row = ownRows.find((r) => r.workItemId === workItemId);
    expect(row).toBeDefined();
    expect(row?.state).toBe("ASSIGNED");
    expect(row?.isRework).toBe(false);
    expect(row?.rejectionDetails).toBeNull();
    expect(row?.hasOpenTimer).toBe(false);
    expect(row?.priority).toBe("URGENT");
  });
});

describe("designer-assignment contract: startTimer / pauseTimer", () => {
  it("requires design.work — FORBIDDEN without it", async () => {
    const { workItemId } = await seedAssignedWorkItem(noPermissionActor.userId);

    await expect(startTimer(noPermissionActor, workItemId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(pauseTimer(noPermissionActor, workItemId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("succeeds for the assignee holding design.work", async () => {
    const { workItemId } = await seedAssignedWorkItem(designerActor.userId);

    await expect(startTimer(designerActor, workItemId)).resolves.toBeUndefined();
    await expect(pauseTimer(designerActor, workItemId)).resolves.toBeUndefined();
  });
});

describe("designer-assignment contract: phaseDurations", () => {
  it("requires no permission beyond an authenticated actor, and matches the frozen PhaseDurations shape", async () => {
    const { workItemId } = await seedAssignedWorkItem(designerActor.userId);

    const durations = await phaseDurations(noPermissionActor, workItemId);
    expect(durations).toEqual(
      expect.objectContaining({
        queueTimeMs: expect.any(Number),
        activeTimeMs: expect.any(Number),
        totalPhaseDurationMs: null,
      }),
    );
  });
});

describe("designer-assignment contract: uploadDesignVersion", () => {
  it("requires design.work — FORBIDDEN without it", async () => {
    const workItem = await seedInDesignWorkItem();

    await expect(
      uploadDesignVersion(noPermissionActor, workItem.id, {
        stream: fileStream("x"),
        fileName: "x.png",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
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

  it("NOT_ASSIGNEE is a DomainDesignerError instance", async () => {
    const workItem = await seedInDesignWorkItem();
    const otherActor = await createActor(["design.work"]);

    await expect(
      uploadDesignVersion(otherActor, workItem.id, { stream: fileStream("x"), fileName: "x.png" }),
    ).rejects.toBeInstanceOf(DomainDesignerError);
  });
});

describe("designer-assignment contract: markDesignComplete", () => {
  it("requires design.work — FORBIDDEN without it", async () => {
    const workItem = await seedInDesignWorkItem();

    await expect(markDesignComplete(noPermissionActor, workItem.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
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

    const otherActor = await createActor(["design.work"]);

    await expect(markDesignComplete(otherActor, workItem.id)).rejects.toMatchObject({
      code: "NOT_ASSIGNEE",
    });
  });
});

async function seedWorkItem(state: "NEW" | "ASSIGNED" = "NEW", assigneeId?: string) {
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: designerActor.userId,
    },
  });
  return testDb.workItem.create({ data: { orderId: order.id, state, assigneeId } });
}

describe("designer-assignment contract: getEligibleDesigners / assignDesigner", () => {
  it("getEligibleDesigners requires workitem.assign_designer (FORBIDDEN without it)", async () => {
    const actor = await createActor([]);
    const workItem = await seedWorkItem();

    await expect(getEligibleDesigners(actor, workItem.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("getEligibleDesigners succeeds for a holder of workitem.assign_designer and matches the frozen EligibleDesigner shape", async () => {
    const actor = await createActor(["workitem.assign_designer"]);
    const designer = await createActor(["design.work"]);
    const workItem = await seedWorkItem();

    const eligible = await getEligibleDesigners(actor, workItem.id);

    const row = eligible.find((d) => d.userId === designer.userId);
    expect(row).toBeDefined();
    // Frozen EligibleDesigner shape (data-model.md) — assert field presence
    // and type, not exact values (workload figures vary with seeded data).
    expect(typeof row?.userId).toBe("string");
    expect(typeof row?.name).toBe("string");
    expect(typeof row?.activeWorkItemCount).toBe("number");
    expect(typeof row?.queueSize).toBe("number");
    expect(typeof row?.estimatedWaitMinutes).toBe("number");
    expect(typeof row?.pastJobsForCustomer).toBe("number");
    expect(typeof row?.isSuggested).toBe("boolean");
  });

  it("assignDesigner's initial-assignment branch requires workitem.assign_designer (FORBIDDEN without it)", async () => {
    const actor = await createActor([]);
    const designer = await createActor(["design.work"]);
    const workItem = await seedWorkItem();

    await expect(assignDesigner(actor, workItem.id, designer.userId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const unchanged = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(unchanged.state).toBe("NEW");
    expect(unchanged.assigneeId).toBeNull();
  });

  it("a holder of workitem.assign_designer can perform the initial-assignment branch (NEW → ASSIGNED)", async () => {
    const actor = await createActor(["workitem.assign_designer"]);
    const designer = await createActor(["design.work"]);
    const workItem = await seedWorkItem();

    await assignDesigner(actor, workItem.id, designer.userId);

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.state).toBe("ASSIGNED");
    expect(updated.assigneeId).toBe(designer.userId);
  });

  it("assignDesigner's reassignment branch is gated by the SAME permission — no separate reassignment permission (FR-005a)", async () => {
    const actor = await createActor([]);
    const designerA = await createActor(["design.work"]);
    const designerB = await createActor(["design.work"]);
    const workItem = await seedWorkItem("ASSIGNED", designerA.userId);

    await expect(assignDesigner(actor, workItem.id, designerB.userId, "reason")).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const unchanged = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(unchanged.assigneeId).toBe(designerA.userId);
  });

  it("a holder of workitem.assign_designer can perform the reassignment branch given a reason", async () => {
    const actor = await createActor(["workitem.assign_designer"]);
    const designerA = await createActor(["design.work"]);
    const designerB = await createActor(["design.work"]);
    const workItem = await seedWorkItem("ASSIGNED", designerA.userId);

    await assignDesigner(actor, workItem.id, designerB.userId, "rebalance");

    const updated = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(updated.assigneeId).toBe(designerB.userId);
    expect(updated.state).toBe("ASSIGNED");
  });
});

describe("designer-assignment contract: getDesignerWorkload", () => {
  it("requires no permission beyond an authenticated actor, and matches the frozen shape", async () => {
    const actor = await createActor([]);
    const designer = await createActor(["design.work"]);
    await seedWorkItem("ASSIGNED", designer.userId);

    const workload = await getDesignerWorkload(actor);

    const row = workload.find((w) => w.userId === designer.userId);
    expect(row).toBeDefined();
    expect(typeof row?.name).toBe("string");
    expect(typeof row?.activeWorkItemCount).toBe("number");
    expect(row?.activeWorkItemCount).toBeGreaterThanOrEqual(1);
  });
});
