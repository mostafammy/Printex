// Contract tests for the Product Type admin CRUD — tasks.md T050,
// contracts/product-types.md.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { createProductType, deactivateProductType, DomainOrderError } from "~/server/orders";
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

const adminActor: Actor = {
  userId: unique("test-producttype-admin"),
  roles: [],
  permissions: new Set<Permission>(["admin.config"]),
  departmentIds: [],
};

beforeAll(async () => {
  await testDb.user.create({
    data: {
      id: adminActor.userId,
      name: "Test Admin",
      email: `${adminActor.userId}@local.invalid`,
      username: adminActor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
});

describe("Product Type admin CRUD (contract)", () => {
  it("creating a duplicate name yields DomainOrderError(DUPLICATE_NAME)", async () => {
    const name = unique("Foam Board");
    await createProductType(adminActor, { name });

    await expect(createProductType(adminActor, { name })).rejects.toMatchObject({
      code: "DUPLICATE_NAME",
    });
  });

  it("createProductType returns a DomainOrderError instance on a duplicate name", async () => {
    const name = unique("Roll-up Banner Test");
    await createProductType(adminActor, { name });

    await expect(createProductType(adminActor, { name })).rejects.toBeInstanceOf(DomainOrderError);
  });

  it("deactivating never removes the row or breaks an existing WorkItem.productTypeId reference", async () => {
    const name = unique("Laminated Sticker");
    const { productTypeId } = await createProductType(adminActor, { name });

    const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
    const order = await testDb.order.create({
      data: {
        customerId: customer.id,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: adminActor.userId,
      },
    });
    const workItem = await testDb.workItem.create({
      data: { orderId: order.id, state: "NEW", productTypeId },
    });

    await deactivateProductType(adminActor, productTypeId);

    const row = await testDb.productType.findUniqueOrThrow({ where: { id: productTypeId } });
    expect(row.isActive).toBe(false);

    const reloadedWorkItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItem.id } });
    expect(reloadedWorkItem.productTypeId).toBe(productTypeId);
  });
});
