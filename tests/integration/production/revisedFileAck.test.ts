// Integration test for the revised-file alert — specs/014-production/
// tasks.md T037 (US7). Start production, approve a newer DesignVersion for
// the same Work Item (013's approveDesign), assert pendingFileRevisionAt is
// set and resumeProduction refuses with PENDING_FILE_REVISION, then
// acknowledgeFileRevision clears it and resumeProduction succeeds
// (research.md §4, FR-013).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { startProduction, pauseProduction, resumeProduction, acknowledgeFileRevision } from "~/server/production/timer";
import { approveDesign } from "~/server/review/review";
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
    userId: unique("test-revised-file-actor"),
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

describe("revised-file acknowledgment (integration, US7)", () => {
  it("blocks resumeProduction until the operator acknowledges a mid-production file revision", async () => {
    const department = await testDb.department.create({ data: { name: unique("Dept") } });
    const operator = await createActor(["production.operate"], [department.id]);
    const reviewer = await createActor(["design.review"], []);

    const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
    const order = await testDb.order.create({
      data: {
        number: Number(process.hrtime.bigint() % 1_000_000_000n),
        customerId: customer.id,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: operator.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "READY_FOR_PRODUCTION", departmentId: department.id },
    });

    await startProduction(operator, workItem.id);
    await pauseProduction(operator, workItem.id);

    await testDb.designVersion.create({
      data: {
        workItemId: workItem.id,
        version: 1,
        storageKey: unique("storage-key"),
        fileName: "revised.pdf",
        sizeBytes: 100,
        sha256: unique("sha"),
        uploadedById: reviewer.userId,
      },
    });

    await approveDesign(reviewer, workItem.id);

    let wi = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(wi?.state).toBe("IN_PRODUCTION");
    expect(wi?.pendingFileRevisionAt).toBeInstanceOf(Date);

    await expect(resumeProduction(operator, workItem.id)).rejects.toMatchObject({
      code: "PENDING_FILE_REVISION",
    });

    await acknowledgeFileRevision(operator, workItem.id);

    wi = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(wi?.pendingFileRevisionAt).toBeNull();

    await expect(resumeProduction(operator, workItem.id)).resolves.toBeUndefined();
  });
});
