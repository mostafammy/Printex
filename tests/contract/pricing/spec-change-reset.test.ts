// Contract test for the 016 spec-change pricing reset — tasks.md T024, US3.
// Proves successful reset through the supplied transaction, unchanged
// historical prices, retained waiting age, registration under the frozen
// `pricing.reset` name, and rollback when the surrounding transaction fails
// (quickstart scenario 7, contract-level with a supplied transaction per
// contracts/spec-change-reset.md).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  seedCustomer,
  seedOrderWithWorkItem,
  seedPriceList,
  seedPricingPolicy,
  seedPricingUser,
  seedProductType,
} from "../../helpers/pricingSeed";
import { setPrice } from "~/server/pricing";
import {
  PRICING_RESET_LISTENER_NAME,
  pricingResetListener,
  registerPricingResetListener,
} from "~/server/pricing/change-listener";
import type { SpecChangedEvent, SpecChangeListener } from "~/server/pricing/change-listener";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let setter: Actor;
let customerId: string;
let productId: string;

beforeAll(async () => {
  setter = await seedPricingUser("reset-setter", ["pricing.set_variable"]);
  customerId = await seedCustomer("Reset");
  productId = await seedProductType("ResetProduct");
  await seedPricingPolicy(productId, "VARIABLE", setter.userId);
  await seedPriceList({
    productTypeId: productId,
    unit: "PIECE",
    createdById: setter.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "10" }],
  });
});

function changeEvent(workItemId: string, orderId: string): SpecChangedEvent {
  return {
    type: "work_item.spec_changed",
    workItemId,
    orderId,
    fromVersion: 1,
    toVersion: 2,
    specVersionId: `specver_${workItemId}_2`,
    origin: "DIRECT_EDIT",
    changeRequestId: null,
    changedFields: ["heightValue"],
    workItemState: "IN_DESIGN",
    actorId: setter.userId,
    occurredAt: new Date(),
  };
}

async function pricedWorkItem(): Promise<{ workItemId: string; orderId: string; priceId: string }> {
  const { workItemId, orderId } = await seedOrderWithWorkItem({
    customerId,
    createdById: setter.userId,
    productTypeId: productId,
    quantity: 2,
  });
  const price = await setPrice(setter, {
    workItemId,
    kind: "VARIABLE",
    amount: "20",
    reason: "pre-change decision",
  });
  return { workItemId, orderId, priceId: price.id };
}

describe("pricing.reset listener (contract, US3)", () => {
  it("registers under the frozen pricing.reset name, replacing by name", () => {
    const registry = new Map<string, SpecChangeListener>();
    const register = (name: string, listener: SpecChangeListener) => {
      registry.set(name, listener);
    };

    registerPricingResetListener(register);
    registerPricingResetListener(register);

    expect([...registry.keys()]).toEqual([PRICING_RESET_LISTENER_NAME]);
    expect(registry.get(PRICING_RESET_LISTENER_NAME)).toBe(pricingResetListener);
  });

  it("resets a priced work item to PENDING inside the supplied transaction and audits it", async () => {
    const { workItemId, orderId, priceId } = await pricedWorkItem();
    const event = changeEvent(workItemId, orderId);

    await testDb.$transaction(async (tx) => {
      await pricingResetListener(tx, event);
    });

    const status = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId } });
    expect(status.status).toBe("PENDING");
    expect(status.currentPriceId).toBeNull();
    expect(status.waitingSince).not.toBeNull();
    expect(status.updatedById).toBe(setter.userId);

    const auditRow = await testDb.auditEvent.findFirst({
      where: { action: "pricing.reset_after_spec_change", entityId: workItemId },
      orderBy: { createdAt: "desc" },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorId).toBe(setter.userId);
    expect(auditRow?.after).toMatchObject({
      status: "PENDING",
      specVersionId: event.specVersionId,
      fromVersion: 1,
      toVersion: 2,
    });

    // Historical price rows are untouched (append-only history).
    const price = await testDb.workItemPrice.findUniqueOrThrow({ where: { id: priceId } });
    expect(Number(price.amount)).toBe(20);
    expect(price.reason).toBe("pre-change decision");
  });

  it("rolls the reset back when the surrounding transaction fails", async () => {
    const { workItemId, orderId } = await pricedWorkItem();
    const event = changeEvent(workItemId, orderId);

    await expect(
      testDb.$transaction(async (tx) => {
        await pricingResetListener(tx, event);
        throw new Error("listener failure simulated after reset");
      }),
    ).rejects.toThrow(/listener failure simulated/);

    const status = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId } });
    expect(status.status).toBe("PRICED");
    expect(status.currentPriceId).not.toBeNull();

    const audits = await testDb.auditEvent.count({
      where: { action: "pricing.reset_after_spec_change", entityId: workItemId },
    });
    expect(audits).toBe(0);
  });

  it("retains an existing waitingSince while unresolved", async () => {
    const { workItemId, orderId } = await pricedWorkItem();
    const waitingSince = new Date("2026-02-01T00:00:00.000Z");
    await testDb.pricingStatus.update({
      where: { workItemId },
      data: { status: "PENDING", waitingSince, currentPriceId: null },
    });

    await testDb.$transaction(async (tx) => {
      await pricingResetListener(tx, changeEvent(workItemId, orderId));
    });

    const status = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId } });
    expect(status.status).toBe("PENDING");
    expect(status.waitingSince?.toISOString()).toBe(waitingSince.toISOString());
  });

  it("starts waitingSince at the change time for work items without a status row", async () => {
    const { workItemId, orderId } = await seedOrderWithWorkItem({
      customerId,
      createdById: setter.userId,
      productTypeId: productId,
      quantity: 1,
    });
    const event = changeEvent(workItemId, orderId);

    await testDb.$transaction(async (tx) => {
      await pricingResetListener(tx, event);
    });

    const status = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId } });
    expect(status.status).toBe("PENDING");
    expect(status.waitingSince?.toISOString()).toBe(event.occurredAt.toISOString());
  });
});
