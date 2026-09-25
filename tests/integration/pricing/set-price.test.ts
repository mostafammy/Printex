// Integration test for setPrice() — tasks.md T018, US2.
// Permission mapping, mandatory reasons, and atomicity of failed attempts
// (quickstart scenario 4).

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
import { quote, setPrice } from "~/server/pricing";
import { ForbiddenError } from "~/server/auth/authorize";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let reception: Actor;
let variableUser: Actor;
let overrideUser: Actor;
let fixedProductId: string;
let variableProductId: string;
let customerId: string;

beforeAll(async () => {
  reception = await seedPricingUser("setprice-reception", ["pricing.use_fixed"]);
  variableUser = await seedPricingUser("setprice-variable", ["pricing.use_fixed", "pricing.set_variable"]);
  overrideUser = await seedPricingUser("setprice-override", ["pricing.use_fixed", "pricing.override"]);
  customerId = await seedCustomer("SetPrice");

  fixedProductId = await seedProductType("SetPriceFixed");
  variableProductId = await seedProductType("SetPriceVariable");
  await seedPricingPolicy(fixedProductId, "FIXED", reception.userId);
  await seedPricingPolicy(variableProductId, "VARIABLE", reception.userId);

  await seedPriceList({
    productTypeId: fixedProductId,
    unit: "PIECE",
    createdById: reception.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "25" }],
  });
  await seedPriceList({
    productTypeId: variableProductId,
    unit: "PIECE",
    createdById: reception.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "25" }],
  });
});

async function workItemOn(productTypeId: string): Promise<string> {
  const { workItemId } = await seedOrderWithWorkItem({
    customerId,
    createdById: reception.userId,
    productTypeId,
    quantity: 4,
  });
  return workItemId;
}

async function auditCountFor(userId: string): Promise<number> {
  return testDb.auditEvent.count({ where: { actorId: userId } });
}

describe("setPrice (integration, US2)", () => {
  it("lets Reception apply a computed FIXED quote and records price + audit atomically", async () => {
    const workItemId = await workItemOn(fixedProductId);
    const quoted = await quote({ workItemId, customerId, asOf: new Date("2026-03-15T00:00:00.000Z") });
    expect(quoted.ok).toBe(true);
    if (!quoted.ok) return;

    const snapshot = await setPrice(reception, {
      workItemId,
      kind: "APPLY_QUOTE",
      quote: quoted.value,
    });

    expect(Number(snapshot.amount)).toBe(100); // 4 x 25 EGP
    expect(snapshot.source).toBe("LIST");
    expect(snapshot.currency).toBe("EGP");

    const status = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId } });
    expect(status.status).toBe("PRICED");
    expect(status.currentPriceId).toBe(snapshot.id);

    const auditRow = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItemPrice", entityId: snapshot.id },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorId).toBe(reception.userId);
  });

  it("forbids Reception from setting a VARIABLE price and writes neither price nor audit", async () => {
    const workItemId = await workItemOn(variableProductId);
    const auditsBefore = await auditCountFor(reception.userId);

    await expect(
      setPrice(reception, { workItemId, kind: "VARIABLE", amount: "40", reason: "manual test" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await testDb.workItemPrice.count({ where: { workItemId } })).toBe(0);
    expect(await testDb.pricingStatus.count({ where: { workItemId } })).toBe(0);
    expect(await auditCountFor(reception.userId)).toBe(auditsBefore);
  });

  it("lets a pricing.set_variable holder set a VARIABLE price with a reason", async () => {
    const workItemId = await workItemOn(variableProductId);

    const snapshot = await setPrice(variableUser, {
      workItemId,
      kind: "VARIABLE",
      amount: "40.5",
      reason: "Negotiated rate for this run",
    });

    expect(Number(snapshot.amount)).toBe(41); // manual amounts round to whole EGP
    expect(snapshot.source).toBe("MANUAL");
    expect(snapshot.reason).toBe("Negotiated rate for this run");
    expect(snapshot.setById).toBe(variableUser.userId);

    const status = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId } });
    expect(status.status).toBe("PRICED");
    expect(status.waitingSince).toBeNull();
  });

  it("forbids an override without pricing.override and writes neither price nor audit", async () => {
    const workItemId = await workItemOn(variableProductId);
    const auditsBefore = await auditCountFor(variableUser.userId);

    await expect(
      setPrice(variableUser, { workItemId, kind: "OVERRIDE", amount: "99", reason: "not allowed" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await testDb.workItemPrice.count({ where: { workItemId } })).toBe(0);
    expect(await auditCountFor(variableUser.userId)).toBe(auditsBefore);
  });

  it("rejects manual pricing without a reason before anything is written", async () => {
    const workItemId = await workItemOn(variableProductId);
    const auditsBefore = await auditCountFor(overrideUser.userId);

    await expect(
      setPrice(overrideUser, { workItemId, kind: "OVERRIDE", amount: "99", reason: "   " }),
    ).rejects.toMatchObject({ name: "DomainPricingError", code: "VALIDATION" });

    expect(await testDb.workItemPrice.count({ where: { workItemId } })).toBe(0);
    expect(await auditCountFor(overrideUser.userId)).toBe(auditsBefore);
  });

  it("lets an override user override with a reason, sourcing MANUAL and auditing it", async () => {
    const workItemId = await workItemOn(variableProductId);

    const snapshot = await setPrice(overrideUser, {
      workItemId,
      kind: "OVERRIDE",
      amount: "77",
      reason: "Manager approved exception",
    });

    expect(Number(snapshot.amount)).toBe(77);
    expect(snapshot.source).toBe("MANUAL");
    expect(snapshot.reason).toBe("Manager approved exception");

    const auditRow = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItemPrice", entityId: snapshot.id },
    });
    expect(auditRow?.reason).toBe("Manager approved exception");
  });

  it("appends a new history row instead of mutating the previous price", async () => {
    const workItemId = await workItemOn(variableProductId);
    const first = await setPrice(variableUser, {
      workItemId,
      kind: "VARIABLE",
      amount: "30",
      reason: "first decision",
    });
    const second = await setPrice(overrideUser, {
      workItemId,
      kind: "OVERRIDE",
      amount: "35",
      reason: "second decision",
    });

    const rows = await testDb.workItemPrice.findMany({
      where: { workItemId },
      orderBy: { setAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    const firstRow = rows.find((row) => row.id === first.id);
    expect(Number(firstRow?.amount)).toBe(30);
    expect(firstRow?.reason).toBe("first decision");

    const status = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId } });
    expect(status.currentPriceId).toBe(second.id);
  });
});
