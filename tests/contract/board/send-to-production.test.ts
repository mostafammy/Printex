import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";
import { sendToProduction } from "~/server/orders";
import { DomainOrderError } from "~/server/orders/errors";
import { ForbiddenError } from "~/server/auth/authorize";
import type { Actor } from "~/server/auth";

describe("sendToProduction contract (FR-015a, contracts/board-server.md §sendToProduction)", { timeout: 60000 }, () => {
  let authorizedActor: Actor;
  let unauthorizedActor: Actor;
  let orderId: string;

  beforeAll(async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    orderId = await seedOrder({ customerId, createdById: userId });

    authorizedActor = {
      userId,
      roles: ["RECEPTION"],
      permissions: new Set(["workitem.send_to_production"]),
      departmentIds: [],
    };

    unauthorizedActor = {
      userId: await seedUser(),
      roles: ["DESIGNER"],
      permissions: new Set(["design.work"]),
      departmentIds: [],
    };
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("fails with ForbiddenError when actor lacks workitem.send_to_production", async () => {
    const item = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        requiresDesign: false,
      },
    });

    await expect(
      sendToProduction(unauthorizedActor, item.id, testDb),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses with DomainOrderError('DESIGN_REQUIRED') when requiresDesign is true", async () => {
    const item = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        requiresDesign: true,
      },
    });

    await expect(
      sendToProduction(authorizedActor, item.id, testDb),
    ).rejects.toThrowError(DomainOrderError);
  });

  it("transitions item to READY_FOR_PRODUCTION and writes audit event", async () => {
    const item = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        requiresDesign: false,
      },
    });

    await sendToProduction(authorizedActor, item.id, testDb);

    const updated = await testDb.workItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(updated.state).toBe("READY_FOR_PRODUCTION");

    const auditRow = await testDb.auditEvent.findFirst({
      where: {
        action: "workitem.sent_to_production",
        entityId: item.id,
      },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorId).toBe(authorizedActor.userId);
  });
});
