import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";
import { getBoardSnapshot } from "~/server/board/snapshot";
import type { Actor } from "~/server/auth";

describe("getBoardSnapshot visibility scoping (FR-011, FR-012, FR-023)", { timeout: 60000 }, () => {
  let adminActor: Actor;
  let prodOperatorActor: Actor;
  let deptAId: string;
  let deptBId: string;
  let workItemNewId: string;
  let workItemProdAId: string;
  let workItemProdBId: string;

  beforeAll(async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });

    const deptA = await testDb.department.create({
      data: { name: `DeptA_${Date.now()}` },
    });
    deptAId = deptA.id;

    const deptB = await testDb.department.create({
      data: { name: `DeptB_${Date.now()}` },
    });
    deptBId = deptB.id;

    // Work items:
    // 1. NEW (Reception station -> non-production)
    const wi1 = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        departmentId: null,
      },
    });
    workItemNewId = wi1.id;

    // 2. READY_FOR_PRODUCTION in Dept A
    const wi2 = await testDb.workItem.create({
      data: {
        orderId,
        state: "READY_FOR_PRODUCTION",
        departmentId: deptAId,
      },
    });
    workItemProdAId = wi2.id;

    // 3. READY_FOR_PRODUCTION in Dept B
    const wi3 = await testDb.workItem.create({
      data: {
        orderId,
        state: "READY_FOR_PRODUCTION",
        departmentId: deptBId,
      },
    });
    workItemProdBId = wi3.id;

    // Admin Actor (has floor-wide visibility via admin.override)
    adminActor = {
      userId,
      roles: ["ADMIN_OWNER"],
      permissions: new Set(["admin.override", "admin.users", "order.create"]),
      departmentIds: [],
    };

    // Production Operator Actor (in dept A)
    prodOperatorActor = {
      userId: await seedUser(),
      roles: ["PRODUCTION_OPERATOR"],
      permissions: new Set(["production.operate"]),
      departmentIds: [deptAId],
    };
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("Admin actor receives all cards across all departments and stations", async () => {
    const snapshot = await getBoardSnapshot(adminActor, undefined, testDb);
    const cardIds = snapshot.cards.map((c) => c.id);

    expect(cardIds).toContain(workItemNewId);
    expect(cardIds).toContain(workItemProdAId);
    expect(cardIds).toContain(workItemProdBId);
  });

  it("Production operator receives cards matching their department, but not other departments", async () => {
    const snapshot = await getBoardSnapshot(prodOperatorActor, undefined, testDb);
    const cardIds = snapshot.cards.map((c) => c.id);

    // Dept A production card must be visible
    expect(cardIds).toContain(workItemProdAId);
    // Dept B production card must NOT be visible
    expect(cardIds).not.toContain(workItemProdBId);
  });
});
