// Integration test proving FR-012's "no replace in place" for an approved
// design version — tasks.md T030, User Story 4 Acceptance Scenario 2.
//
// This feature adds no new enforcement code for this: 012's existing
// `@@unique([workItemId, version])` constraint on DesignVersion already
// rejects a second row reusing an approved version's (workItemId, version)
// pair. This test proves that constraint holds, it does not add to it.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
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

async function createActor(permissions: Permission[]): Promise<Actor> {
  const actor: Actor = {
    userId: unique("test-immutability-actor"),
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

beforeAll(async () => {
  const seedActor = await createActor([]);
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  void seedActor;
});

describe("DesignVersion immutability (integration, FR-012)", () => {
  it("rejects a second DesignVersion row reusing an already-approved version number for the same Work Item", async () => {
    const uploader = await createActor([]);
    const reviewer = await createActor([]);

    const order = await testDb.order.create({
      data: {
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: uploader.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "APPROVED" },
    });

    await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: unique("storage-key"),
        fileName: "v1.png",
        sizeBytes: 10,
        sha256: unique("sha"),
        uploadedById: uploader.userId,
        approvedAt: new Date(),
        approvedById: reviewer.userId,
      },
    });

    await expect(
      testDb.designVersion.create({
        data: {
          workItemId: workItem.id,
          version: 1,
          storageKey: unique("storage-key"),
          fileName: "v1-replacement.png",
          sizeBytes: 10,
          sha256: unique("sha"),
          uploadedById: uploader.userId,
        },
      }),
    ).rejects.toThrow();

    const versions = await testDb.designVersion.findMany({ where: { workItemId: workItem.id } });
    expect(versions).toHaveLength(1);
    expect(versions[0]?.fileName).toBe("v1.png");
  });
});
