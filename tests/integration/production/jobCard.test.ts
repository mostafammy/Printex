// Integration test for getJobCard — specs/014-production/tasks.md T013 (US2).
// Seeds a Work Item with an approved DesignVersion and a newer unapproved
// draft; asserts the job card's approvedFile points at the approved version
// only, never the draft, and spec fields match the Work Item's stored values
// (spec.md US2 Acceptance Scenarios, FR-004, FR-011).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getJobCard } from "~/server/production/jobCard";
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

let customerId: string;
let department: { id: string };

function actorFor(departmentIds: string[]): Actor {
  return {
    userId: unique("test-integration-jobcard-actor"),
    roles: [],
    permissions: new Set<Permission>(["production.operate"]),
    departmentIds,
  };
}

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  department = await testDb.department.create({ data: { name: unique("Dept") } });
});

async function seedActorUser(actor: Actor) {
  await testDb.user.create({
    data: {
      id: actor.userId,
      name: "Test Operator",
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
}

describe("getJobCard (integration, US2)", () => {
  it("exposes only the approved version's file, never a newer unapproved draft, and matches stored spec fields", async () => {
    const actor = actorFor([department.id]);
    await seedActorUser(actor);

    const order = await testDb.order.create({
      data: {
        number: Number(process.hrtime.bigint() % 1_000_000_000n),
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "READY_FOR_PRODUCTION",
        departmentId: department.id,
        description: "Roll-up banner",
        quantity: 3,
        widthValue: 85,
        heightValue: 200,
        dimensionUnit: "CM",
        material: "PVC",
        finishNotes: "Matte laminate",
      },
    });

    await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: unique("storage-key-approved"),
        fileName: "banner-approved.pdf",
        sizeBytes: 500,
        sha256: unique("sha-approved"),
        uploadedById: actor.userId,
        approvedAt: new Date(Date.now() - 60_000),
      },
    });
    const draft = await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 2,
        storageKey: unique("storage-key-draft"),
        fileName: "banner-draft-v2.pdf",
        sizeBytes: 600,
        sha256: unique("sha-draft"),
        uploadedById: actor.userId,
      },
    });

    const card = await getJobCard(actor, workItem.id);

    expect(card.approvedFile).not.toBeNull();
    expect(card.approvedFile?.fileName).toBe("banner-approved.pdf");
    expect(card.approvedFile?.versionId).not.toBe(draft.id);

    expect(card.spec).toEqual({
      description: "Roll-up banner",
      quantity: 3,
      widthValue: "85",
      heightValue: "200",
      dimensionUnit: "CM",
      material: "PVC",
      finishNotes: "Matte laminate",
    });
  });
});
