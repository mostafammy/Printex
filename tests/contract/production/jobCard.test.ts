// Contract test for src/server/production/jobCard.ts — specs/014-production/
// contracts/production.md's `getJobCard`. tasks.md T012 (US2).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getJobCard } from "~/server/production/jobCard";
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

async function createActor(permissions: Permission[], departmentIds: string[]): Promise<Actor> {
  const actor: Actor = {
    userId: unique("test-contract-jobcard-actor"),
    roles: [],
    permissions: new Set<Permission>(permissions),
    departmentIds,
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
let department: { id: string };
let otherDepartment: { id: string };
let insideActor: Actor;
let outsideActor: Actor;

beforeAll(async () => {
  department = await testDb.department.create({ data: { name: unique("Dept") } });
  otherDepartment = await testDb.department.create({ data: { name: unique("OtherDept") } });
  insideActor = await createActor(["production.operate"], [department.id]);
  outsideActor = await createActor(["production.operate"], [otherDepartment.id]);

  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
});

async function seedWorkItem() {
  const order = await testDb.order.create({
    data: {
      number: Number(process.hrtime.bigint() % 1_000_000_000n),
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: insideActor.userId,
    },
  });
  return testDb.workItem.create({
    data: {
      orderId: order.id,
      state: "READY_FOR_PRODUCTION",
      departmentId: department.id,
      description: "Business cards",
      quantity: 500,
      material: "350gsm matte",
    },
  });
}

describe("production contract: getJobCard", () => {
  it("requires production.operate scoped to the Work Item's department — FORBIDDEN outside it", async () => {
    const wi = await seedWorkItem();
    await expect(getJobCard(outsideActor, wi.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns spec fields and only the approved file pointer, never a draft", async () => {
    const wi = await seedWorkItem();

    const draft = await testDb.designVersion.create({
      data: {
        workItemId: wi.id,
        version: 1,
        storageKey: unique("storage-key-draft"),
        fileName: "draft-v1.pdf",
        sizeBytes: 100,
        sha256: unique("sha-draft"),
        uploadedById: insideActor.userId,
      },
    });
    const approved = await testDb.designVersion.create({
      data: {
        workItemId: wi.id,
        version: 2,
        storageKey: unique("storage-key-approved"),
        fileName: "approved-v2.pdf",
        sizeBytes: 200,
        sha256: unique("sha-approved"),
        uploadedById: insideActor.userId,
        approvedAt: new Date(),
      },
    });

    const card = await getJobCard(insideActor, wi.id);

    expect(card.workItemId).toBe(wi.id);
    expect(card.spec.description).toBe("Business cards");
    expect(card.spec.quantity).toBe(500);
    expect(card.spec.material).toBe("350gsm matte");
    expect(card.approvedFile?.versionId).toBe(approved.id);
    expect(card.approvedFile?.versionId).not.toBe(draft.id);
    expect(card.approvedFile?.fileName).toBe("approved-v2.pdf");
  });

  it("returns approvedFile: null when no version has been approved yet", async () => {
    const wi = await seedWorkItem();
    const card = await getJobCard(insideActor, wi.id);
    expect(card.approvedFile).toBeNull();
  });
});
